# Session input capture follow-up

Request captures retain the beginning of each body, so new messages at the end of long session histories may be missing. Consider retaining a bounded tail, or storing per-request message deltas with session-level system prompts, tools, and reminders deduplicated by hash. This requires a separate capture and storage change.
