# Session input capture follow-up

Request and text response bodies are stored in full by default, so new session messages remain available while payloads are retained. Explicitly configured body size limits still truncate captures. Payload retention defaults to three days; older truncated or expired bodies cannot be recovered. As a separate future optimization, consider storing per-request message deltas with session-level system prompts, tools, and reminders deduplicated by hash.
