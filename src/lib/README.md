# src/lib/

The IPC client wrapper layer. This is the *only* place in the renderer that should reference the API exposed by `electron/preload.ts` (typically via `window.electronAPI` or similar). Every other part of `src/` (hooks, stores, components) goes through here rather than calling IPC directly.

## Responsibilities

- Provide typed functions that map 1:1 (or close to it) with the IPC channels registered in `electron/main.ts`
- Centralize the renderer-side contract for calling into the main process, so it only needs to change in one place if a channel name or payload shape changes
- Keep IPC plumbing out of components, hooks, and stores

## Structure (indicative, grouped by domain — mirrors `electron/database/queries/`)

```
lib/
├── ipc.ts             # Low-level wrapper around window.electronAPI.invoke / preload bridge
├── items.ts           # Wraps items:* channels (getAll, getFiltered, create, update, adjustStock, delete, ...)
├── categories.ts       # Wraps categories:* channels
├── transactions.ts      # Wraps transactions:* channels
├── alerts.ts             # Wraps alerts:* channels, subscribes to alerts:updated events
├── bom.ts                 # Wraps bom:* channels
└── settings.ts              # Wraps settings:* and csv:export channels
```

> Filenames are indicative, mirroring the IPC channel groups documented at the project root (items, categories, transactions, alerts, bom, settings/export) — adjust to match the actual files present.

## Design principles

- **Thin wrappers, no business logic**: functions here just call `window.electronAPI.invoke('items:getFiltered', params)` (or equivalent) and return the typed result — filtering/sorting/pagination logic lives in the main process (`electron/database/queries/`), not here.
- **One function per IPC channel**, named to match (e.g. `getFilteredItems()` → `items:getFiltered`), so it's easy to trace a call from a hook back to its main-process handler.
- **Types shared with the main process** where possible, so the shape of an item/transaction/alert/BOM object stays consistent between `electron/database/schema.ts` and what the UI expects.
- **Event subscriptions** (like `alerts:updated`) are also wrapped here, exposing a subscribe/unsubscribe function rather than leaking raw `ipcRenderer.on` calls into hooks.

## Adding a new wrapper

1. Confirm the IPC channel is registered in `electron/main.ts` and exposed via `electron/preload.ts`.
2. Add a typed function here that calls it through `ipc.ts`.
3. Consume the function from a hook in `src/hooks/`, not directly from a component.
