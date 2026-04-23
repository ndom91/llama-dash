# Attribution and Sessions MVP Spec

## Goal

Add attribution capture and session grouping primitives so operators can understand:

- which client generated requests
- which end user a request belongs to
- which requests belong to the same session / conversation / agent run

This work should improve observability and operator usefulness without turning `llama-dash` into a full analytics platform.

## Product Placement

This should be a new top-level page:

- **Attribution**

Rationale:

- it will likely grow beyond a single config card
- it is not just policy enforcement
- it is closer to observability / metadata capture than to aliases or request limits

## User Problem

Operators can currently inspect individual requests, but they cannot easily answer:

- which app generated this traffic?
- which end user is causing the load?
- which requests belong to one agent session?
- how do I filter logs for a specific session or client?

## MVP Scope

The MVP should focus on **capture and visibility**, not full analytics.

### Capture fields

Support configurable capture from incoming request headers into three normalized fields:

- `client_name`
- `end_user_id`
- `session_id`

### Example incoming headers

- `x-client-name`
- `x-end-user-id`
- `x-session-id`

The exact header names should be configurable on the Attribution page.

## Non-Goals

Not in MVP:

- identity provider integration
- user directory management
- full session analytics dashboards
- cross-request trace visualizations
- retention policies per attribution dimension
- RBAC around attribution settings

## Core Product Principle

Normalize arbitrary incoming client metadata into a small stable internal schema.

That gives us:

- consistent request filtering
- future session grouping
- future aggregated analytics

without storing an open-ended mess of random headers everywhere in the UI.

## Data Model

Add nullable request fields for:

- `clientName`
- `endUserId`
- `sessionId`

These should be persisted on each request row at log time.

## Attribution Settings Model

Store operator-defined mapping config such as:

```ts
type AttributionSettings = {
  clientNameHeader: string | null
  endUserIdHeader: string | null
  sessionIdHeader: string | null
}
```

Possible defaults:

- `x-client-name`
- `x-end-user-id`
- `x-session-id`

## Capture Semantics

For each incoming request:

1. read configured header names
2. extract matching header values if present
3. normalize them to internal request fields
4. persist them with the request log record

If a header is missing, store `null`.

If attribution settings are unset, no attribution is captured.

## Normalization Rules

MVP rules:

- trim whitespace
- empty string becomes `null`
- do not parse or split values further
- do not validate as UUIDs or any special format in v1

This keeps the system permissive and easy to adopt.

## UI Spec

### Attribution page

Top-level page with:

1. explanation of what attribution is for
2. settings form for header mapping
3. examples / copyable docs snippet

### Settings form

Fields:

- Client name header
- End-user ID header
- Session ID header

Each accepts a header name like:

- `x-client-name`
- `x-session-id`

### Empty state copy

Should explain:

- these headers are optional
- clients can start sending them immediately once configured
- captured values will appear in requests UI and request detail

## Requests UI Changes

### Request detail

Show captured attribution fields in the summary rail or a new attribution section:

- client
- end user
- session

### Request list filters

Add filter support for:

- client name
- end-user ID
- session ID

MVP can start with session ID if we want to stay very small, but the capture model should support all three from day one.

## Sessions MVP

Session grouping should start very small.

### Minimum session features

- requests list filter by `session_id`
- request detail showing `session_id`
- request detail link to view other requests in the same session

### Optional small enhancement

On request detail:

- show count of sibling requests in same session
- link to filtered request list view

This avoids needing a dedicated session detail page in v1.

## API / Persistence

Need:

- settings read/update endpoints for attribution config
- request schema updates for persisted fields
- request list API filters for the new fields

## Example Flow

A client sends:

```http
POST /v1/chat/completions
X-Client-Name: claude-code
X-End-User-Id: alice
X-Session-Id: session_123
```

`llama-dash` stores:

- `clientName = "claude-code"`
- `endUserId = "alice"`
- `sessionId = "session_123"`

Operators can then:

- filter request logs by `session_123`
- inspect all requests associated with Alice
- separate Claude Code traffic from other clients

## Why This Matters

This directly improves observability without needing a huge analytics investment.

It also lays groundwork for later features like:

- session timelines
- grouped request views
- per-client dashboards
- end-user usage summaries

## Suggested Delivery Phases

### Phase 1

- new Attribution page
- settings for header mappings
- request log persistence of client/end-user/session fields
- request detail display
- request list filters

### Phase 2

- session-linked navigation from request detail
- session-filter quick links
- grouped session views

## Open Questions

1. Should we support one header per field only, or allow fallback header lists in v1?
2. Should these fields be shown in the request list table immediately, or only as filters/detail metadata?
3. Do we want a dedicated `/sessions/:id` page later, or is a filtered requests list enough?

## Recommendation

Keep MVP focused on:

- capture
- persistence
- request filtering
- request detail visibility

Then add grouped session navigation once real usage confirms the need.
