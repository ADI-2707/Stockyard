# src/store/

Global application state, managed with [Zustand](https://github.com/pmndrs/zustand). Stores here hold state that needs to be shared across components/pages or persist across navigation — everything else should stay as local component state.

## Responsibilities

- Hold filter, sort, and pagination state for the main data tables (Inventory, Ledger, BOM) so it survives navigating away and back
- Hold cached/derived data shared across multiple components (e.g. active alert count shown in nav + dashboard)
- Expose actions that hooks call to update state, following a unidirectional data flow: **action → store update → subscribed components re-render**

## Structure (indicative)

```
store/
├── itemsStore.ts         # Inventory filters (search term, category, location, status), sort, current page
├── transactionsStore.ts   # Ledger filters (item, operator, date range), sort, current page
├── bomStore.ts              # Selected BOM, cached details/coverage results
├── alertsStore.ts            # Active/resolved alerts, updated in response to the alerts:updated event
└── settingsStore.ts             # Scheduler interval and other user-configurable settings
```

> Filenames are indicative, grouped by the same domains as `electron/database/queries/` and `src/lib/` — adjust to match the actual files present.

## Design principles

- **Unidirectional data flow**: components call actions exposed by a store (or by a hook that wraps the store); they never mutate store state directly.
- **Stores don't call IPC directly**: fetching is done in `hooks/` (via `lib/`), which then writes results into the store. This keeps stores as pure state containers and hooks as the async/data-fetching layer.
- **Debounced inputs update the store only after the debounce window** (see `hooks/useDebounce`), so a store update — and the resulting query — happens once typing settles, not on every keystroke.
- **Scoped stores per domain** rather than one giant store, so unrelated state updates don't cause unrelated components to re-render.

## Adding a new store

1. Create `xyzStore.ts` with a `create()` call defining state shape and actions.
2. Have the relevant hook in `hooks/` call the store's actions after fetching data via `lib/`.
3. Subscribe to the store from `pages/`/`components/` using the generated hook (e.g. `useItemsStore(state => state.filters)`), selecting only the slice needed to avoid unnecessary re-renders.
