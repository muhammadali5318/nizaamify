# 0004 — Supabase Auth replaces Auth0

## Context

The scaffold's `.env` and `README.md` referenced Auth0, but exploration showed Auth0 was never actually wired in code (no `useAuth0` imports, no provider mount, no token storage). The PRD specifies Supabase Auth, which integrates with the `auth.users` table that the `handle_new_user()` trigger hooks into.

## Decision

Use Supabase Auth exclusively:

- `supabase.auth.signUp({ email, password })` for registration
- `supabase.auth.signInWithPassword(...)` for login
- `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })` for forgot password
- `supabase.auth.updateUser({ password })` for reset
- `supabase.auth.onAuthStateChange(...)` inside `AuthProvider` for session sync
- Default localStorage persistence (Supabase default)
- Email verification via Supabase's built-in template (customized in dashboard with EN+UR copy)

Strip every Auth0 reference: env vars, README, any leftover comments.

## Alternatives considered

- **Keep Auth0** — would force rewriting the `handle_new_user` trigger to a webhook + an HTTP-callable Postgres function; loses out-of-the-box password-reset email flow; doubles ops overhead. Rejected.
- **Custom email/password backend** — reinventing what Supabase Auth provides for free. Rejected.

## Consequences

- `auth.users` is the source-of-truth for identity. `profiles.id` is FK to `auth.users.id`.
- Email verification is delegated to Supabase — verify the template is configured correctly in the dashboard before launch.
- Session is in browser localStorage; clearing it = logout. Acceptable for MVP.
- The Supabase **publishable key** (or legacy anon key) is the only client-side credential; **never** put the service role key in `.env` for the frontend.
