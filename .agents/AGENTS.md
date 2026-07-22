# Custom UI Rules

## Native Dialogs
- Do NOT use browser native dialogs (`alert()`, `confirm()`, `prompt()`) unless it is absolutely necessary (e.g. destructive actions like deletion confirmation).
- Prefer using custom modal overlays, custom toast messages, or on-page status indicators to display alerts, warnings, info, and success messages to the user.

## Script Organization & Git Rules
- Organize scripts, temporary code, scratchpads, debug/test utilities into dedicated subdirectories like `scratch/`, `test/`, `debug/` instead of dumping them directly in the workspace root or core application directories.
- These utility/scratch directories must not contain core files required for the application's runtime.
- Always ensure all temporary scripts, cookie files, credentials, local media caches, and user profiles are added to `.gitignore` and are not tracked by Git.

## Icon Consistency Rules
- Keep UI icons consistent across all pages and components. Standard action icons (e.g. Play, Pause, Add, Refresh, Delete, Settings) must use identical SVG representations and styling across all views (Sync, Playlists, Library, Discover, and Bottom Audio Player).

