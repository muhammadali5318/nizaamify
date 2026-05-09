# 0010 — Admin runbook for manual subscription activation

## Context

PRD §6 and Appendix B describe a manual offline payment flow: customer pays via bank transfer, sends proof, admin (you) flips their subscription to `active` via SQL. No payment gateway in MVP.

## Decision

Document the exact SQL snippets here so they're versioned with the codebase. Run via `mcp__supabase__execute_sql` (or the Supabase SQL editor).

### Activate / renew (after offline payment)

```sql
update public.subscriptions
set status = 'active',
    current_period_starts_at = now(),
    current_period_ends_at = now() + interval '1 month',
    last_payment_date = current_date,
    last_payment_amount = <amount>,
    notes = '<bank reference / WhatsApp screenshot id>',
    updated_at = now()
where user_id = '<uuid>';
```

### Suspend (refund / abuse)

```sql
update public.subscriptions
set status = 'suspended',
    notes = '<reason>',
    updated_at = now()
where user_id = '<uuid>';
```

### Lookup current state

```sql
select user_id, status, trial_ends_at, current_period_ends_at,
       last_payment_date, last_payment_amount, notes
from public.subscriptions
where user_id = '<uuid>';
```

### Find user_id by email

```sql
select id, email
from auth.users
where email = '<customer_email>';
```

## Alternatives considered

- **Build an admin UI** — out of scope for MVP; SQL is enough for the first dozen customers.
- **Use Supabase dashboard table editor** — works, but loses the audit trail of SQL history.

## Consequences

- On payment: support copies the customer's `user_id` from `auth.users`, runs the activate snippet, optionally messages them in Urdu/English.
- The user regains access on next `useEffectiveSubscription` refetch (≤ 5 min staleness window) or page refresh.
- All actions logged in Postgres logs (`mcp__supabase__get_logs service=postgres`).
