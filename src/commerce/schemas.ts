import { z } from 'zod';
import { COMMERCE_EVENT_TYPES } from './catalog.js';

const ref = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(
    /^[A-Za-z][A-Za-z0-9._:-]*$/,
    'Use an opaque reference, not personal data',
  );
const nonNegativeInteger = z.number().int().min(0).max(1_000_000_000);
const amount = z.number().min(0).max(1_000_000_000);

const eventDataSchemas = {
  'product.updated': z
    .object({
      product_ref: ref,
      sku_count: nonNegativeInteger.optional(),
      status: z.enum(['draft', 'active', 'archived']).optional(),
    })
    .strict(),
  'campaign.updated': z
    .object({
      campaign_ref: ref,
      status: z.enum(['draft', 'active', 'paused', 'completed']),
      budget_cny: amount.optional(),
    })
    .strict(),
  'campaign.metrics': z
    .object({
      campaign_ref: ref,
      impressions: nonNegativeInteger.optional(),
      clicks: nonNegativeInteger.optional(),
      spend_cny: amount.optional(),
      conversions: nonNegativeInteger.optional(),
    })
    .strict(),
  'content.published': z
    .object({
      content_ref: ref,
      content_type: z.enum([
        'product_card',
        'short_video',
        'article',
        'live_script',
      ]),
      status: z.enum(['draft', 'published', 'rejected', 'removed']),
    })
    .strict(),
  'live.completed': z
    .object({
      live_ref: ref,
      viewers: nonNegativeInteger.optional(),
      orders: nonNegativeInteger.optional(),
      gmv_cny: amount.optional(),
    })
    .strict(),
  'service.case_opened': z
    .object({
      case_ref: ref,
      topic: z.enum([
        'product',
        'order',
        'payment',
        'fulfillment',
        'aftersales',
        'other',
      ]),
      priority: z.enum(['low', 'normal', 'high']).default('normal'),
    })
    .strict(),
  'service.case_resolved': z
    .object({
      case_ref: ref,
      outcome: z.enum(['resolved', 'escalated', 'closed']),
    })
    .strict(),
  'order.created': z
    .object({
      order_ref: ref,
      item_count: nonNegativeInteger.optional(),
      amount_cny: amount.optional(),
    })
    .strict(),
  'order.status_changed': z
    .object({
      order_ref: ref,
      status: z.enum(['pending_payment', 'paid', 'cancelled', 'completed']),
    })
    .strict(),
  'fulfillment.updated': z
    .object({
      order_ref: ref,
      status: z.enum([
        'pending',
        'processing',
        'shipped',
        'delivered',
        'exception',
      ]),
    })
    .strict(),
  'aftersales.case_opened': z
    .object({
      case_ref: ref,
      reason: z.enum([
        'refund',
        'return',
        'exchange',
        'quality',
        'delivery',
        'other',
      ]),
    })
    .strict(),
  'aftersales.case_resolved': z
    .object({
      case_ref: ref,
      outcome: z.enum([
        'refunded',
        'returned',
        'exchanged',
        'rejected',
        'escalated',
      ]),
    })
    .strict(),
  'member.lifecycle_changed': z
    .object({
      segment: z.enum(['new', 'active', 'at_risk', 'repeat', 'inactive']),
      change: z.enum(['entered', 'left', 'updated']),
      count: nonNegativeInteger.optional(),
    })
    .strict(),
  'analytics.insight_recorded': z
    .object({
      stage: z.enum([
        'assortment',
        'marketing',
        'content',
        'service',
        'transaction',
        'fulfillment',
        'aftersales',
      ]),
      metric: z.string().trim().min(1).max(80),
      direction: z.enum(['up', 'down', 'flat', 'attention']),
    })
    .strict(),
} satisfies Record<(typeof COMMERCE_EVENT_TYPES)[number], z.ZodType>;

export const CommerceStoreCreateSchema = z.object({
  workspace_jid: z.string().trim().min(1).max(512),
  platform_id: z.literal('internal_software'),
  display_name: z.string().trim().min(1).max(100),
  external_store_ref: z
    .string()
    .trim()
    .max(128)
    .regex(/^(?:|[A-Za-z][A-Za-z0-9._:-]*)$/)
    .optional()
    .default(''),
});

export const CommerceStorePatchSchema = z
  .object({
    display_name: z.string().trim().min(1).max(100).optional(),
    status: z.enum(['active', 'paused']).optional(),
  })
  .strict();

export const CommerceEventCreateSchema = z
  .object({
    event_id: ref,
    event_type: z.enum(COMMERCE_EVENT_TYPES),
    occurred_at: z.string().datetime({ offset: true }),
    data: z.record(z.string(), z.unknown()),
  })
  .strict()
  .superRefine((event, context) => {
    const parsed = eventDataSchemas[event.event_type].safeParse(event.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({ ...issue, path: ['data', ...issue.path] });
      }
    }
  });

export function normalizeCommerceEventData(
  eventType: (typeof COMMERCE_EVENT_TYPES)[number],
  data: Record<string, unknown>,
): Record<string, unknown> {
  return eventDataSchemas[eventType].parse(data) as Record<string, unknown>;
}
