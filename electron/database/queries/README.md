# electron/database/queries/

This folder contains the actual SQL query handlers, grouped by domain. Every IPC channel registered in `main.ts` that reads or writes data ultimately calls into a function here. This is the only layer allowed to build and execute Drizzle/SQL queries against the database opened in `database/connection.ts`.

## Structure (by domain)

```
queries/
├── categories.ts       # Category CRUD
├── items.ts            # Inventory item CRUD, search, filtering, stock adjustments
├── transactions.ts     # Stock movement ledger reads
├── alerts.ts           # Low-stock alert reads/state changes
└── bom.ts              # Bill of Materials CRUD and coverage analysis
```

> Exact filenames may differ slightly in the repo — this reflects the five query domains implied by the app's IPC surface.

## `categories.ts`

- `getAll` — fetch all categories.
- `create` / `update` / `delete` — category CRUD, used to populate item category filters/dropdowns.

## `items.ts`

The largest and most performance-sensitive file:

- `getAll` — raw dump of all items (unfiltered, unpaginated).
- `getFiltered` — the main table-driving query: applies SKU/name search, category and status filters, sorting, and `LIMIT`/`OFFSET` pagination (100 rows per page) using the indexes defined in `schema.ts` (`sku`, `name`, `categoryId`, `location`).
- `searchAutocomplete` — lightweight, fast lookup for typeahead inputs.
- `getLocations` — distinct warehouse/shelf locations for filter dropdowns.
- `getSimpleList` — minimal `{id, sku, name}` projections, e.g. for BOM component pickers.
- `getById` — full item detail fetch.
- `create` / `update` — item metadata writes.
- `adjustStock` — records a stock adjustment; typically writes a row to the transactions ledger and updates the item's current quantity in the same operation/transaction.
- `delete` — soft delete (sets `deletedAt`) or hard delete depending on the endpoint contract.

## `transactions.ts`

- `getAll` / `getFiltered` — full or paginated/filtered transaction history.
- `getOperators` — distinct list of operators who have logged transactions, used for filter dropdowns.
- `getByItem` — transaction history scoped to a single item, used on item detail views.

## `alerts.ts`

- `getActive` / `getResolved` — split views of the alerts table.
- `acknowledge` / `resolve` — state transitions on an alert row, called both from the UI and potentially from `services/` when alerts are auto-resolved.

## `bom.ts`

- `getAll` — list of BOM templates.
- `getDetails` — a single BOM with its component items.
- `create` / `update` / `delete` — BOM CRUD.
- `checkCoverage` — compares a BOM's required components against current item stock levels to compute how many units are manufacturable; this is a read-only, computed query rather than a stored value.

## Design principles

- **One file per domain**, matching the IPC channel prefixes (`items:*`, `transactions:*`, etc.) so it's easy to trace an IPC call back to its handler.
- **Server-side filtering/pagination**: any `getFiltered`-style function does its filtering, sorting, and paging in SQL via Drizzle, never by pulling the full table into memory.
- **Uses indexed columns**: `WHERE`/`ORDER BY` clauses are written to hit the indexes declared in `schema.ts` (`sku`, `name`, `categoryId`, `location`, `deletedAt`, `createdAt`).
- **Soft-delete aware**: read queries generally filter out rows with `deletedAt` set unless explicitly requested otherwise.
- **No IPC or Electron imports**: files here only import the Drizzle client from `connection.ts` and types/tables from `schema.ts`, keeping them independent of `main.ts` and easy to unit test in isolation.

## Adding a new query

1. Add the function to the appropriate domain file (or create a new one for a new domain).
2. Use the Drizzle client exported from `../connection.ts` and tables from `../schema.ts`.
3. Register an `ipcMain.handle('<domain>:<action>', ...)` in `main.ts` that calls it.
4. Expose the channel from `preload.ts` so `src/lib` can call it from the renderer.
