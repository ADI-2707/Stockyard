# src/hooks/

Custom React hooks that connect UI components to data — the layer between `pages/`/`components/` and the IPC client in `lib/`. This is where data fetching, debouncing, and wiring into the Zustand stores in `store/` happens.

## Responsibilities

- Fetch and cache data needed by pages (items, transactions, alerts, BOM data) by calling into `lib/`
- Debounce user input (e.g. search boxes) before triggering a query
- Read from and write to the Zustand stores in `store/`
- Expose simple, page-friendly APIs (`{ data, isLoading, error, refetch }`-style) so components stay declarative

## Structure (indicative)

```
hooks/
├── useInventory.ts   # Fetching/filtering/paginating items for the Inventory page
├── useBOM.ts          # Fetching BOM templates, details, and coverage checks
├── useTransactions.ts # Fetching/filtering the transaction ledger
├── useAlerts.ts        # Fetching active/resolved alerts, subscribing to `alerts:updated`
└── useDebounce.ts       # Generic 250ms input-debouncing utility used by search/filter inputs
```

> Filenames are indicative based on the app's known features (Inventory, BOM, Ledger, Alerts) — adjust to match the actual files present.

## Design principles

- **Debounced search is implemented here**: search/filter inputs debounce by ~250ms before dispatching the actual `items:getFiltered`/`transactions:getFiltered` IPC call, avoiding redundant SQLite queries while the user types.
- **All IPC access goes through `lib/`**, never directly through `window.electronAPI` in a hook — keeps the IPC contract centralized in one place.
- **Hooks own loading/error state** for their query so pages/components can stay simple (`if (isLoading) ...`).
- **Live updates**: `useAlerts` (or equivalent) should subscribe to the `alerts:updated` event pushed from the main process's notifier service so the UI refreshes without polling.

## Adding a new hook

1. Add the corresponding function to `lib/` if it doesn't already wrap the IPC channel you need.
2. Create `useXyz.ts`, calling the `lib/` function and managing loading/error/data state (or delegating to a `store/` slice).
3. Use the hook from the relevant page/component — never call `lib/` or IPC directly from a component.
