<div align="center">

# 📦 Stockyard

**Offline-first desktop inventory tracker for panel & body manufacturing component tracking.**

Built with Electron, React, and a local SQLite database — no server, no internet connection, no monthly bill. Just fast, indexed, reliable inventory control that lives on the shop floor's own machine.

![Platform](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-local--first-003B57?logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/status-internal--tool-lightgrey)

</div>

---

## Overview

Stockyard was built to replace manual spreadsheet reconciliation for tracking physical components on a manufacturing floor — panels, body parts, fasteners, sub-assemblies — with a single-file, installable desktop application that works entirely offline. It reduced manual reconciliation effort by up to **66%** by moving stock counts, low-stock alerts, and bill-of-materials coverage checks out of shared spreadsheets and into a real, indexed, transactional database with a purpose-built UI.

It runs as a native Windows desktop app: double-click, no login, no cloud dependency, no internet required. All data lives in a single SQLite file on the machine it's installed on.

---

## Why it exists

Spreadsheet-based inventory tracking on a manufacturing floor breaks down in predictable ways:

- No enforced structure — two people can name the same SKU differently, or overwrite each other's edits.
- No real audit trail — "who took the last 10 units, and when?" has no good answer.
- No automatic alerting — stockouts get discovered when someone walks to the shelf, not before.
- No fast lookup — searching a 5,000-row spreadsheet by SKU or location is slow and error-prone.

Stockyard solves each of these directly: every stock change is a recorded transaction (not an overwritten cell), every search hits an indexed SQL query instead of scanning rows in memory, and a background engine continuously watches stock levels so shortages surface automatically instead of being discovered on the floor.

---

## Features

### 📋 Inventory management
- Full component catalog with SKU, name, category, quantity, unit, location, cost per unit, supplier, and free-form notes.
- Configurable low-stock **threshold** and optional **max stock** per item, with category-level **aging windows** (flag components that haven't moved in *N* days).
- Soft-delete support — items are archived, not destroyed, so historical transactions stay intact.
- Barcode scanner support out of the box: keyboard-wedge scanners are detected by keystroke timing (fast bursts terminated by `Enter`), distinguishing a scan from normal typing without any special hardware driver.

### 📈 Live dashboard
At-a-glance KPI cards — total SKUs, out-of-stock count, low-stock warnings, aging components, and total inventory valuation — plus a critical-shortages table so the most urgent items are always visible first.

### 🔔 Background alert engine
A scheduled job (interval configurable in Settings) continuously scans inventory and raises alerts with severity levels:

| Alert type | Severity | Trigger |
|---|---|---|
| `OUT_OF_STOCK` | Critical | Quantity reaches zero |
| `LOW_STOCK` | Warning | Quantity falls at/below the item's threshold |
| `AGING` | Info | No recorded movement within the category's aging window |

Alerts can be acknowledged (snoozed) or resolved, and trigger native OS notifications so a shortage doesn't sit unnoticed in a background window.

### 🧾 Full transaction ledger
Every stock change — receipt, issue, adjustment, or initial count — is written as an immutable transaction row with the quantity delta, the quantity *before* the change, the operator who performed it, and an optional reference (PO number, build name). Nothing is ever silently overwritten.

### 🧩 Bill of Materials (BOM)
Define BOM templates (a named list of components + required quantities) and instantly check **coverage** — how many complete units can be built right now given current stock — without manually cross-referencing the inventory sheet.

### 📤 Exports & operational tooling
- One-click CSV export (native OS save dialog) for inventory, transactions, or alert history.
- One-click raw `.sqlite` database backup.
- Factory reset / wipe for a clean slate on a new install.

---

## Architecture

Stockyard follows a **multi-process local client–server** pattern — the same shape as a web app's frontend/backend split, just running entirely on one machine. This keeps the UI thread free of database work and keeps filesystem/database access out of the (sandboxed) renderer entirely.

```
┌──────────────────────────────────────┐
│       RENDERER PROCESS (React UI)     │
│  - Captures filters and input search   │
│  - Debounces input state (250ms)        │
│  - Renders paginated data tables          │
│  - Sandboxed: no direct filesystem access  │
└──────────────────┬─────────────────────────┘
                   │
                   │  Asynchronous IPC Bridge (contextBridge, contextIsolation: true)
                   ▼
┌──────────────────────────────────────┐
│       MAIN PROCESS (Node.js)           │
│  - Receives IPC requests (API gateway)  │
│  - Handles file I/O (CSV export, backup) │
│  - Runs the background alert engine       │
│  - Fires native OS notifications           │
└──────────────────┬─────────────────────────┘
                   │
                   │  Drizzle ORM → indexed SQL queries
                   ▼
┌──────────────────────────────────────┐
│       SQLITE DATABASE (single file)    │
│  - better-sqlite3, synchronous, in-process │
│  - Indexed on sku, name, category, location, │
│    deletedAt, createdAt                        │
└──────────────────────────────────────┘
```

### Core design decisions

1. **Process isolation.** The renderer runs `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. It has zero direct filesystem or Node.js access — every operation crosses through a typed `preload.ts` bridge into `ipcMain` handlers in the main process. A compromised or buggy UI can't touch the database or disk directly.
2. **Server-side filtering & pagination.** Search, category filters, and status calculations run as SQL in SQLite, not as array filtering in React state — results are paged with `LIMIT`/`OFFSET` (100 rows/page) to keep memory flat regardless of catalog size.
3. **Indexed reads.** Explicit indexes on the columns actually used for filtering and sorting (`sku`, `name`, `categoryId`, `location`, `deletedAt`, `createdAt`) keep lookups fast even as the transaction ledger grows into the tens of thousands of rows.
4. **Debounced input.** Search inputs debounce at 250ms client-side before dispatching a query, avoiding a database round-trip on every keystroke.
5. **Background scheduled services.** The alert engine runs on a timer inside the main process (independent of whether a UI window has focus), so alerts stay current even if the user is on a different tab.
6. **Append-only transactions.** Stock changes are never in-place updates to a "current quantity" field alone — every change is logged as a new `transactions` row with a before/after delta, making the transaction ledger a true audit trail.

---

## Tech stack

| Layer | Technology | Purpose |
|---|---|---|
| Desktop shell | [Electron 31](https://www.electronjs.org/) | Cross-platform native desktop runtime |
| Frontend UI | [React 18](https://react.dev/) + TypeScript | Component-based renderer |
| Build system | [Vite 5](https://vitejs.dev/) + `vite-plugin-electron` | Bundling & hot-reload for both processes |
| State management | [Zustand 4](https://github.com/pmndrs/zustand) | Lightweight global store (inventory, alerts) |
| ORM | [Drizzle ORM](https://orm.drizzle.team/) + `drizzle-kit` | Type-safe schema, queries, and migrations |
| Database | [SQLite](https://www.sqlite.org/) via `better-sqlite3` | Synchronous, in-process, single-file storage |
| Charts | [Recharts](https://recharts.org/) | Dashboard visualizations |
| Icons | [Lucide React](https://lucide.dev/) | Icon set |
| Packaging | [electron-builder](https://www.electron.build/) (NSIS) | Windows installer generation |

---

## Data model

Five tables, fully typed end-to-end via Drizzle's inferred `select`/`insert` types:

| Table | Purpose |
|---|---|
| `categories` | Component categories, each with a configurable aging window (days) and a UI badge color |
| `items` | The component catalog — SKU, quantity, threshold, location, cost, supplier, soft-delete flag |
| `transactions` | Append-only stock movement ledger — type, quantity delta, before-quantity, operator, reference |
| `alerts` | Generated by the alert engine — type, severity, active/acknowledged/resolved state |
| `bom_templates` / `bom_items` | Named BOM configurations and their required component quantities (composite PK) |

---

## Inter-Process Communication (IPC) API

All communication between the UI and the database goes through a fixed set of asynchronous IPC channels exposed via the preload bridge — effectively the app's internal API surface.

<details>
<summary><strong>Categories</strong></summary>

- `categories:getAll` — fetch all categories
- `categories:create` / `categories:update` / `categories:delete`
</details>

<details>
<summary><strong>Items / Inventory</strong></summary>

- `items:getAll` — raw dump
- `items:getFiltered` — paginated + filtered (used by tables)
- `items:searchAutocomplete` — quick SKU/name lookup
- `items:getLocations` — distinct warehouse/shelf locations
- `items:getSimpleList` — minimal metadata (ID, SKU, name)
- `items:getById` — full detail
- `items:create` / `items:update` / `items:delete`
- `items:adjustStock` — register a stock adjustment transaction
</details>

<details>
<summary><strong>Transactions</strong></summary>

- `transactions:getAll` / `transactions:getFiltered`
- `transactions:getOperators` — distinct operator list
- `transactions:getByItem` — history for one item
</details>

<details>
<summary><strong>Alerts</strong></summary>

- `alerts:getActive` / `alerts:getResolved`
- `alerts:acknowledge` / `alerts:resolve`
- `alerts:updated` — event fired when the background engine raises new alerts
</details>

<details>
<summary><strong>Bill of Materials</strong></summary>

- `bom:getAll` / `bom:getDetails`
- `bom:create` / `bom:update` / `bom:delete`
- `bom:checkCoverage` — compare a BOM against current stock to compute buildable quantity
</details>

<details>
<summary><strong>Export & Settings</strong></summary>

- `csv:export` — native save-dialog export to CSV
- `settings:getSchedulerInterval` / `settings:setSchedulerInterval`
- `settings:runAlertScan` — force an immediate scan
- `settings:backupDB` — raw `.sqlite` file backup
- `settings:resetData` — factory reset
</details>

---

## Project structure

```
Stockyard/
├── build/                     # App icons & packaging static assets
├── dist-installer/            # Packaged Windows installer output (generated)
├── drizzle/                   # SQL migrations (generated by drizzle-kit)
├── electron/                  # Main process (Node.js)
│   ├── database/
│   │   ├── connection.ts       # DB connection init + migration runner
│   │   ├── schema.ts            # Table schemas, indexes, inferred types
│   │   └── queries/               # Query handlers (items, transactions, alerts, bom, categories)
│   ├── services/
│   │   ├── alertEngine.ts        # Stock-level scan → alert generation
│   │   ├── scheduler.ts           # Interval-based background scheduling
│   │   ├── notifier.ts             # Native OS notification dispatch
│   │   └── csvExport.ts             # CSV export via native save dialog
│   ├── main.ts                    # Entrypoint, window creation, IPC registration
│   └── preload.ts                   # contextBridge — the only surface the renderer can call
├── src/                        # Renderer process (React)
│   ├── components/layout/       # App shell / navigation layout
│   ├── hooks/                     # useInventory, useAlerts, useBOM, useScanner
│   ├── lib/                         # Typed IPC client wrapper
│   ├── pages/                         # Dashboard, Inventory, Transactions, Alerts, BOM, Settings
│   ├── store/                           # Zustand stores (inventory, alerts)
│   └── main.tsx                           # React bootstrap
├── docs/                        # Technical specification
├── package.json
└── tsconfig.json
```

---

## Getting started

### Prerequisites
- Node.js ≥ 18
- npm
- Windows (current packaging target — see [Platform support](#platform-support))

### Development

```bash
# install dependencies
npm install

# run the Vite dev server + hot-reloaded Electron shell
npm run dev
```

### Database

```bash
# generate a new migration after editing electron/database/schema.ts
npm run db:generate

# open Drizzle Studio to inspect the local database
npm run db:studio
```

### Production build

```bash
# compile TypeScript and bundle optimized assets
npm run build

# package into a standalone Windows installer (.exe) — runs the build step automatically
npm run electron:build
```

The installer is emitted to `dist-installer/`.

---

## Data storage

Stockyard stores everything in a single SQLite file inside the OS application-data directory — no external database, no network calls, and no telemetry:

| OS | Path |
|---|---|
| Windows | `C:\Users\<Username>\AppData\Roaming\stockyard\inventory.db` |

Use **Settings → Backup Database** to copy this file out for safekeeping, and **Settings → Reset Data** to wipe it and start clean.

---

## Platform support

Current `electron-builder` configuration targets **Windows x64 (NSIS installer)** only, matching where it's deployed today. The Electron/React/Drizzle core has no Windows-specific code paths, so macOS/Linux targets could be added to `electron-builder.config.js` without core changes if ever needed — just untested today.

---

## Security notes

- Renderer runs fully sandboxed (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`) — the UI cannot touch the filesystem, spawn processes, or access Node APIs except through the explicit, typed IPC surface documented above.
- Operator names are trimmed and capped at 100 characters before being written to the transaction ledger.
- All queries go through Drizzle's parameterized query builder — no raw string-concatenated SQL.

---

## License

Internal tool — © Aditya Singh. Not currently published under an open-source license.
