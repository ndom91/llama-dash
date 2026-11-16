# Custom request date and time controls

The request timeframe's Start and End fields use a shared `DateTimePicker`:
Base UI Popover handles nesting, dismissal, positioning and focus restoration;
Base UI Number Field supplies the hour/minute controls. Base UI 1.9 has no public
calendar primitive, so `@daypicker/react` 10.0.2 supplies the calendar grid,
month navigation and date keyboard behavior. Styling uses the existing theme
tokens and Tailwind classes, without the library's default stylesheet.

The component edits local wall-clock strings rather than converting each draft
to an instant. Picking a day preserves the clock, and editing the clock preserves
the day. This prevents a daylight-saving gap from silently moving a selection to
another hour. The existing form parser rejects skipped times, missing fields and
reversed ranges; repeated times retain the first occurrence and end is exclusive.

Done or Escape closes only the nested calendar and returns focus to its field.
Apply range validates and writes the final epoch-millisecond range to the URL.
The request page ignores its row shortcuts while focus is within a date/time
control, including its portaled calendar.

References: [Base UI Popover](https://base-ui.com/react/components/popover),
[Base UI Number Field](https://base-ui.com/react/components/number-field),
[DayPicker accessibility](https://daypicker.dev/guides/accessibility).
