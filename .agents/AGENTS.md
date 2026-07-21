# Custom UI Rules

## Native Dialogs
- Do NOT use browser native dialogs (`alert()`, `confirm()`, `prompt()`) unless it is absolutely necessary (e.g. destructive actions like deletion confirmation).
- Prefer using custom modal overlays, custom toast messages, or on-page status indicators to display alerts, warnings, info, and success messages to the user.
