# Domestic Commerce Digital Employee Platform

## Product scope

SalesClaw provides the Agent runtime and governance foundation for a domestic
multi-channel commerce operation platform. The business lifecycle is represented
as:

```text
Planning → Assortment and Catalog → Marketing → Content and Live Commerce
→ Customer Service → Transaction → Fulfillment → Aftersales and Repeat Purchase
→ Business Analytics
```

Each role is configured as an Agent Profile. A Workspace is the access boundary
for the store's tools, files, sessions, and commerce events. Runtime sessions
retain task context within that Workspace. Existing Workspace ACL checks are
also applied to store creation, event access, and store management.

## Integration status

The first-party connector is an authenticated event-ingest API. A store is
bound to a user-owned Workspace. Store creation returns a high-entropy bearer
token once; only its SHA-256 hash is persisted. Rotating the token immediately
invalidates the previous value. Events are scoped to their store, deduplicated
by the source event ID, and limited to 16 KB.

The event contract stores normalized business references and aggregate values.
It rejects undeclared fields, so raw chat text, customer names, contact details,
addresses, and payment credentials are not part of the event payload. The
connected business system remains the source of detailed customer and order
records; Agents should access those records through explicitly configured
Workspace MCP tools.

Third-party platforms appear in the connector catalog as planned until a
platform-specific adapter, authorization flow, and capability mapping have
been implemented. The catalog separates store, content, and advertising
connectors because those products do not share one API surface. Zhihu is
modeled as a content/marketing source, and Baidu Smart Program and Baidu
Marketing are distinct connector entries.

## API

All control-plane endpoints use the existing authenticated session and
Workspace ACL:

- `GET /api/commerce/catalog`
- `GET|POST /api/commerce/stores`
- `PATCH|DELETE /api/commerce/stores/:storeId`
- `POST /api/commerce/stores/:storeId/rotate-ingest-token`
- `GET /api/commerce/stores/:storeId/overview`
- `GET /api/commerce/stores/:storeId/events?limit=100`

The first-party software pushes events with the one-time bearer token:

- `POST /api/commerce/ingest/:storeId/events`
- Header: `Authorization: Bearer <integration token>`

Reusing an event ID with identical content is an idempotent duplicate. Reusing
it with different content returns `409` and leaves the original event intact.

Example event:

```json
{
  "event_id": "order-event-unique-id",
  "event_type": "order.created",
  "occurred_at": "2026-09-26T09:30:00.000Z",
  "data": {
    "order_ref": "internal-order-reference",
    "item_count": 2,
    "amount_cny": 299
  }
}
```

Events are idempotent by `(store_id, event_id)`. A duplicate returns the
original event without creating a second row. Store deletion removes that
store's event history, and deleting its Workspace removes the associated store
and events.

## Model evaluation and routing

The existing ProviderPool offers round-robin, weighted round-robin, health
tracking, and failover. It does not yet select a model from commerce benchmark
scores, task quality, latency, or token cost. A commerce benchmark should use
fixed cases for product analysis, campaign reporting, content review, customer
service, order/fulfillment status, aftersales triage, and lifecycle analytics.
Track task completion, policy adherence, tool-call correctness, stability,
latency, and token cost before adding score-based routing.

External write actions such as publishing content, changing campaigns, issuing
refunds, or sending customer promises remain subject to the connected tool's
permissions and a human approval workflow.
