# Final production state: `receive_payment`

Generated 2026-05-13 from `mcp__supabase__execute_sql` against project `orfggrnyychmmqdlbfhf`.

## Migration provenance

- **First introduced**: `0012_v13_avg_cost_and_links.sql` — original `receive_payment(uuid, numeric, uuid, text)` (with `p_invoice_id` for invoice-tied payments).
- **Subsequent rewrites**:
  - `0019_v16a_traditional_khata.sql` — drops `p_invoice_id`, signature becomes `(uuid, numeric, text)`. Locks customer row, validates outstanding, inserts a `'credit'` `ledger_entries` row. Serializes concurrent payments via `FOR UPDATE` on `customers`.
  - `0076_v29_modify_existing_rpcs.sql §3` — **rename-and-wrap**: `ALTER FUNCTION ... RENAME TO receive_payment_v28`; new wrapper with `not_authenticated` / `no_shop_for_user` / `receive_payment` permission check; delegates. Bare wrapper.
  - `0076b_v29_conditional_projection_and_caps.sql §8` — wrapper gains the non-owner daily payment cap: read `shops.salesperson_payment_cap_pkr`, sum today's credit `ledger_entries` rows created by the caller in this shop, raise `salesperson_payment_cap_exceeded` if `today_total + p_amount > cap`. Owner bypasses. Serialization via `pg_advisory_xact_lock(hashtextextended(shop || user || current_date, 0))`. (superseded by 0080+0086)
  - `0080_v29_audit_by_user_id_writes.sql` — wrapper post-delegation `UPDATE ledger_entries set created_by_user_id = auth.uid() where id = v_id`. **(superseded by 0086 — append-only trigger blocks the UPDATE.)**
  - `0086_ledger_audit_at_insert.sql` — **(live)** rewrites `receive_payment_v28` to write `created_by_user_id = v_user_id` inline at the `INSERT INTO ledger_entries`. Outer wrapper drops the post-delegation UPDATE; everything else stays.
- **Final state**: the body as it exists today on prod is the post-0086 wrapper + the post-0086 `_v28` body. See SQL below.

## Wrapper signature

```sql
CREATE OR REPLACE FUNCTION public.receive_payment(
    p_customer_id uuid,
    p_amount numeric,
    p_notes text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_is_owner boolean; v_cap numeric; v_today_total numeric; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'receive_payment') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: receive_payment'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount_must_be_positive' using errcode = 'P0001'; end if;
  select is_owner into v_is_owner from public.user_shop_access where user_id = auth.uid() and shop_id = v_shop_id;
  if v_is_owner is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not v_is_owner then
    perform pg_advisory_xact_lock(hashtextextended(v_shop_id::text || auth.uid()::text || current_date::text, 0));
    select salesperson_payment_cap_pkr into v_cap from public.shops where id = v_shop_id;
    select coalesce(sum(amount), 0) into v_today_total
      from public.ledger_entries
     where created_by_user_id = auth.uid() and shop_id = v_shop_id
       and type = 'credit' and created_at::date = current_date;
    if v_today_total + p_amount > v_cap + 0.001 then
      raise exception 'salesperson_payment_cap_exceeded' using errcode = 'P0001',
        detail = format('today total %s + this %s > cap %s', v_today_total, p_amount, v_cap); end if;
  end if;

  -- Delegate; created_by_user_id written inline (0086). No post-update.
  v_id := public.receive_payment_v28(p_customer_id, p_amount, p_notes);
  return v_id;
end; $function$
```

## Inner `_v28` body

```sql
CREATE OR REPLACE FUNCTION public.receive_payment_v28(
    p_customer_id uuid,
    p_amount numeric,
    p_notes text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_entry_id uuid;
  v_outstanding numeric(12,2);
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_must_be_positive' using errcode = 'P0001';
  end if;

  select outstanding_balance into v_outstanding
    from public.customers
   where id = p_customer_id and shop_id = v_shop_id
   for update;
  if not found then raise exception 'customer_not_in_shop' using errcode = 'P0001'; end if;
  if p_amount > v_outstanding then
    raise exception 'overpayment_customer max=%', v_outstanding using errcode = 'P0001';
  end if;

  -- 0086: write created_by_user_id inline.
  insert into public.ledger_entries (
    shop_id, customer_id, invoice_id, amount, type,
    occurred_at, paid_at, notes, created_by_user_id
  ) values (
    v_shop_id, p_customer_id, null, p_amount, 'credit',
    now(), now(), nullif(trim(p_notes), ''), v_user_id
  ) returning id into v_entry_id;

  return v_entry_id;
end;
$function$
```

## Error envelope

The wrapper layer uses `using errcode = 'P0001'` explicitly. The `_v28` inner body also uses `using errcode = 'P0001'` for the three caller-meaningful checks (`amount_must_be_positive`, `customer_not_in_shop`, `overpayment_customer`); the two preconditions inherited from the v2.8.5 body (`not_authenticated`, `no_shop_for_user`) raise without `using errcode` but default to P0001.

| Where | Error message | errcode | When raised | Frontend UX mapping |
|---|---|---|---|---|
| wrapper | `not_authenticated` | P0001 | `auth.uid()` null | redirect to `/login` |
| wrapper | `no_shop_for_user` | P0001 | `current_active_shop_id()` returns null **OR** `user_shop_access` row not found | redirect to `/onboarding` or shop switcher |
| wrapper | `insufficient_permissions` (detail: `Required: receive_payment`) | P0001 | `user_has_permission(shop, 'receive_payment')` false | toast per B.5 |
| wrapper | `amount_must_be_positive` | P0001 | `p_amount is null or <= 0` | form-field error on khata payment dialog |
| wrapper | `salesperson_payment_cap_exceeded` (detail: `today total <n> + this <n> > cap <n>`) | P0001 | non-owner; today's running credit total + p_amount exceeds `shops.salesperson_payment_cap_pkr` | `errors.khata.dailyCapExceeded` — toast: "You can only receive PKR {cap} per day. {remaining} remaining today." Parse detail for the three numbers. |
| inner | `not_authenticated` | P0001 | defensive; unreachable when called via wrapper | redirect to /login |
| inner | `no_shop_for_user` | P0001 | defensive; unreachable when called via wrapper | redirect to onboarding/switcher |
| inner | `amount_must_be_positive` | P0001 | duplicate of wrapper check (defensive) | form-field error |
| inner | `customer_not_in_shop` | P0001 | `p_customer_id` not in this shop | "Customer not found — reload" |
| inner | `overpayment_customer max=<n>` | P0001 | `p_amount > customers.outstanding_balance` | inline: "Customer's outstanding is only PKR {n}" — parse `max=` from message |

## Invocation contract

- **Params**:
  - `p_customer_id uuid` — required; the customer to credit
  - `p_amount numeric` — must be `> 0` and `<= customers.outstanding_balance`
  - `p_notes text default null` — free text or null
- **Returns**: `uuid` (the new `ledger_entries.id`)
- **Permission gates**:
  - Wrapper: `receive_payment` (always)
  - Wrapper: non-owner daily payment cap (`shops.salesperson_payment_cap_pkr`). Owner bypasses.
- **Side effects**:
  - INSERT one `'credit'` row into `ledger_entries` (`invoice_id = null`, `created_by_user_id = v_user_id` inline). The `customers.outstanding_balance` materialization is derived (computed via trigger / view); not directly written by this RPC.
  - `FOR UPDATE` lock on the `customers` row in the inner body — serializes concurrent payments to the same customer.
- **Append-only constraints respected**:
  - `ledger_entries` — write `created_by_user_id` at INSERT (post-0086). Post-delegation UPDATE was removed because `ledger_entries_no_modify` trigger blocks any UPDATE.

## Notes

- **Cap serialization**: the wrapper takes `pg_advisory_xact_lock` keyed on `(shop, user, day)` before reading `today_total`. Without this lock, two concurrent receive_payment calls could each read a stale `today_total` and both pass the cap check. The advisory lock is released at transaction commit/rollback. Lock key collisions across `(shop, user, day)` triples are astronomically unlikely (`hashtextextended` is 64-bit).
- **Cap check uses `created_by_user_id`**, not cashier — this is the audit column that v2.9 writes. For pre-0086 ledger rows (when `created_by_user_id` was null until the post-delegation UPDATE landed), the cap sum would miss them. The new code writes inline so this is no longer a concern, but historical reporting on v2.9 cap usage starts from migration 0086 deploy time.
- **`amount_must_be_positive` is checked twice** (wrapper + inner) — defensive duplication. The wrapper's check fires first.
- **Inner uses `current_shop_id()`, wrapper uses `current_active_shop_id()`**. The two are equivalent today (both read the `app-shop-id` header via the same code path), but the wrapper deliberately uses the v2.9 helper because that's the audited entry point. The inner uses the older helper from v2.8.5 unchanged.
- **No advance payments**: the inner body raises `overpayment_customer` if `p_amount > outstanding`. v2.9 has no concept of customer credit balance (deferred to v2.10+).
- **`occurred_at` and `paid_at` are both `now()`** — credit ledger entries don't distinguish between "transaction date" and "payment date" (cash receipts are instantaneous).
- **Invoice tying**: `invoice_id` is always null for `receive_payment` (traditional khata, post-v1.6a). Sale-tied debits live on the v2.9 `record_sale` path with `invoice_id` set; those cannot be reversed via `receive_payment`.

## Discrepancies vs RPC inventory

None. Inventory section §1.6 lists the wrapper and `_v28` errors accurately. Two minor clarifications:
- Inventory §3.3 lists `amount_must_be_positive` against `receive_payment` (wrapper) — true; but it's also raised by the inner body as a defensive duplicate. Frontend should match on message text either way; same outcome.
- Inventory §3.7 lists `overpayment_customer max=<n>` under "Ledger reversal errors" — actually that's a `receive_payment_v28` raise, not a `reverse_ledger_entry_v28` raise. The header label in §3.7 is misleading; the row itself correctly attributes it to `receive_payment_v28`.
