# 0005 — Enable RLS in the same migration that creates each table

## Context

PRD §15 splits migrations such that `0007_rls_policies.sql` both enables RLS *and* defines policies, while domain tables are created earlier in `0004`. Between `0004` and `0007`, those tables would be readable to any authenticated user. Worse, `0006_views.sql` creates the `subscription_effective` view; views inherit RLS from their underlying tables, so without RLS on `subscriptions` first, the view would leak.

## Decision

Enable RLS in the same migration that creates each table. `0007_rls_policies.sql` contains *only* policy statements (no `alter table ... enable row level security`).

Order:

- `0001_extensions.sql` — `pgcrypto`, `pg_cron` (in `extensions` schema)
- `0002_profiles_and_subscriptions.sql` — tables + `enable row level security` for both
- `0003_shops_and_owner.sql` — tables + RLS enabled
- `0004_domain_tables.sql` — tables + RLS enabled
- `0005_functions_triggers.sql` — `handle_new_user`, `complete_onboarding`, `current_shop_id`, `expire_subscriptions`
- `0006_views.sql` — `subscription_effective` (RLS on underlying tables already on)
- `0007_rls_policies.sql` — policies only
- `0008_cron.sql` — schedule `expire_subscriptions` daily at 00:05
- `0009_sale_purchase_functions.sql` — `record_sale()`, `record_purchase()` (added later in M3/M4)

## Alternatives considered

- **Follow PRD literally** — accepts a brief data leak window. Rejected because `apply_migration` runs migrations transactionally per file but there's no guarantee policies finish applying before another tool reads from the project.
- **Combine RLS-enable + policy in `0007`** — simpler but leaks during the gap. Rejected.

## Consequences

- During M2, when `0007_rls_policies.sql` is applied, every table already has RLS on (deny-by-default). Without policies, *no rows* are readable — that's exactly what we want; the next statement adds the read/write policies.
- Each table-creation migration becomes slightly longer but self-contained.
- `0001_extensions.sql` includes `create extension if not exists pg_cron with schema extensions;` so `0008_cron.sql` cannot fail on a missing extension.
