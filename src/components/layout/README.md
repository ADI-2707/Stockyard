# src/components/layout

Reusable, presentational building blocks shared across pages — layout scaffolding and wrapper components rather than full screens. Screens themselves live in `src/pages/`.

## Responsibilities

- Provide layout structure (app shell, navigation, headers) shared by every page
- Provide reusable UI primitives/wrappers (tables, modals, form fields, buttons, status badges) used across multiple pages
- Stay presentational: components receive data and callbacks via props and avoid owning IPC calls or business logic directly

## Structure

```
components/
├── layout/        # App shell, navigation/sidebar, header — wraps pages/ content
└── ui/            # Reusable wrapper components (tables, modals, inputs, badges, pagination controls, etc.)
```

> Exact subfolder names may vary — this reflects the "layout and reusable wrapper templates" role described for this folder.

## Design principles

- **Data-in, events-out**: components take data and filter/sort state as props and call back up (e.g. `onFilterChange`, `onPageChange`) rather than fetching data themselves — data fetching belongs in `hooks/`.
- **No direct IPC calls**: components never import from `electron` or call `window.electronAPI` directly; they consume data already fetched via `hooks/` and `lib/`.
- **Styled with CSS Modules**: each component pairs with its own scoped `.module.css` file, consistent with the project's vanilla CSS approach (see `src/index.css` for shared tokens).
- **Built for the app's core UI patterns**: since `items:getFiltered`, `transactions:getFiltered`, etc. all return paginated, filtered data, shared components here typically include a generic data table with search/filter/pagination controls used across the Inventory, Ledger, and BOM pages.

## When to add something here vs. `pages/`

- If it's a full screen with its own route (Inventory, Dashboard, Ledger, BOM) → `pages/`.
- If it's a piece of UI reused across 2+ screens, or structural layout wrapping every screen → `components/`.
