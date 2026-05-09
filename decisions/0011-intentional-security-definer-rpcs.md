# 0011 — Intentional `SECURITY DEFINER` RPCs callable by authenticated users

## Context

Supabase advisors flag two `SECURITY DEFINER` functions in `public` as callable by signed-in users:

- `public.complete_onboarding(...)` — used by the onboarding wizard.
- `public.current_shop_id()` — used inside RLS policies and (optionally) by the client.

The advisor is asking us to confirm these are intentional. Both are.

## Decision

Keep both functions as `SECURITY DEFINER` and callable by `authenticated`. Document why here.

### `complete_onboarding`
- We do not give users `INSERT` on `public.shops` directly. Onboarding is the only path to create a shop, and it must atomically write `shops`, `shop_owner_details`, and flip `profiles.onboarding_completed`. `SECURITY DEFINER` bypasses RLS to perform that work in one transaction.
- The function checks `auth.uid()` and writes only for that user. There's no spoofing path.
- Granted to `authenticated` only; revoked from `anon` and `public`.

### `record_purchase` / `record_sale`
- These RPCs are the only path to write `purchases` + `purchase_items` (stock-in) and `invoices` + `sale_items` + `ledger_entries` (POS sale) atomically. Direct table writes from the client are intentionally not used so stock-deduction races and partial writes can't happen.
- Both functions read `auth.uid()` and `current_shop_id()` at entry, validate that all referenced products and customers belong to the caller's shop, and insert with `cashier_id = auth.uid()`. There's no spoofing path.
- Granted to `authenticated` only; revoked from `anon` and `public`.

### `current_shop_id`
- Returns the calling user's own shop id (or null). Users can already obtain their `shop_id` via `select id from public.shops` (which is allowed by the `shops_owner_read` policy), so exposing this RPC adds no privilege.
- It exists primarily as a stable, reusable predicate inside RLS policies (`shop_id = public.current_shop_id()`). Marking it `stable` lets Postgres memoize within a query.
- Granted to `authenticated` only; revoked from `anon` and `public`.

## Alternatives considered

- **Switch to `SECURITY INVOKER`** — for `current_shop_id` this works and keeps advisor happy, but the function then runs under the caller's RLS, which is fine because `shops_owner_read` allows it. Acceptable; not making the change to keep parity with PRD wording. Revisit if advisor noise becomes annoying.
- **Move `complete_onboarding` to an Edge Function** — adds deployment surface and cold-start latency for no security gain. Rejected.

## Consequences

- The advisor will continue to surface these two warnings. They are accepted exceptions.
- If we add more `SECURITY DEFINER` functions in later milestones (`record_sale`, `record_purchase` in M3/M4), document them in their own ADR, or extend this one.
- Periodically re-run `mcp__supabase__get_advisors` and ensure only these two warnings (and the leaked-password setting) appear — anything new merits investigation.

## Operator action

Enable HaveIBeenPwned password check in Supabase dashboard:
**Auth → Policies → Password security → "Enable leaked password protection"**.
This is a dashboard toggle, not a SQL change.
