# electron/

The **Electron Main Process** for Stockyard — the Node.js side that owns the window, the SQLite database, and every privileged operation. The React UI in `src/` never touches the database or filesystem directly; it only talks to this process over IPC through `preload.ts`.

## Structure

```
electron/
├── database/
│   ├── connection.ts   # Opens the SQLite connection, runs Drizzle migrations, cleans up legacy timestamps
│   ├── schema.ts       # Drizzle table schema (categories, items, transactions, alerts, bomTemplates, bomItems) + indexes
│   └── queries/        # Query handlers grouped by domain: categories, items, transactions, alerts, bom
├── services/
│   ├── scheduler.ts    # Starts/stops the recurring alert-scan interval, tracks the current interval in minutes
│   ├── alertEngine.ts  # Scans all items and generates/resolves LOW_STOCK, OUT_OF_STOCK, AGING alerts
│   ├── notifier.ts     # Fires native OS notifications (Electron Notification API)
│   └── csvExport.ts    # Native save dialog + CSV writer used by the csv:export channel
├── main.ts             # App entrypoint: creates the BrowserWindow and registers every ipcMain.handle channel
└── preload.ts           # contextBridge script — exposes window.electron.{invoke, on} with a hardcoded channel allowlist
```

## Responsibilities

- Boot the app, create a single `BrowserWindow` (1100×750, min 900×650), and load Vite's dev server or the built `dist/index.html`
- Run Drizzle migrations from the `drizzle/` folder on every startup (`runMigrations()` in `connection.ts`)
- Register every IPC handler used by the app (see table below)
- Run the recurring alert-scan job (`scheduler.ts` + `alertEngine.ts`), started with a 10-minute interval on app ready and re-startable via `settings:setSchedulerInterval`
- Push live updates to the renderer (`alerts:updated` event) whenever alert state changes, from stock adjustments, item mutations, or the scheduled scan
- Expose only an explicit allowlist of IPC channels to the renderer via `preload.ts`'s `contextBridge` — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`

## IPC handlers registered in `main.ts`

| Group | Channels |
|---|---|
| Categories | `categories:getAll`, `categories:create`, `categories:update`, `categories:delete` |
| Items | `items:getAll`, `items:getFiltered`, `items:searchAutocomplete`, `items:getLocations`, `items:getSimpleList`, `items:getById`, `items:create`, `items:update`, `items:adjustStock`, `items:delete` |
| Transactions | `transactions:getAll`, `transactions:getFiltered`, `transactions:getOperators`, `transactions:getByItem` |
| Alerts | `alerts:getActive`, `alerts:getResolved`, `alerts:acknowledge`, `alerts:resolve`, `alerts:updated` (pushed event, not invoked) |
| BOM | `bom:getAll`, `bom:getDetails`, `bom:create`, `bom:update`, `bom:delete`, `bom:checkCoverage` |
| CSV | `csv:export` |
| Settings | `settings:getSchedulerInterval`, `settings:setSchedulerInterval`, `settings:runAlertScan`, `settings:backupDB`, `settings:resetData` |

Note: `items:create`, `items:update`, `items:adjustStock`, and `items:delete` each re-run `runAlertScan()` immediately after the write so alert state stays current without waiting for the next scheduled scan.

## Data location

The SQLite file (`inventory.db`) lives in Electron's `userData` path (via `app.getPath('userData')`), e.g. on Windows `C:\Users\<Username>\AppData\Roaming\stockyard\inventory.db`. `settings:backupDB` copies this file to a location chosen via a native save dialog; `settings:resetData` deletes rows from selected tables inside a single Drizzle transaction.

## Adding a new IPC endpoint

1. Add the query/mutation function to the relevant file in `database/queries/`.
2. Import it in `main.ts` and register `ipcMain.handle('<channel>', ...)`.
3. Add the channel name to `ALLOWED_CHANNELS` in `preload.ts`.
4. Add a matching wrapper in `src/lib/ipc.ts` so the renderer can call it.
