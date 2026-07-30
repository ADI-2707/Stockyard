# src/

This folder contains the **React Renderer Process** code for Stockyard — the frontend UI that runs inside Electron's sandboxed browser window. It has no direct filesystem or database access; all data comes from the Electron main process (`electron/`) over IPC.

## Responsibilities

- Render the inventory, dashboard, transaction ledger, and BOM screens
- Capture and debounce user input (search, filters) before dispatching queries
- Manage global UI/app state
- Call into the main process through a thin IPC client wrapper — never `ipcRenderer` directly in components

## Structure

```
src/
├── components/    # Layout and reusable wrapper/UI components
├── hooks/         # Custom React hooks (e.g. useInventory, useBOM)
├── lib/           # IPC client wrapper — maps UI calls to electron IPC channels
├── pages/         # Top-level screens: Inventory, Dashboard, Ledger, BOM
├── store/         # Zustand global state stores
├── index.css      # Global style tokens
└── main.tsx       # React application bootstrap/entrypoint
```

## Architecture notes

- **No direct DB/filesystem access**: components never touch SQLite or the OS filesystem. Data flows exclusively through the API exposed by `electron/preload.ts`, wrapped in `lib/` for use in hooks and stores.
- **Server-side filtering & pagination**: search, category filters, and status logic are executed in the main process/SQLite layer, not in React memory. Pages request pre-filtered, paginated pages of data (100 rows at a time) rather than filtering large in-memory arrays.
- **Input debouncing**: search/filter inputs debounce keystrokes by 250ms before dispatching a query to the store, avoiding redundant IPC/SQLite calls while the user is typing.
- **State management**: `store/` holds Zustand stores for inventory filters/pagination state, alerts, and other cross-page shared state, following a unidirectional data flow.
- **Styling**: plain CSS Modules (Vanilla CSS) via `index.css` and component-level styles — no CSS-in-JS framework.

## Typical data flow

1. A page/component in `pages/` or `components/` calls a hook from `hooks/`.
2. The hook calls a function in `lib/` (the IPC client wrapper).
3. `lib/` invokes the corresponding channel exposed by `electron/preload.ts` (e.g. `items:getFiltered`).
4. The main process resolves the query against SQLite and returns the result.
5. The hook updates a Zustand store in `store/`, which re-renders the subscribed components.

## Adding a new screen

1. Create the page component under `pages/`.
2. Add any data-fetching hooks under `hooks/`, backed by a `lib/` IPC call.
3. Add shared state to `store/` if the data needs to be accessed across multiple components.
4. Wire the route/entry point in `main.tsx` (or the app's router/layout, if present).
