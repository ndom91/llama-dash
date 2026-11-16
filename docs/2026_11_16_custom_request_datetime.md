# Request timeframe picker

The request log uses one Base UI Popover with a preset column and a permanently
visible, themed DayPicker range calendar. Base UI handles positioning, dismissal
and focus restoration; `@daypicker/react` supplies the calendar grid, month
navigation and date keyboard behavior because Base UI 1.9 has no calendar primitive.
The old nested date/time popovers and Number Fields have been removed.

The picker defaults to Last 3 hours. Presets include 15 minutes, 1/3/24 hours,
7/30 days, Today, Yesterday and All retained. Clicking a preset or pressing Enter
applies it immediately. Arrow keys, Home/End and shortcut typeahead move through
presets; Tab moves into the calendar. The segmented trigger shows the selected
preset and its resolved window, omitting clocks for ranges longer than seven days.

Preset dates/times are read-only previews. Clicking a calendar day starts a custom
draft and clears its end. Hovering or focusing another day previews the range
with a continuous tinted band and thin top/bottom edges; clicking completes it
and focuses To time. A completed endpoint click starts over. Future days and days outside retained history are unavailable.
The compact date fields accept `Nov 16, 2026`; time fields accept 24-hour `HH:mm`.
Apply validates and writes epoch-millisecond bounds to the URL. Cancel, Escape
and outside clicks discard unapplied edits. Request-row shortcuts stay inactive
inside the picker, including its portaled content.

Drafts retain local wall-clock strings until confirmation, so invalid dates and
DST gaps are rejected without normalization. Repeated times use the first
occurrence; the end is exclusive. These details live in the timezone tooltip.
Today and Yesterday resolve to absolute bounds in the browser before all list,
count and histogram requests, avoiding the server timezone and preserving 23/25
hour calendar days across clock changes. Named presets remain in shareable URLs.

References: [Base UI Popover](https://base-ui.com/react/components/popover),
[DayPicker accessibility](https://daypicker.dev/guides/accessibility).
