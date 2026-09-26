export const COMMERCE_LIFECYCLE_STAGES = [
  { id: 'planning', label: '经营规划', order: 1 },
  { id: 'assortment', label: '选品与商品', order: 2 },
  { id: 'marketing', label: '营销与流量', order: 3 },
  { id: 'content', label: '内容与直播', order: 4 },
  { id: 'service', label: '咨询与客服', order: 5 },
  { id: 'transaction', label: '交易与订单', order: 6 },
  { id: 'fulfillment', label: '履约与交付', order: 7 },
  { id: 'aftersales', label: '售后与复购', order: 8 },
  { id: 'analytics', label: '经营分析', order: 9 },
] as const;

export type CommerceLifecycleStageId =
  (typeof COMMERCE_LIFECYCLE_STAGES)[number]['id'];

export const COMMERCE_EVENT_TYPES = [
  'product.updated',
  'campaign.updated',
  'campaign.metrics',
  'content.published',
  'live.completed',
  'service.case_opened',
  'service.case_resolved',
  'order.created',
  'order.status_changed',
  'fulfillment.updated',
  'aftersales.case_opened',
  'aftersales.case_resolved',
  'member.lifecycle_changed',
  'analytics.insight_recorded',
] as const;

export type CommerceEventType = (typeof COMMERCE_EVENT_TYPES)[number];

export const COMMERCE_EVENT_STAGE: Record<
  CommerceEventType,
  CommerceLifecycleStageId
> = {
  'product.updated': 'assortment',
  'campaign.updated': 'marketing',
  'campaign.metrics': 'marketing',
  'content.published': 'content',
  'live.completed': 'content',
  'service.case_opened': 'service',
  'service.case_resolved': 'service',
  'order.created': 'transaction',
  'order.status_changed': 'transaction',
  'fulfillment.updated': 'fulfillment',
  'aftersales.case_opened': 'aftersales',
  'aftersales.case_resolved': 'aftersales',
  'member.lifecycle_changed': 'aftersales',
  'analytics.insight_recorded': 'analytics',
};

export type CommerceIntegrationStatus = 'available' | 'planned';

export interface CommercePlatformDefinition {
  id: string;
  name: string;
  category: 'first_party' | 'store' | 'content' | 'ads';
  status: CommerceIntegrationStatus;
  summary: string;
  availableCapabilities: string[];
  plannedCapabilities: string[];
}

/**
 * The catalog is capability-based because platforms expose different APIs.
 * Only the first-party event-ingest contract is implemented in this release.
 */
export const COMMERCE_PLATFORMS: CommercePlatformDefinition[] = [
  {
    id: 'internal_software',
    name: '自研软件',
    category: 'first_party',
    status: 'available',
    summary: '通过已认证的业务事件 API 接入统一零售事件流。',
    availableCapabilities: ['business_events.ingest'],
    plannedCapabilities: [
      'catalog.read',
      'orders.read',
      'service.read',
      'marketing.read',
      'workflow.actions',
    ],
  },
  {
    id: 'wechat_miniprogram',
    name: '微信小程序',
    category: 'store',
    status: 'planned',
    summary: '预留小程序入口与自有服务端业务 API 的连接器。',
    availableCapabilities: [],
    plannedCapabilities: ['content.read', 'service.read', 'orders.read'],
  },
  {
    id: 'taobao',
    name: '淘宝/天猫',
    category: 'store',
    status: 'planned',
    summary: '预留授权式店铺连接器，具体能力按开放平台授权范围启用。',
    availableCapabilities: [],
    plannedCapabilities: [
      'catalog.read',
      'orders.read',
      'fulfillment.read',
      'aftersales.read',
      'analytics.read',
    ],
  },
  {
    id: 'zhihu',
    name: '知乎',
    category: 'content',
    status: 'planned',
    summary: '预留内容与营销数据连接器，不作为订单数据源。',
    availableCapabilities: [],
    plannedCapabilities: ['content.read', 'content.publish', 'analytics.read'],
  },
  {
    id: 'baidu_smart_program',
    name: '百度智能小程序',
    category: 'store',
    status: 'planned',
    summary: '预留智能小程序连接器，能力按具体 API 与授权确认。',
    availableCapabilities: [],
    plannedCapabilities: ['content.read', 'service.read', 'analytics.read'],
  },
  {
    id: 'baidu_marketing',
    name: '百度营销',
    category: 'ads',
    status: 'planned',
    summary: '预留独立广告数据连接器。',
    availableCapabilities: [],
    plannedCapabilities: ['marketing.read', 'analytics.read'],
  },
];

export const COMMERCE_EVENT_LABELS: Record<CommerceEventType, string> = {
  'product.updated': '商品资料更新',
  'campaign.updated': '营销计划更新',
  'campaign.metrics': '营销数据快照',
  'content.published': '内容发布',
  'live.completed': '直播结束',
  'service.case_opened': '客服问题创建',
  'service.case_resolved': '客服问题处理',
  'order.created': '订单创建',
  'order.status_changed': '订单状态变化',
  'fulfillment.updated': '履约状态变化',
  'aftersales.case_opened': '售后问题创建',
  'aftersales.case_resolved': '售后问题处理',
  'member.lifecycle_changed': '会员阶段变化',
  'analytics.insight_recorded': '经营洞察记录',
};

export function getCommerceStageForEvent(
  eventType: CommerceEventType,
): CommerceLifecycleStageId {
  return COMMERCE_EVENT_STAGE[eventType];
}
