# 0008 — No Zustand for now

## Context

PRD §2 lists Zustand as the UI-state library "if needed". Reading through the PRD-required features (auth, onboarding, banners, POS cart, products list, etc.), the only real client-only state shapes are:

- POS cart (transient, single-screen) — fine in component state with `useReducer` or RHF.
- Language selector — owned by react-i18next + localStorage.
- Banner dismissal-per-day — localStorage directly.
- Auth session — context (AuthProvider).
- Server data — TanStack Query.

## Decision

Do not install Zustand for MVP. Use:

- `useReducer` or RHF for the POS cart (single-component scope).
- Context + custom hooks (`useSession`, `useEffectiveSubscription`) for cross-cutting client state.
- TanStack Query for everything server-derived.

Reach for Zustand only if a real UI-state need surfaces that none of the above handle cleanly.

## Alternatives considered

- **Install Zustand preemptively** — adds a dependency that earns its keep only if cart logic explodes. YAGNI. Rejected.
- **Use Redux Toolkit** — vastly more ceremony for the same problem. Rejected.

## Consequences

- The POS cart will be a `useReducer` inside the POS feature module, not a global store.
- Adding Zustand later is cheap (~1 hour of refactor), so the decision is reversible.
- Bundle size stays smaller.
