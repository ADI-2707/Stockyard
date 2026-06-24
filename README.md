# Stockyard - Component Inventory Tracker

A high-performance, offline-first desktop application designed for panel and body manufacturing component tracking. Built on a modern multi-process desktop architecture with local database caching and indexing.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Desktop Shell** | [Electron (v31)](https://www.electronjs.org/) | Cross-platform desktop runtime environment. |
| **Frontend UI** | [React (v18)](https://react.dev/) | Component-based interface rendering. |
| **Build System** | [Vite (v5)](https://vitejs.dev/) | Hot-reloading module bundler and compiler. |
| **State Store** | [Zustand (v4)](https://github.com/pmndrs/zustand) | Global state manager with unidirectional data flow. |
| **Database ORM** | [Drizzle ORM](https://orm.drizzle.team/) | Type-safe SQL translator & migrator. |
| **Local Database** | [SQLite (better-sqlite3)](https://www.sqlite.org/) | In-process, single-file relational storage. |
| **Visual Styles** | Vanilla CSS (CSS Modules) | Modular, scope-safe styling layout. |

---

## Architectural Overview & Workflow

Stockyard follows a **Multi-Process Local Client-Server** pattern. It separates the presentation layer (React) from the system operations and database layer (Node.js/SQLite), ensuring optimal UI performance and secure data handling.

```
┌──────────────────────────────────────┐
│       RENDERER PROCESS (React UI)    │
│  - Captures filters and input search  │
│  - Debounces input state (250ms)     │
│  - Renders paginated data tables     │
└──────────────────┬───────────────────┘
                   │
                   │  Asynchronous IPC Bridge (Context Bridge)
                   ▼
┌──────────────────────────────────────┐
│       MAIN PROCESS (Node.js Server)  │
│  - Receives IPC requests (API Gateway)│
│  - Handles file I/O (CSV exports)    │
│  - Runs background alert engine      │
└──────────────────┬───────────────────┘
                   │
                   │  B-Tree Index Lookups via Drizzle ORM
                   ▼
┌──────────────────────────────────────┐
│       SQLITE DATABASE (Disk Storage) │
│  - Stores relational tables          │
│  - Resolves queries in O(log N)      │
└──────────────────────────────────────┘
```

### Core Architecture Concepts
1. **Process Isolation**: The Renderer process runs in a sandboxed browser container and has no filesystem access. It communicates with the Main process via secure `ipcRenderer` handlers mapped through a preload script.
2. **Server-Side Filtering & Pagination**: Data filtering (searching SKU/Names, filter categories, status calculation) is executed in the SQLite database layer rather than React memory. Results are capped to a page size limit (100 rows) using SQL `LIMIT` and `OFFSET` keywords to minimize memory overhead.
3. **Database Indexing**: Indexes are created on columns frequently used for sorting or filtering (`sku`, `name`, `categoryId`, `location`, `deletedAt`, `createdAt`). This accelerates database reads to sub-milliseconds.
4. **Input Debouncing**: Typing in search inputs is debounced by 250ms on the client-side. The UI delays dispatching query filters to the store while the user is actively typing, preventing redundant SQLite query execution.
5. **Background Scheduled Services**: The Main process runs scheduled tasks (e.g., alert engines) to constantly monitor stock levels and automatically generate restocking alerts in the background.

---

## Inter-Process Communication (IPC) Endpoints

The system relies on a strictly defined set of asynchronous IPC channels that act as the API gateway between the UI and the underlying SQLite database.

### Categories API
* `categories:getAll` - Fetch all categories.
* `categories:create` - Create a new category.
* `categories:update` - Modify an existing category.
* `categories:delete` - Delete a category.

### Items Inventory API
* `items:getAll` - Fetch all items (raw dump).
* `items:getFiltered` - Fetch paginated and filtered items (used by tables).
* `items:searchAutocomplete` - Quick SKU/Name lookup for inputs.
* `items:getLocations` - Fetch distinct warehouse/shelf locations.
* `items:getSimpleList` - Fetch minimal item metadata (ID, SKU, Name).
* `items:getById` - Fetch full item details by ID.
* `items:create` - Add a new item to the inventory.
* `items:update` - Edit an existing item's metadata.
* `items:adjustStock` - Register a stock adjustment transaction (Add/Remove stock).
* `items:delete` - Soft/Hard delete an item.

### Transactions Ledger API
* `transactions:getAll` - Fetch all historical transactions.
* `transactions:getFiltered` - Fetch paginated and filtered transactions.
* `transactions:getOperators` - Fetch a distinct list of system operators.
* `transactions:getByItem` - Fetch transaction history for a specific item.

### Alerts System API
* `alerts:getActive` - Fetch all triggered/active low-stock alerts.
* `alerts:getResolved` - Fetch historical resolved alerts.
* `alerts:acknowledge` - Mark an active alert as acknowledged.
* `alerts:resolve` - Mark an active alert as resolved.
* `alerts:updated` - (Event) Fired when the background engine generates new alerts.

### Bill of Materials (BOM) API
* `bom:getAll` - Fetch all BOM templates.
* `bom:getDetails` - Fetch details and components of a specific BOM.
* `bom:create` - Create a new BOM configuration.
* `bom:update` - Modify an existing BOM.
* `bom:delete` - Delete a BOM.
* `bom:checkCoverage` - Analyze current stock against a BOM to determine manufacturable quantities.

### File Export & Settings API
* `csv:export` - Trigger a native OS save dialog to export table data to CSV.
* `settings:getSchedulerInterval` - Fetch the alert engine polling interval.
* `settings:setSchedulerInterval` - Update the alert engine polling interval.
* `settings:runAlertScan` - Force a manual scan of stock levels.
* `settings:backupDB` - Create a raw `.sqlite` database backup file.
* `settings:resetData` - Factory reset and wipe the database.

---

## Project Directory Structure

```
Stockyard/
├── build/                 # Production icons and packaging static assets
├── dist-installer/        # Final packaged Windows executable setup files
├── drizzle/               # SQL database migration files (Generated by drizzle-kit)
├── electron/              # Electron Main Process Code
│   ├── database/
│   │   ├── connection.ts  # Database connection init & migrations runner
│   │   ├── schema.ts      # Table schema definitions & indexes
│   │   └── queries/       # SQLite query handlers (items, transactions, etc.)
│   ├── services/          # Scheduled Alert Engine, notifier, and CSV exporter
│   ├── main.ts            # Electron entrypoint & IPC registrations
│   └── preload.ts         # Secure process API bridge
├── src/                   # React Frontend Code (Renderer Process)
│   ├── components/        # Layout and reusable wrapper templates
│   ├── hooks/             # Custom React hooks (useInventory, useBOM)
│   ├── lib/               # IPC client wrapper mapping
│   ├── pages/             # Layout sheets (Inventory, Dashboard, Ledger, BOM)
│   ├── store/             # Zustand state management stores
│   ├── index.css          # Global style tokens
│   └── main.tsx           # React bootstrap element
├── package.json           # Node configuration and script commands
└── tsconfig.json          # TypeScript compiler rules
```

---

## Development & Build Commands

### 1. Development Mode
Run the Vite development server and launch the hot-reloaded Electron application shell:
```bash
npm run dev
```

### 2. Compile Assets
Compile TypeScript files and bundle optimized production web assets:
```bash
npm run build
```

### 3. Package Windows Installer (.exe)
Package the application assets into a standalone installer executable inside the `dist-installer/` directory:
```bash
npm run electron:build
```
*(Runs compiler assets automatically before bundling).*

---

## Local Storage Path
Stockyard stores its relational SQLite database file (`inventory.db`) inside the operating system's application data directory:
* **Windows**: `C:\Users\<Username>\AppData\Roaming\stockyard\inventory.db`
