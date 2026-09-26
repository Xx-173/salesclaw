import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Check,
  CircleAlert,
  Clipboard,
  PlugZap,
  Plus,
  RefreshCw,
  Store,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/api/client';

interface CommercePlatform {
  id: string;
  name: string;
  category: 'first_party' | 'store' | 'content' | 'ads';
  status: 'available' | 'planned';
  summary: string;
  availableCapabilities: string[];
  plannedCapabilities: string[];
}

interface CommerceCatalog {
  lifecycle_stages: Array<{ id: string; label: string; order: number }>;
  event_types: Record<string, string>;
  platforms: CommercePlatform[];
}

interface CommerceStore {
  id: string;
  workspace_jid: string;
  platform_id: string;
  display_name: string;
  external_store_ref: string;
  status: 'active' | 'paused';
  created_at: string;
  updated_at: string;
}

interface CommerceEvent {
  id: string;
  source_event_id: string;
  event_type: string;
  lifecycle_stage: string;
  occurred_at: string;
  data: Record<string, unknown>;
}

interface CommerceOverview {
  store: CommerceStore;
  stages: Array<{
    id: string;
    label: string;
    order: number;
    event_count: number;
    latest_at: string | null;
  }>;
  recent_events: CommerceEvent[];
}

interface WorkspaceOption {
  jid: string;
  name: string;
  can_modify?: boolean;
}

const categoryLabels: Record<CommercePlatform['category'], string> = {
  first_party: '自研系统',
  store: '店铺渠道',
  content: '内容渠道',
  ads: '营销渠道',
};

function formatTime(value: string | null): string {
  if (!value) return '暂无事件';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function presentValue(value: unknown): string {
  if (typeof value === 'number') return value.toLocaleString('zh-CN');
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? '是' : '否';
  return '';
}

export function CommercePage() {
  const [catalog, setCatalog] = useState<CommerceCatalog | null>(null);
  const [stores, setStores] = useState<CommerceStore[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [overview, setOverview] = useState<CommerceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [externalStoreRef, setExternalStoreRef] = useState('');
  const [workspaceJid, setWorkspaceJid] = useState('');
  const [newToken, setNewToken] = useState('');
  const [copied, setCopied] = useState(false);

  const loadStores = useCallback(async () => {
    const response = await api.get<{ stores: CommerceStore[] }>(
      '/api/commerce/stores',
    );
    setStores(response.stores);
    setSelectedStoreId((current) =>
      current && response.stores.some((store) => store.id === current)
        ? current
        : (response.stores[0]?.id ?? ''),
    );
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCatalog, nextStores, nextWorkspaces] = await Promise.all([
        api.get<CommerceCatalog>('/api/commerce/catalog'),
        api.get<{ stores: CommerceStore[] }>('/api/commerce/stores'),
        api.get<{ workspaces: WorkspaceOption[] }>('/api/workspaces'),
      ]);
      setCatalog(nextCatalog);
      setStores(nextStores.stores);
      setWorkspaces(
        nextWorkspaces.workspaces.filter((item) => item.can_modify),
      );
      setSelectedStoreId((current) =>
        current && nextStores.stores.some((store) => store.id === current)
          ? current
          : (nextStores.stores[0]?.id ?? ''),
      );
    } catch {
      setError('加载电商运营数据失败，请检查连接后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!selectedStoreId) {
      setOverview(null);
      return;
    }
    let cancelled = false;
    api
      .get<CommerceOverview>(
        `/api/commerce/stores/${encodeURIComponent(selectedStoreId)}/overview`,
      )
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch(() => {
        if (!cancelled) setError('加载店铺全链路数据失败。');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId]);

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId) ?? null,
    [selectedStoreId, stores],
  );

  const createStore = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspaceJid || !displayName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.post<{
        store: CommerceStore;
        ingest_token: string;
      }>('/api/commerce/stores', {
        workspace_jid: workspaceJid,
        platform_id: 'internal_software',
        display_name: displayName.trim(),
        external_store_ref: externalStoreRef.trim(),
      });
      setNewToken(result.ingest_token);
      setSelectedStoreId(result.store.id);
      setDisplayName('');
      setExternalStoreRef('');
      setShowCreate(false);
      await loadStores();
    } catch {
      setError(
        '创建自研软件店铺失败；请确认 Workspace 可修改，且店铺标识未重复。',
      );
    } finally {
      setSaving(false);
    }
  };

  const rotateToken = async () => {
    if (!selectedStore) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.post<{ ingest_token: string }>(
        `/api/commerce/stores/${encodeURIComponent(selectedStore.id)}/rotate-ingest-token`,
      );
      setNewToken(result.ingest_token);
      setCopied(false);
    } catch {
      setError('更新接入凭据失败。');
    } finally {
      setSaving(false);
    }
  };

  const toggleStore = async () => {
    if (!selectedStore) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(
        `/api/commerce/stores/${encodeURIComponent(selectedStore.id)}`,
        {
          status: selectedStore.status === 'active' ? 'paused' : 'active',
        },
      );
      await loadStores();
      const nextOverview = await api.get<CommerceOverview>(
        `/api/commerce/stores/${encodeURIComponent(selectedStore.id)}/overview`,
      );
      setOverview(nextOverview);
    } catch {
      setError('更新店铺接入状态失败。');
    } finally {
      setSaving(false);
    }
  };

  const copyToken = async () => {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const platforms = catalog?.platforms ?? [];
  const stages =
    overview?.stages ??
    catalog?.lifecycle_stages.map((stage) => ({
      ...stage,
      event_count: 0,
      latest_at: null,
    })) ??
    [];
  const totalEvents = stages.reduce((sum, stage) => sum + stage.event_count, 0);

  return (
    <div className="min-h-full bg-background p-4 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="电商运营"
          subtitle="国内多渠道零售全链路：商品、营销、内容、客服、订单、履约、售后与经营分析"
          actions={
            <Button
              variant="outline"
              onClick={() => void loadPage()}
              disabled={loading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              刷新
            </Button>
          }
        />

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Card className="border-primary/20 bg-primary/[0.035]">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <Activity className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">全链路业务面板</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  按店铺 Workspace
                  汇总自研软件推送的规范化业务事件。没有事件时显示空状态，不生成示例经营指标。
                </p>
              </div>
            </div>
            <Link
              to="/capabilities/mcp"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              配置 Agent 工具连接 <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>店铺与工作区</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setWorkspaceJid(workspaces[0]?.jid ?? '');
                  setShowCreate((current) => !current);
                  setNewToken('');
                }}
                disabled={workspaces.length === 0}
              >
                <Plus className="mr-1 h-4 w-4" /> 添加
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {showCreate && (
                <form
                  onSubmit={createStore}
                  className="space-y-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      店铺名称
                    </label>
                    <Input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      maxLength={100}
                      required
                      placeholder="例如：直营网店"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      关联 Workspace
                    </label>
                    <select
                      value={workspaceJid}
                      onChange={(event) => setWorkspaceJid(event.target.value)}
                      required
                      className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                    >
                      {workspaces.map((workspace) => (
                        <option key={workspace.jid} value={workspace.jid}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      自研软件中的店铺标识（可选）
                    </label>
                    <Input
                      value={externalStoreRef}
                      onChange={(event) =>
                        setExternalStoreRef(event.target.value)
                      }
                      maxLength={128}
                      placeholder="内部店铺 ID"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCreate(false)}
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={saving || !workspaceJid}
                    >
                      {saving ? '创建中…' : '创建店铺'}
                    </Button>
                  </div>
                </form>
              )}

              {stores.length === 0 && !showCreate ? (
                <div className="rounded-lg border border-dashed border-border p-5 text-center">
                  <Store className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium">还没有接入店铺</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    添加一个自研软件店铺，开始接收全链路业务事件。
                  </p>
                  {workspaces.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      请先创建可修改的 Workspace。
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {stores.map((store) => (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => {
                        setSelectedStoreId(store.id);
                        setNewToken('');
                      }}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedStoreId === store.id ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {store.display_name}
                        </span>
                        <Badge
                          variant={
                            store.status === 'active' ? 'success' : 'neutral'
                          }
                        >
                          {store.status === 'active' ? '已启用' : '已暂停'}
                        </Badge>
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {workspaces.find(
                          (item) => item.jid === store.workspace_jid,
                        )?.name ?? 'Workspace'}{' '}
                        · 自研软件
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {newToken && selectedStore && (
              <Card className="border-warning/40 bg-warning/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">一次性接入凭据</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    该凭据只显示这一次。复制给自研软件的服务端并安全保存；需要重新显示时请轮换凭据，旧凭据会立即失效。
                  </p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={newToken}
                      className="font-mono text-xs"
                    />
                    <Button variant="outline" onClick={() => void copyToken()}>
                      {copied ? (
                        <Check className="mr-1 h-4 w-4" />
                      ) : (
                        <Clipboard className="mr-1 h-4 w-4" />
                      )}
                      {copied ? '已复制' : '复制'}
                    </Button>
                  </div>
                  <code className="block break-all rounded bg-muted p-2 text-xs">
                    POST /api/commerce/ingest/{selectedStore.id}/events
                  </code>
                </CardContent>
              </Card>
            )}

            {selectedStore && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    当前店铺：{selectedStore.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    累计接收 {totalEvents.toLocaleString('zh-CN')} 条规范化事件
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void toggleStore()}
                    disabled={saving}
                  >
                    {selectedStore.status === 'active'
                      ? '暂停接入'
                      : '恢复接入'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void rotateToken()}
                    disabled={saving}
                  >
                    <RefreshCw className="mr-1 h-4 w-4" /> 轮换接入凭据
                  </Button>
                </div>
              </div>
            )}

            <section aria-label="国内零售业务全链路">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">业务全链路</h2>
                <span className="text-xs text-muted-foreground">
                  按事件归属汇总
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {stages.map((stage) => (
                  <Card key={stage.id} size="sm">
                    <CardContent className="flex items-start justify-between gap-3 px-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{stage.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          最近活动：{formatTime(stage.latest_at)}
                        </p>
                      </div>
                      <span className="rounded-md bg-muted px-2 py-1 text-sm font-semibold tabular-nums">
                        {stage.event_count}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>最近业务活动</CardTitle>
              </CardHeader>
              <CardContent>
                {!overview?.recent_events.length ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {selectedStore
                      ? '尚未收到业务事件。连接自研软件后，这里会显示真实的商品、订单、直播、客服和售后活动。'
                      : '选择或创建店铺后查看链路活动。'}
                  </div>
                ) : (
                  <ol className="divide-y divide-border">
                    {overview.recent_events.map((event) => (
                      <li
                        key={event.id}
                        className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {catalog?.event_types[event.event_type] ??
                              event.event_type}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {event.lifecycle_stage} ·{' '}
                            {formatTime(event.occurred_at)}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {Object.entries(event.data).map(([key, value]) => (
                              <span
                                key={key}
                                className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground"
                              >
                                {key}: {presentValue(value)}
                              </span>
                            ))}
                          </div>
                        </div>
                        <code className="shrink-0 text-[10px] text-muted-foreground">
                          {event.source_event_id}
                        </code>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">平台连接器</h2>
            <span className="text-xs text-muted-foreground">
              能力按平台授权逐项启用
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {platforms.map((platform) => (
              <Card key={platform.id} size="sm">
                <CardContent className="space-y-3 px-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <PlugZap className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {platform.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {categoryLabels[platform.category]}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        platform.status === 'available' ? 'success' : 'warning'
                      }
                    >
                      {platform.status === 'available' ? '可接入' : '预留'}
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {platform.summary}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(platform.availableCapabilities.length
                      ? platform.availableCapabilities
                      : platform.plannedCapabilities.slice(0, 4)
                    ).map((capability) => (
                      <span
                        key={capability}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>岗位 Agent 与工具</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-3xl text-sm text-muted-foreground">
              在 Agent Profile
              中配置选品/商品、营销、内容直播、客服、订单履约、售后和经营分析岗位；在
              Workspace 的 MCP 能力中连接自研软件提供的查询与动作
              API。高影响动作应配置人工审批。
            </p>
            <div className="flex shrink-0 gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/agent-profiles">配置岗位 Agent</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/capabilities/mcp">配置工具 API</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
