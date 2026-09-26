import type { CommerceEventType, CommerceLifecycleStageId } from './catalog.js';

export interface CommerceStore {
  id: string;
  owner_user_id: string;
  workspace_jid: string;
  platform_id: 'internal_software';
  display_name: string;
  external_store_ref: string;
  status: 'active' | 'paused';
  created_at: string;
  updated_at: string;
}

export interface CommerceEvent {
  id: string;
  store_id: string;
  owner_user_id: string;
  workspace_jid: string;
  source_event_id: string;
  event_type: CommerceEventType;
  lifecycle_stage: CommerceLifecycleStageId;
  occurred_at: string;
  data: Record<string, unknown>;
  created_at: string;
}
