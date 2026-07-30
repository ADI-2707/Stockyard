# src/pages/

Top-level screens ("layout sheets") of the application. Each file/folder here corresponds to a distinct view a user navigates to, composed from `components/` and driven by `hooks/` + `store/`.

## Screens

```
pages/
├── Inventory/    # Item list — search, filter by category/status/location, paginated table, stock adjustments
├── Dashboard/    # Overview: stock health, active alerts summary, key metrics
├── Ledger/       # Transaction history — filterable by item/operator/date, paginated
└── BOM/          # Bill of Materials — templates, component details, coverage/manufacturability check
```

## Responsibilities

- Compose `components/` (tables, filters, modals) with data from `hooks/`
- Own page-level state that doesn't need to be global (e.g. which modal is open), while delegating filter/pagination state to the relevant `store/` slice when it needs to persist across navigation
- Trigger the top-level data fetches for the screen via hooks (e.g. `useInventory`, `useTransactions`, `useBOM`, `useAlerts`)

## Page notes

- **Inventory**: the primary screen — item search/autocomplete, category/location/status filters, paginated table (100 rows/page), and stock adjustment actions (`items:adjustStock`).
- **Dashboard**: aggregates active alerts (`alerts:getActive`) and summary stats for a quick health check on load.
- **Ledger**: reads from the transactions domain (`transactions:getFiltered`, `transactions:getOperators`) to show and filter historical stock movements.
- **BOM**: lists BOM templates, shows component breakdown per BOM, and surfaces `bom:checkCoverage` results to show how many units are currently manufacturable given stock on hand.

## Design principles

- **Pages fetch, components render**: data fetching is triggered from the page via a hook; presentational rendering is delegated to `components/`.
- **No direct IPC calls from a page** — always go through a hook in `hooks/`, which in turn goes through `lib/`.
- **Filters/search state that should survive navigation** (e.g. "last filter used on Inventory") lives in `store/`, not local `useState`.

## Adding a new page

1. Create the folder/file under `pages/`.
2. Add any new data-fetching hooks under `hooks/` (backed by `lib/`).
3. Add global state to `store/` only if it needs to be shared across components/pages.
4. Register the route/entry in `main.tsx` (or the app's router/layout).
