# electron/database/

Owns the SQLite database: connection setup, schema, migrations, and every query used by the app. Nothing outside `database/` (and the alert engine in `services/`) should build a raw SQL query — everyone else calls into `queries/`.

## Structure

```
database/
├── connection.ts   # Opens the better-sqlite3 connection, exports `db` (Drizzle client), runs migrations
├── schema.ts       # Table definitions, indexes, and inferred TS types
└── queries/        # Domain query handlers: categories, items, transactions, alerts, bom
```

## `connection.ts`

- Resolves the database file path from Electron's `app.getPath('userData')` when running inside Electron, falling back to `process.cwd()/inventory.db` for CLI/migration/seed scripts run outside Electron.
- Opens the file with `better-sqlite3` and wraps it with `drizzle()` as the exported `db` client used by every file in `queries/`.
- `runMigrations()` runs Drizzle's `migrate()` against the `drizzle/` folder (resolved differently for packaged vs. dev builds) and is called once from `main.ts` on `app.whenReady()`.
- After migrating, it also cleans up legacy rows where a timestamp column still literally contains the string `'CURRENT_TIMESTAMP'` (from an older schema default), replacing them with a real ISO timestamp across `items`, `transactions`, `alerts`, and `bom_templates`.

## `schema.ts`

Defines six Drizzle tables and their inferred `Select`/`Insert` TypeScript types:

| Table | Key columns | Indexes |
|---|---|---|
| `categories` | `id`, `name` (unique), `agingDays` (default 90), `color` | — |
| `items` | `id`, `name`, `sku` (unique), `categoryId` → categories, `quantity`, `unit`, `threshold` (default 5), `maxStock`, `location`, `costPerUnit`, `supplier`, `lastMovedAt`, `addedAt`, `notes`, `deletedAt` (soft delete) | `name`, `categoryId`, `location`, `deletedAt` |
| `transactions` | `id`, `itemId` → items, `type` (`IN`/`OUT`/`ADJUSTMENT`/`INITIAL`), `quantity`, `quantityBefore`, `performedBy`, `reference`, `notes`, `createdAt` | `itemId`, `createdAt` |
| `alerts` | `id`, `itemId` → items, `type` (`LOW_STOCK`/`OUT_OF_STOCK`/`AGING`), `severity` (`INFO`/`WARNING`/`CRITICAL`), `message`, `isActive`, `acknowledgedAt`, `resolvedAt`, `triggeredAt` | — |
| `bomTemplates` | `id`, `name` (unique), `description`, `createdAt` | — |
| `bomItems` | composite PK (`bomId`, `itemId`) → bomTemplates/items, `quantity` | — |

Indexes on `items` and `transactions` back the search/filter/sort queries used by `getFiltered` in `queries/items.ts` and `queries/transactions.ts`.

## `queries/`

See `database/queries/README.md` for the full breakdown of `alerts.ts`, `bom.ts`, `categories.ts`, `items.ts`, and `transactions.ts`.

## Design principles

- **Filtering, sorting, and pagination happen in SQL**, not JavaScript — `getFiltered`-style functions use Drizzle `where`/`orderBy`/`limit`/`offset` against the indexed columns above.
- **Soft-delete aware**: item reads exclude rows with `deletedAt` set; `items:delete` performs a soft delete (`softDeleteItem`), setting `deletedAt` rather than removing the row.
- **No Electron/IPC imports** in `schema.ts` or `queries/` — only `connection.ts` reaches for `require('electron')`, and it does so defensively (try/catch) so the module also works from CLI scripts.

## Adding a new query

1. Add/alter tables in `schema.ts`, then generate a migration with `drizzle-kit` into the top-level `drizzle/` folder.
2. Add the function to the relevant file in `queries/`.
3. Wire it up: `ipcMain.handle(...)` in `electron/main.ts` → allowlist entry in `electron/preload.ts` → wrapper in `src/lib/ipc.ts`.
