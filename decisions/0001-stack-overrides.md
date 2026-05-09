# 0001 — Stack overrides vs PRD

## Context

The PRD (`PRD.md` §2) specifies Tailwind CSS, react-router v6, and Zustand. The existing scaffold ships with MUI v7, react-router v7, and no global UI-state library. The user explicitly chose to keep the MUI stack rather than retool to Tailwind.

## Decision

Use the existing scaffold libraries instead of the PRD-specified ones for these layers:

| PRD says | We use |
|---|---|
| Tailwind CSS | MUI v7 + SCSS (existing) |
| react-router v6 | react-router v7 declarative `BrowserRouter` (existing) |
| Zustand | (none) — TanStack Query covers server state; revisit if a pure UI-state need surfaces |

Everything else in the PRD stack stays: React + Vite + TypeScript, react-i18next, RHF + zod, Supabase, TanStack Query (newly added).

## Alternatives considered

- **Migrate to Tailwind** — closer to PRD but means rewriting every existing primitive (confirm-dialog, phone-field, etc.) and discarding the MUI X DatePicker investment. User rejected.
- **Hybrid Tailwind utilities + MUI components** — adds two styling systems; debugging cascade conflicts is painful. Rejected.
- **Add Zustand preemptively** — speculative; YAGNI. Add when a concrete UI-state need appears.

## Consequences

- All PRD references to Tailwind logical properties (`ms-*`/`me-*`) are translated to MUI's `sx`/`theme.spacing` and the Emotion RTL pipeline (see ADR-0003).
- Guard composition (PRD §14) translates 1:1 to react-router v7 declarative mode (ADR-0002).
- New patterns (Banner, AppShell layout slots) are implemented as MUI components, not Tailwind class compositions.
- If we later want to migrate to Tailwind, the cost is a full UI rewrite — accept this.
