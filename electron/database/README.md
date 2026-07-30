# electron/database/

This folder owns all direct interaction with the local SQLite database. Nothing outside this folder (and `electron/services/`) should touch SQLite directly — the rest of the main process, and all of `src/`, goes through the query handlers defined here.

## Structure

```
database/
├── connection.ts   # Opens the SQLite connection and runs Drizzle migrations on startup
├── schema.ts       # Drizzle table schema definitions and indexes
└── queries/        # Query handlers grouped by domain (items, transactions, alerts, BOM, categories, etc.)
```

## `connection.ts`

- Initializes the `better-sqlite3` connection to `inventory.db` in the OS application-data directory (e.g. `C:\Users\<Username>\AppData\Roaming\stockyard\inventory.db` on Windows).
- Runs any pending Drizzle migrations (generated into the top-level `drizzle/` folder) before the app finishes starting, so the schema is always up to date on launch.
- Exports the initialized Drizzle client used by every file under `queries/`.

## `schema.ts`

- Defines all tables (items, categories, transactions, alerts, BOM templates/components, etc.) using Drizzle's schema syntax.
- Declares indexes on the columns most frequently used for filtering and sorting: `sku`, `name`, `categoryId`, `location`, `deletedAt`, `createdAt`. These keep search/filter/pagination queries fast as the dataset grows.
- Is the single source of truth for the shape of the database — migrations in `drizzle/` are generated from changes made here.

## `queries/`

Each file groups the read/write logic for one domain and is called directly by the IPC handlers registered in `main.ts`:

| File (by domain) | Responsibilities |
|---|---|
| `items` | `getAll`, `getFiltered` (server-side search/filter/pagination, 100 rows per page), `searchAutocomplete`, `getLocations`, `getSimpleList`, `getById`, `create`, `update`, `adjustStock`, `delete` |
| `categories` | `getAll`, `create`, `update`, `delete` |
| `transactions` | `getAll`, `getFiltered`, `getOperators`, `getByItem` — the stock movement ledger |
| `alerts` | `getActive`, `getResolved`, `acknowledge`, `resolve` — backing store for the alert engine in `services/` |
| `bom` | `getAll`, `getDetails`, `create`, `update`, `delete`, `checkCoverage` (compares BOM requirements against current stock) |

## Design principles

- **Filtering, sorting, and pagination happen in SQL**, not in JavaScript — handlers build queries using `LIMIT`/`OFFSET` and indexed `WHERE` clauses rather than fetching everything and slicing it in memory.
- **Soft-delete aware**: reads generally exclude rows where `deletedAt` is set; deletes may be soft (flag) or hard depending on the endpoint.
- **No IPC/Electron imports here**: this folder is pure data-access logic so it stays testable and reusable independent of `main.ts`.

## Adding a new query

1. Add the table/columns to `schema.ts` if needed, then generate a migration (`drizzle-kit`) into the top-level `drizzle/` folder.
2. Add the query function to the relevant file in `queries/` (or create a new domain file).
3. Call it from a new `ipcMain.handle(...)` in `main.ts`, and expose the channel via `preload.ts`.
