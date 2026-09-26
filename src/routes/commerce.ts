import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import type { Variables } from '../web-context.js';
import { canAccessGroup, canModifyGroup } from '../web-context.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthUser } from '../types.js';
import {
  countCommerceEventsByStage,
  createCommerceStore,
  deleteCommerceStoreForUser,
  getCommerceStoreById,
  getCommerceStoreForUser,
  getCommerceStoreIngestTokenHash,
  getRegisteredGroup,
  listCommerceEventsForStore,
  listCommerceStoresForUser,
  recordCommerceEventForStore,
  rotateCommerceStoreIngestToken,
  updateCommerceStoreForUser,
} from '../db.js';
import {
  COMMERCE_EVENT_LABELS,
  COMMERCE_LIFECYCLE_STAGES,
  COMMERCE_PLATFORMS,
  getCommerceStageForEvent,
} from '../commerce/catalog.js';
import {
  CommerceEventCreateSchema,
  CommerceStoreCreateSchema,
  CommerceStorePatchSchema,
  normalizeCommerceEventData,
} from '../commerce/schemas.js';

const commerceRoutes = new Hono<{ Variables: Variables }>();
const MAX_EVENT_BODY_BYTES = 16 * 1024;
const commerceEventBodyLimit = bodyLimit({
  maxSize: MAX_EVENT_BODY_BYTES,
  onError: (c) => c.json({ error: 'Event body exceeds the 16 KB limit' }, 413),
});

function hashIngestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function matchesIngestToken(
  supplied: string,
  expectedHash: string | null,
): boolean {
  if (!expectedHash || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const suppliedHash = Buffer.from(hashIngestToken(supplied), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return (
    suppliedHash.length === expected.length &&
    timingSafeEqual(suppliedHash, expected)
  );
}

function getWorkspaceForUser(user: AuthUser, workspaceJid: string) {
  const group = getRegisteredGroup(workspaceJid);
  if (!group || !workspaceJid.startsWith('web:')) return null;
  const withJid = { ...group, jid: workspaceJid };
  if (!canAccessGroup(user, withJid)) return null;
  return { group: withJid, canModify: canModifyGroup(user, withJid) };
}

function canManageStore(user: AuthUser, workspaceJid: string): boolean {
  return Boolean(getWorkspaceForUser(user, workspaceJid)?.canModify);
}

function canReadStore(user: AuthUser, workspaceJid: string): boolean {
  return Boolean(getWorkspaceForUser(user, workspaceJid));
}

commerceRoutes.get('/catalog', authMiddleware, (c) => {
  return c.json({
    lifecycle_stages: COMMERCE_LIFECYCLE_STAGES,
    event_types: COMMERCE_EVENT_LABELS,
    platforms: COMMERCE_PLATFORMS,
    integration_note:
      '只有自研软件的业务事件接入 API 当前可用；其他平台仍显示为预留连接器。',
  });
});

commerceRoutes.get('/stores', authMiddleware, (c) => {
  const user = c.get('user') as AuthUser;
  const stores = listCommerceStoresForUser(user.id).filter((store) =>
    canReadStore(user, store.workspace_jid),
  );
  return c.json({ stores });
});

commerceRoutes.post('/stores', authMiddleware, async (c) => {
  const user = c.get('user') as AuthUser;
  const body = await c.req.json().catch(() => ({}));
  const parsed = CommerceStoreCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid request body' }, 400);

  const workspaceAccess = getWorkspaceForUser(user, parsed.data.workspace_jid);
  if (!workspaceAccess) return c.json({ error: 'Workspace not found' }, 404);
  if (!workspaceAccess.canModify) return c.json({ error: 'Forbidden' }, 403);

  const ingestToken = randomBytes(32).toString('base64url');
  try {
    const store = createCommerceStore({
      id: randomUUID(),
      ownerUserId: user.id,
      workspaceJid: parsed.data.workspace_jid,
      platformId: parsed.data.platform_id,
      displayName: parsed.data.display_name,
      externalStoreRef: parsed.data.external_store_ref,
      ingestTokenHash: hashIngestToken(ingestToken),
    });
    return c.json({ store, ingest_token: ingestToken }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE constraint failed')) {
      return c.json(
        { error: 'A store with this identifier already exists' },
        409,
      );
    }
    throw error;
  }
});

commerceRoutes.patch('/stores/:storeId', authMiddleware, async (c) => {
  const user = c.get('user') as AuthUser;
  const store = getCommerceStoreForUser(c.req.param('storeId'), user.id);
  if (!store || !canReadStore(user, store.workspace_jid)) {
    return c.json({ error: 'Store not found' }, 404);
  }
  if (!canManageStore(user, store.workspace_jid)) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = CommerceStorePatchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid request body' }, 400);
  const updated = updateCommerceStoreForUser(store.id, user.id, {
    displayName: parsed.data.display_name,
    status: parsed.data.status,
  });
  return c.json({ store: updated });
});

commerceRoutes.delete('/stores/:storeId', authMiddleware, (c) => {
  const user = c.get('user') as AuthUser;
  const store = getCommerceStoreForUser(c.req.param('storeId'), user.id);
  if (!store || !canReadStore(user, store.workspace_jid)) {
    return c.json({ error: 'Store not found' }, 404);
  }
  if (!canManageStore(user, store.workspace_jid)) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  const deleted = deleteCommerceStoreForUser(store.id, user.id);
  return deleted
    ? c.body(null, 204)
    : c.json({ error: 'Store not found' }, 404);
});

commerceRoutes.post(
  '/stores/:storeId/rotate-ingest-token',
  authMiddleware,
  (c) => {
    const user = c.get('user') as AuthUser;
    const store = getCommerceStoreForUser(c.req.param('storeId'), user.id);
    if (!store || !canReadStore(user, store.workspace_jid)) {
      return c.json({ error: 'Store not found' }, 404);
    }
    if (!canManageStore(user, store.workspace_jid)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const ingestToken = randomBytes(32).toString('base64url');
    rotateCommerceStoreIngestToken(
      store.id,
      user.id,
      hashIngestToken(ingestToken),
    );
    return c.json({ ingest_token: ingestToken });
  },
);

commerceRoutes.get('/stores/:storeId/overview', authMiddleware, (c) => {
  const user = c.get('user') as AuthUser;
  const store = getCommerceStoreForUser(c.req.param('storeId'), user.id);
  if (!store || !canReadStore(user, store.workspace_jid)) {
    return c.json({ error: 'Store not found' }, 404);
  }
  const counts = countCommerceEventsByStage(store.id, user.id);
  const byStage = new Map(counts.map((item) => [item.lifecycle_stage, item]));
  return c.json({
    store,
    stages: COMMERCE_LIFECYCLE_STAGES.map((stage) => {
      const count = byStage.get(stage.id);
      return {
        ...stage,
        event_count: count?.event_count ?? 0,
        latest_at: count?.latest_at ?? null,
      };
    }),
    recent_events: listCommerceEventsForStore(store.id, user.id, 30),
  });
});

commerceRoutes.post(
  '/stores/:storeId/events',
  authMiddleware,
  commerceEventBodyLimit,
  async (c) => {
    const user = c.get('user') as AuthUser;
    const store = getCommerceStoreForUser(c.req.param('storeId'), user.id);
    if (!store || !canReadStore(user, store.workspace_jid)) {
      return c.json({ error: 'Store not found' }, 404);
    }
    if (!canManageStore(user, store.workspace_jid)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    if (store.status !== 'active') {
      return c.json({ error: 'Store integration is paused' }, 409);
    }
    const rawBody = await c.req.text();
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const parsed = CommerceEventCreateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Invalid commerce event', issues: parsed.error.issues },
        400,
      );
    }
    const data = normalizeCommerceEventData(
      parsed.data.event_type,
      parsed.data.data,
    );
    const result = recordCommerceEventForStore(store, {
      sourceEventId: parsed.data.event_id,
      eventType: parsed.data.event_type,
      lifecycleStage: getCommerceStageForEvent(parsed.data.event_type),
      occurredAt: parsed.data.occurred_at,
      data,
    });
    return c.json(result, result.conflict ? 409 : result.inserted ? 201 : 200);
  },
);

commerceRoutes.get('/stores/:storeId/events', authMiddleware, (c) => {
  const user = c.get('user') as AuthUser;
  const store = getCommerceStoreForUser(c.req.param('storeId'), user.id);
  if (!store || !canReadStore(user, store.workspace_jid)) {
    return c.json({ error: 'Store not found' }, 404);
  }
  const limit = Number(c.req.query('limit') ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return c.json({ error: 'limit must be between 1 and 500' }, 400);
  }
  return c.json({
    events: listCommerceEventsForStore(store.id, user.id, limit),
  });
});

commerceRoutes.post(
  '/ingest/:storeId/events',
  commerceEventBodyLimit,
  async (c) => {
    const store = getCommerceStoreById(c.req.param('storeId'));
    if (!store) return c.json({ error: 'Store not found' }, 404);
    if (store.status !== 'active') {
      return c.json({ error: 'Store integration is paused' }, 409);
    }
    const authorization = c.req.header('authorization') ?? '';
    const suppliedToken = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';
    if (
      !matchesIngestToken(
        suppliedToken,
        getCommerceStoreIngestTokenHash(store.id),
      )
    ) {
      return c.json({ error: 'Invalid integration token' }, 401);
    }
    const rawBody = await c.req.text();
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const parsed = CommerceEventCreateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Invalid commerce event', issues: parsed.error.issues },
        400,
      );
    }
    const data = normalizeCommerceEventData(
      parsed.data.event_type,
      parsed.data.data,
    );
    const result = recordCommerceEventForStore(store, {
      sourceEventId: parsed.data.event_id,
      eventType: parsed.data.event_type,
      lifecycleStage: getCommerceStageForEvent(parsed.data.event_type),
      occurredAt: parsed.data.occurred_at,
      data,
    });
    return c.json(result, result.conflict ? 409 : result.inserted ? 201 : 200);
  },
);

export { commerceRoutes };
