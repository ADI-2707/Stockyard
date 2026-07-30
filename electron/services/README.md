# electron/services/

This folder contains background/system-level services that run in the Electron main process independent of any single IPC request — things that need to happen on a schedule, touch the OS (dialogs, files), or push events to the UI unprompted.

## Responsibilities

- Periodically scan stock levels and generate/update low-stock alerts
- Notify the renderer when new alerts are produced
- Export table data to CSV via a native OS save dialog
- Handle database backups and related file-system operations

## Structure (by responsibility)

```
services/
├── alertEngine        # Scheduled job that scans stock levels and creates/updates alerts
├── notifier            # Pushes alert/update events to the renderer (e.g. `alerts:updated`)
└── csvExporter          # Handles native save dialogs and writes exported CSV files
```

> Exact filenames may vary — this reflects the three logical services described in the project's IPC surface (alert scanning, alert notification, and CSV export).

## Alert engine

- Runs on a configurable interval (read/write via `settings:getSchedulerInterval` / `settings:setSchedulerInterval`).
- On each run, queries current stock levels via `database/queries` and compares them against configured thresholds.
- Creates new alerts or updates existing ones through the `alerts` query handlers.
- Can also be triggered on demand via `settings:runAlertScan`, independent of the schedule.

## Notifier

- Emits the `alerts:updated` event to the renderer whenever the alert engine produces or changes alerts, so the UI can refresh without polling.

## CSV exporter

- Handles the `csv:export` IPC channel.
- Opens a native OS save dialog (via Electron's `dialog` module) and writes the requested table data (items, transactions, etc.) to a CSV file at the chosen location.

## Backups & data reset

- `settings:backupDB` copies the live `inventory.db` file to a user-chosen location as a raw SQLite backup.
- `settings:resetData` wipes and reinitializes the database — used for factory-reset style flows.

## Design principles

- **Independent of window focus**: the alert engine keeps running even if no renderer window is currently focused, since it's driven by `setInterval`/scheduling in the main process, not user interaction.
- **Services call into `database/queries`**, never the raw SQLite connection directly, keeping data access centralized.
- **All OS-level side effects (dialogs, file I/O) live here**, not in `database/` or `main.ts`, so main.ts stays focused on wiring IPC handlers.

## Adding a new background service

1. Create a new file under `services/` for the service's logic.
2. Import and start/register it from `main.ts` during app startup (e.g. `app.whenReady()`).
3. If it needs to expose a control surface (start/stop/config) to the UI, add the relevant IPC channels in `main.ts` and `preload.ts`.
