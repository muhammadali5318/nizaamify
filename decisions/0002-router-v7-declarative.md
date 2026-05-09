# 0002 — React Router v7 declarative mode

## Context

PRD §14 shows guard composition using react-router v6 syntax (`<Route element={<RequireAuth>...}>`). The scaffold uses react-router v7. v7 has two modes: declarative (`<BrowserRouter>` + JSX `<Routes>`) and the data router (`createBrowserRouter` with `loader`/`action`). Scaffold uses declarative mode.

## Decision

Stay in declarative mode. Compose guards exactly as PRD §14 prescribes — component guards reading from React Query, with a `<RedirectIf>` helper for inverse routes (`/onboarding`, `/subscription/expired`) to prevent infinite redirect loops.

## Alternatives considered

- **Switch to data router with `loader`-based auth** — gets us route-level data fetching but creates a parallel layer that fights TanStack Query, requires rewriting the existing `BrowserRouter` setup, and adds boilerplate. Rejected.
- **Skip guards, check inside each page** — duplicative; easy to forget and ship a leaky page. Rejected.

## Consequences

- Imports come from `react-router` (not `react-router-dom`) — v7 unified the package.
- Guards must remain pure (no side effects) to be safe under React StrictMode double-renders.
- The four guards (`RequireAuth`, `RequireOnboarded`, `RequireActiveSubscription`, `RedirectIf`) live in `src/lib/guards.ts` for reuse.
- `/onboarding` and `/subscription/expired` are placed *inside* `<RequireAuth>` but *outside* the onboarded/active-subscription wrapper, with their own `<RedirectIf>` to send already-onboarded / active-sub users back to `/dashboard`.
