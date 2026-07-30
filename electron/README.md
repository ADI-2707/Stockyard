# electron/

This folder contains the **Electron Main Process** code for Stockyard — the Node.js-side "server" that owns the filesystem, the SQLite database, and all privileged operations. The React UI in `src/` never talks to the database directly; it only talks to this process over IPC.

## Responsibilities

- Boot the Electron app and create the application window
- Open and migrate the local SQLite database
- Register all IPC handlers (the app's internal API surface)
- Run background services (low-stock alert scanning, CSV export, backups)
- Bridge a safe, whitelisted API to the renderer via a preload script

## Structure

```
electron/
├── database/
│   ├── connection.ts   # Opens the SQLite connection and runs Drizzle migrations on startup
│   ├── schema.ts       # Drizzle table schema definitions and indexes
│   └── queries/        # Query handlers grouped by domain (items, transactions, alerts, BOM, etc.)
├── services/            # Scheduled alert engine, notifier, and CSV exporter
├── main.ts              # Electron entrypoint — creates the window and registers all IPC channels
└── preload.ts            # contextBridge script exposing a safe API to the renderer (src/)
```

## Architecture notes

- **Process isolation**: the renderer runs sandboxed with no direct filesystem or Node access. Every privileged action goes through `preload.ts`'s `contextBridge`-exposed API and is handled here via `ipcMain`.
- **Database layer**: `connection.ts` initializes `better-sqlite3` and runs any pending Drizzle migrations before the app is ready. `schema.ts` defines tables and indexes on frequently filtered/sorted columns (`sku`, `name`, `categoryId`, `location`, `deletedAt`, `createdAt`).
- **Filtering/pagination happens here, not in the UI**: handlers under `database/queries/` do the SQL filtering, sorting, and `LIMIT`/`OFFSET` pagination (page size 100), so the renderer only ever receives the slice it needs to render.
- **Background services**: `services/` runs a scheduled job that scans stock levels and generates/updates low-stock alerts, independent of whether a UI window is focused.

## IPC channel groups registered in `main.ts`

| Group | Examples |
|---|---|
| Categories | `categories:getAll`, `categories:create`, `categories:update`, `categories:delete` |
| Items | `items:getAll`, `items:getFiltered`, `items:searchAutocomplete`, `items:getById`, `items:create`, `items:update`, `items:adjustStock`, `items:delete` |
| Transactions | `transactions:getAll`, `transactions:getFiltered`, `transactions:getByItem`, `transactions:getOperators` |
| Alerts | `alerts:getActive`, `alerts:getResolved`, `alerts:acknowledge`, `alerts:resolve`, `alerts:updated` (event) |
| BOM | `bom:getAll`, `bom:getDetails`, `bom:create`, `bom:update`, `bom:delete`, `bom:checkCoverage` |
| Export / Settings | `csv:export`, `settings:getSchedulerInterval`, `settings:setSchedulerInterval`, `settings:runAlertScan`, `settings:backupDB`, `settings:resetData` |

## Data location

The SQLite database file (`inventory.db`) is created and managed by `database/connection.ts` inside the OS application-data directory, e.g. on Windows: `C:\Users\<Username>\AppData\Roaming\stockyard\inventory.db`.

## Adding a new IPC endpoint

1. Add the query/mutation logic under `database/queries/<domain>.ts`.
2. Register the corresponding `ipcMain.handle('<channel>', ...)` in `main.ts`.
3. Expose the channel through `preload.ts` so it's callable from `src/lib` on the renderer side.
