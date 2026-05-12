# MVP v2.8.4 — Expired sale policy enforcement

**Audience:** Claude Code
**Companion to:** `PRD.md` and v1.3–v2.8.3 specs.
**Stack:** unchanged.
**Type:** Safety + business-rule enforcement on top of v2.8 batch tracking.
**Realistic effort:** 1 day.
**Prerequisite:** v2.8, v2.8.1, v2.8.2, v2.8.3 all shipped.

> **What this ships.** A `expired_sale_policy` enum on products (block / warn / allow) with shop-level default and per-product override. `record_sale` enforces it: in `block` mode, FEFO refuses to draw from expired batches and the sale fails with a clear error; in `warn` mode, FEFO skips expired batches by default but allows a confirmed override if no non-expired stock exists; `allow` mode preserves v2.8's current behavior. Sales drawn from expired batches are flagged with `sold_expired = true` on `sale_items` for historical audit. Optional shop-level receipt disclaimer for expired sales (opt-in, default off).
>
> Closes a real safety gap from v2.8.3: making expired stock *visible* without preventing its *sale* was incomplete. This completes the loop.

---

## 0. How to work this ticket

### Phase A — Discovery

1. **Read `CLAUDE.md`** and recent fix specs (`v2.8`, `v2.8.1`, `v2.8.2`, `v2.8.3`). Read v2.6's `record_sale` rewrite for FEFO logic context.
2. **Skills check** — `frontend-design` for the confirmation dialog and product form addition.
3. **Inspect live data:**
   ```sql
   -- Historical context: how many sales already drew from expired batches?
   select count(*) as historical_expired_sales
   from public.sale_items si
   join public.inventory_batches b on b.id = si.batch_id
   join public.invoices i on i.id = si.invoice_id
   where b.expiry_date is not null
     and b.expiry_date < i.created_at::date;
   ```
   Output sizes the historical exposure. Useful for context but not blocking — v2.8.4 enforces going forward; historical rows stay as-is.
4. **Append entries to `tasks.md`** for v2.8.4.
5. **Append `decisions/`** scaffolds (see §7).
6. **Proceed** — small ticket, no long discovery report needed.

### Phase B — Schema migration

Single migration `00XX_v284_expired_sale_policy.sql`. Add columns to `shops`, `products`, `sale_items`. No data rewrites.

### Phase C — Backend functions

Update `record_sale` for policy enforcement in the FEFO loop. Add a helper for "is this sale about to draw from expired stock" so the frontend can prompt before submitting.

### Phase D — Frontend

Product form gets the policy dropdown. Settings gets shop-level default + receipt disclaimer toggle. POS gets a confirmation dialog when warn-mode is about to sell expired. Receipt rendering checks the disclaimer flag.

### Phase E — Verification

Smoke test all three policies. Update `CLAUDE.md`.

---

## 1. The three policies

| Policy | FEFO behavior | If only expired stock remains | Use case |
|---|---|---|---|
| **block** | Excludes expired batches from FEFO selection | Sale fails with `expired_stock_blocked` error. Cashier must write off expired stock first. | Strict shops (food, dairy). Safety-critical inventory. |
| **warn** *(default)* | Excludes expired batches from FEFO selection | Sale returns a structured "would-draw-from-expired" response. POS shows a confirmation dialog. On confirm, sale proceeds and lines are flagged `sold_expired = true`. | Most retail. Shop owner decides per-transaction. |
| **allow** | Treats expired batches like any other (current v2.8 behavior) | Silently sells from expired stock. | Clearance-sale model. Explicit opt-in. |

The default for new products is **warn**. Existing products (pre-v2.8.4) inherit the shop's default policy on read — no per-row backfill needed; the column is nullable and the function uses `coalesce(product.policy, shop.default_policy, 'warn')`.

### 1.1 Why `warn` is the right default

Shops that turn on `has_batches` are signaling they care about expiry. `allow` would be wrong for them by definition (it's the v2.8 behavior they implicitly accepted, but only because no alternative existed). `block` is too strict for the general case — a cosmetics shop legitimately wants to sell a foundation that expired yesterday at a discount. `warn` puts the decision in the cashier's hands at the moment it matters.

A pharmacy targeting this software (future) would override to `block` per product or shop default. Not our problem right now.

---

## 2. Schema changes

Single migration `00XX_v284_expired_sale_policy.sql`.

### 2.1 Enum type

```sql
do $$ begin
  create type public.expired_sale_policy as enum ('block', 'warn', 'allow');
exception when duplicate_object then null;
end $$;
```

### 2.2 `shops` table — default policy + receipt disclaimer

```sql
alter table public.shops
  add column if not exists default_expired_sale_policy public.expired_sale_policy not null default 'warn',
  add column if not exists expired_sale_receipt_disclaimer boolean not null default false;
  -- when true, receipts for sales containing expired-batch lines include a disclaimer.
  -- opt-in per shop. v2.8.4 ships with default off.
```

### 2.3 `products` table — per-product override

```sql
alter table public.products
  add column if not exists expired_sale_policy public.expired_sale_policy;
  -- nullable. null means "use shop default". explicit value overrides.
```

### 2.4 `sale_items` — historical flag

```sql
alter table public.sale_items
  add column if not exists sold_expired boolean not null default false;
  -- true when the batch's expiry_date was before the invoice's created_at::date.
  -- snapshot at sale time; never recomputed. immutable per the append-only rule.

create index if not exists idx_sale_items_sold_expired
  on public.sale_items (sold_expired) where sold_expired;
```

### 2.5 Add `sold_expired` to the immutable fields list

v1.8/v2.6's append-only trigger on `sale_items` should already reject UPDATE of arbitrary columns. Confirm `sold_expired` is in the immutable set; if the trigger uses a column allowlist, add nothing. If it uses a disallow list, ensure `sold_expired` isn't mutable.

---

## 3. Backend changes

### 3.1 Resolve effective policy

A small inline helper used by `record_sale`:

```sql
-- inside record_sale, after locking the variant and identifying the product
declare v_effective_policy public.expired_sale_policy;
begin
  select coalesce(
    (select expired_sale_policy from public.products where id = v_variant.product_id),
    (select default_expired_sale_policy from public.shops where id = v_shop_id),
    'warn'::public.expired_sale_policy
  ) into v_effective_policy;
end;
```

### 3.2 `record_sale` rewrite — FEFO with policy enforcement

The FEFO loop from v2.8 §4.3 changes shape. For batched products:

```
1. Resolve v_effective_policy (per §3.1).
2. If cart line provided a manual batch_id (override):
   - Verify batch exists, belongs to variant, is_active, has qty_remaining >= qty.
   - Check if batch.expiry_date < current_date:
     - If policy = 'block': raise `expired_stock_blocked`.
     - If policy = 'warn' AND p_confirm_expired_sale != true: raise `expired_stock_needs_confirmation`.
     - If policy = 'warn' AND p_confirm_expired_sale = true: proceed, set sold_expired = true on this line.
     - If policy = 'allow': proceed, set sold_expired = (batch.expiry_date < current_date).
   - Use that batch.
3. Else (FEFO selection):
   - Build the candidate batch list with this filter, per policy:
     - 'block' or 'warn': active AND qty_remaining > 0 AND (expiry_date IS NULL OR expiry_date >= current_date)
     - 'allow': active AND qty_remaining > 0 (current v2.8 behavior)
   - Order by: expiry_date ASC NULLS LAST, then received_at ASC, then id ASC.
   - Walk the list, allocating qty. If we can satisfy the cart line's qty entirely from this filtered list, proceed normally.
   - If we run out of non-expired stock mid-allocation:
     - 'block' policy: raise `insufficient_non_expired_stock for variant N`.
     - 'warn' policy without confirmation: raise `expired_stock_needs_confirmation` (the frontend re-submits with p_confirm_expired_sale = true).
     - 'warn' policy with confirmation: extend the candidate list to include expired batches (re-sorted by expiry desc — sell least-expired first; the just-expired stock leaves before the long-expired). Continue allocating; flag sold_expired = true on each line drawn from expired batches.
     - 'allow' policy: never reaches this branch (filter already includes expired).
```

The new function signature:

```sql
create or replace function public.record_sale(
  p_customer_id uuid default null,
  p_amount_paid numeric(12,2) default 0,
  p_service_charge numeric(12,2) default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_sale_discount_type text default null,
  p_sale_discount_value numeric(12,2) default null,
  p_confirm_expired_sale boolean default false  -- v2.8.4 NEW
) returns uuid
```

`p_confirm_expired_sale` is the user's explicit "yes, I confirm selling from expired stock" signal — only meaningful in warn mode. In block mode it's ignored (the policy is non-negotiable). In allow mode it's a no-op.

### 3.3 Pre-flight check for the POS

The frontend needs to know *before* submitting whether the sale will hit an expired batch in warn mode, so it can show the confirmation dialog without a round-trip failure. A read-only helper RPC:

```sql
create or replace function public.preflight_expired_sale_check(
  p_items jsonb default '[]'::jsonb
) returns table (
  variant_id uuid,
  would_draw_expired boolean,
  expired_batch_ids uuid[],
  policy public.expired_sale_policy
)
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_item jsonb;
  v_variant_id uuid;
  v_qty int;
  v_policy public.expired_sale_policy;
  v_non_expired_stock int;
  v_would_draw_expired boolean;
  v_expired_batches uuid[];
begin
  if v_shop_id is null then return; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'qty')::int;

    -- Resolve policy
    select coalesce(
      (select p.expired_sale_policy from public.products p
       join public.product_variants pv on pv.product_id = p.id
       where pv.id = v_variant_id),
      (select default_expired_sale_policy from public.shops where id = v_shop_id),
      'warn'::public.expired_sale_policy
    ) into v_policy;

    -- For batched variants, check if non-expired stock can cover the qty
    select coalesce(sum(qty_remaining), 0) into v_non_expired_stock
    from public.inventory_batches b
    where b.variant_id = v_variant_id
      and b.is_active
      and b.qty_remaining > 0
      and (b.expiry_date is null or b.expiry_date >= current_date);

    v_would_draw_expired := (v_non_expired_stock < v_qty);

    if v_would_draw_expired then
      select array_agg(id) into v_expired_batches
      from public.inventory_batches
      where variant_id = v_variant_id
        and is_active
        and qty_remaining > 0
        and expiry_date is not null
        and expiry_date < current_date;
    else
      v_expired_batches := array[]::uuid[];
    end if;

    return query select v_variant_id, v_would_draw_expired, v_expired_batches, v_policy;
  end loop;
end;
$$;
```

POS calls this before submitting. If any row has `would_draw_expired = true` and `policy = 'warn'`, show the confirmation dialog. If `policy = 'block'`, show a hard-error dialog with a "Write off expired stock" link to the product detail page.

### 3.4 No changes to `invoice_financials`

The single-source-of-truth profit view doesn't change. `cost_at_sale` is still snapshotted from the batch's `cost_per_unit` per v2.8 §4.3. Whether the batch was expired doesn't affect profit math — it affects safety, not money.

### 3.5 Receipt rendering — backend metadata

For sale detail and receipt rendering, surface the `sold_expired` flag per line and the shop's `expired_sale_receipt_disclaimer` setting. The frontend decides what to render based on both:

```sql
-- in the sale_detail view (or wherever sale lines are read for display):
select si.*, b.expiry_date as batch_expiry_date, ...
from public.sale_items si
left join public.inventory_batches b on b.id = si.batch_id
where si.invoice_id = $1;
```

The shop setting comes from a standard `shops` query on the receipt render path.

---

## 4. Frontend changes

### 4.1 Product form — policy dropdown

In the v2.8 "Inventory behavior" section of the product create/edit form, add (visible only when `has_batches = true`):

```
─ Inventory behavior ───────────────────────────────────
  ☑ Has batches (track batch numbers, expiry, supplier warranty)

  Expiry alert window  [ ___ days ]    (leave blank for shop default: 30)
  Warranty alert window [ ___ days ]   (leave blank for shop default: 30)

  When selling expired stock:
    ○ Use shop default (currently: Warn)
    ○ Block — refuse to sell expired stock
    ○ Warn — ask cashier to confirm
    ○ Allow — sell expired stock without warning
```

Radio group. Selection persists to `products.expired_sale_policy` (null for "use shop default", explicit enum otherwise). Help text under each option:

- Block: "Sales are blocked if only expired stock remains. Cashier must write off first."
- Warn: "Cashier sees a confirmation prompt before completing the sale."
- Allow: "Expired stock is sold like any other. No warnings."

### 4.2 Settings — shop default + receipt disclaimer

In `/settings`, the Inventory alerts section gains:

```
─ Expired stock sales ──────────────────────────────────
  Default policy when selling expired stock
    ○ Block
    ● Warn  (recommended for most shops)
    ○ Allow

  ☐ Add disclaimer to receipts for expired-stock sales
    (When enabled, receipts will note any expired-batch lines.)
```

Editing these updates `shops.default_expired_sale_policy` and `shops.expired_sale_receipt_disclaimer`.

### 4.3 POS — pre-flight check + confirmation dialog

When the cashier clicks "Complete sale" in POS:

1. Frontend calls `preflight_expired_sale_check` with the cart's items.
2. Examines the response:
   - **No row has `would_draw_expired = true`:** proceed directly to `record_sale`. No change from v2.8 behavior.
   - **Any row has `policy = 'block'` AND `would_draw_expired = true`:** show an error dialog:
     ```
     Cannot complete sale — expired stock

     The following products only have expired stock available:
     - Brand X Foundation (3 expired batches, 0 non-expired)

     This shop's policy blocks sales of expired stock for these
     products. Write off the expired batches first, then restock.

                              [ Open product ]  [ Cancel ]
     ```
     "Open product" navigates to the product detail page with the relevant batches highlighted (per v2.8.3 §1.3 pattern).
   - **Any row has `policy = 'warn'` AND `would_draw_expired = true`:** show a confirmation dialog:
     ```
     Confirm expired stock sale

     The following products will be drawn from expired stock:
     - Brand X Foundation — 2 of 5 units expired 12 days ago

     Continue with the sale?

                              [ Cancel ]  [ Yes, complete sale ]
     ```
     On confirm, call `record_sale` with `p_confirm_expired_sale = true`. On cancel, return to cart without submitting.
   - **All warn-mode expired draws + allow-mode mixed:** treat as a warn case (the warn confirmation covers it).

### 4.4 POS cart line — expired indicator

For a cart line where FEFO has selected an expired batch (only possible in `allow` mode at default, or in `warn` mode after confirmation):

```
Product                              Qty   Price       Total
Brand X Foundation                    2    750         1,500   ✕
  Batch BX-FND-260605-001 ⚠ EXPIRED [Pick batch]
```

The "⚠ EXPIRED" label uses the v1.7 `danger` token. Clicking "Pick batch" still opens the picker (per v2.8 §4.4); the picker should clearly mark which batches are expired so the cashier can pick a non-expired alternative if available.

### 4.5 Sale detail — sold_expired badge

For past sales that include expired-batch lines, the sale detail page shows a small "⚠ Expired stock" badge next to the relevant line:

```
─ Items ──────────────────────────────────────────────
  #  Product                  Qty   Price    Cost   Total
  1  Brand X Foundation        2    750     500     1,500
       Batch BX-FND-260605-001 · ⚠ Expired stock
  2  USB Cable                 5    200     150     1,000
```

Snapshot truth — even if the batch is later written off, the historical sale still shows the expired-stock flag.

### 4.6 Receipt rendering — opt-in disclaimer

When the shop has `expired_sale_receipt_disclaimer = true` AND the sale has at least one `sold_expired = true` line, the receipt footer adds:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Some items in this sale were past their expiry date.
No returns or refunds on expired items.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Wording is editable in i18n keys (§5) so shop owners can request alternative phrasing if needed (Urdu, more or less formal, etc.). For the v2.8.4 ship, the default English/Urdu strings are fine.

If `expired_sale_receipt_disclaimer = false` (default): no disclaimer renders regardless of whether the sale contained expired stock. Shop owner's call.

### 4.7 Historical audit page (small addition)

Add a small section to the existing dashboard or a new page at `/inventory/expired-sales` listing recent sales with expired-stock lines:

```
─ Recent expired-stock sales ─────────────────────────
  Last 30 days: 7 sales drew from expired batches
                                            [View all]

  May 10 · Sale #abc12345 · Brand X Foundation (2 units) — expired 12 days at sale time
  May 9  · Sale #def67890 · Olper's Milk (3 units) — expired 4 days at sale time
  ...
```

Useful for the shop owner's own spot-checks. Read-only — no actions, just visibility.

Implementation: simple query against `sale_items where sold_expired = true` joined with invoices, last 30 days. Defer the full `/inventory/expired-sales` route to v2.8.5 if scope creeps; the dashboard widget is enough for v2.8.4.

---

## 5. i18n keys (additions)

```jsonc
// locales/en/products.json (additions)
{
  "inventory_behavior": {
    "expired_sale_policy": {
      "label": "When selling expired stock",
      "use_shop_default": "Use shop default (currently: {{policy}})",
      "block": "Block",
      "block_help": "Sales are blocked if only expired stock remains. Cashier must write off first.",
      "warn": "Warn",
      "warn_help": "Cashier sees a confirmation prompt before completing the sale.",
      "allow": "Allow",
      "allow_help": "Expired stock is sold like any other. No warnings."
    }
  }
}

// locales/en/settings.json (additions)
{
  "expired_sales": {
    "section_title": "Expired stock sales",
    "default_policy_label": "Default policy when selling expired stock",
    "receipt_disclaimer_label": "Add disclaimer to receipts for expired-stock sales",
    "receipt_disclaimer_help": "When enabled, receipts will note any expired-batch lines."
  }
}

// locales/en/pos.json (additions)
{
  "expired_sale": {
    "block_dialog_title": "Cannot complete sale — expired stock",
    "block_dialog_body": "The following products only have expired stock available:",
    "block_dialog_action_open": "Open product",
    "block_dialog_action_cancel": "Cancel",
    "block_dialog_writeoff_hint": "This shop's policy blocks sales of expired stock for these products. Write off the expired batches first, then restock.",
    "warn_dialog_title": "Confirm expired stock sale",
    "warn_dialog_body": "The following products will be drawn from expired stock:",
    "warn_dialog_continue": "Yes, complete sale",
    "warn_dialog_cancel": "Cancel",
    "expired_days_ago_one": "expired {{count}} day ago",
    "expired_days_ago_other": "expired {{count}} days ago",
    "units_summary_one": "{{count}} unit",
    "units_summary_other": "{{count}} units"
  },
  "cart": {
    "batch_expired_label": "EXPIRED"
  }
}

// locales/en/sale_detail.json (additions)
{
  "expired_stock_badge": "Expired stock",
  "receipt_disclaimer_default": "Some items in this sale were past their expiry date. No returns or refunds on expired items."
}

// locales/en/dashboard.json (additions)
{
  "expired_sales_widget": {
    "title": "Recent expired-stock sales",
    "summary_one": "Last 30 days: {{count}} sale drew from expired batches",
    "summary_other": "Last 30 days: {{count}} sales drew from expired batches",
    "view_all": "View all"
  }
}
```

Mirror in `locales/ur/*`.

---

## 6. Manual test matrix

### 6.1 Default policy resolution
- New shop, default policy is `warn`, receipt disclaimer off.
- Create batched product without setting per-product policy.
- Verify `record_sale` resolves effective policy to `warn`.
- Change shop default to `block`. Verify same product now resolves to `block`.
- Set per-product policy to `allow`. Verify same product now resolves to `allow` regardless of shop default.

### 6.2 Allow mode (current v2.8 behavior preserved)
- Product with policy `allow`. One batch with `expiry_date = current_date - 5`, qty_remaining = 10.
- POS sells 3 units.
- Verify: no confirmation dialog. Sale completes. `sale_items.sold_expired = true` on that line.

### 6.3 Block mode — sufficient non-expired stock
- Product with policy `block`. Two batches: one expired (5 units), one non-expired (10 units).
- POS sells 3 units.
- Verify: FEFO skips expired batch, sells from non-expired. No dialog. Sale completes normally.
- `sale_items.sold_expired = false`.

### 6.4 Block mode — only expired stock
- Product with policy `block`. One batch, expired, qty_remaining = 10.
- POS attempts to sell 3 units.
- Verify: pre-flight check returns `would_draw_expired = true, policy = 'block'`.
- Verify: block dialog renders. "Open product" link works. "Cancel" returns to cart.
- Cart still has the product; cashier can write off the expired batch via product detail and try again.

### 6.5 Block mode — partial non-expired stock (insufficient)
- Product with policy `block`. Two batches: expired (10 units), non-expired (2 units).
- POS attempts to sell 5 units.
- Verify: pre-flight returns `would_draw_expired = true` (because non-expired alone can't cover 5).
- Block dialog renders. Sale doesn't proceed.

### 6.6 Warn mode — sufficient non-expired stock
- Product with policy `warn`. Same setup as 6.3.
- Sale completes normally, no dialog. FEFO skips expired.

### 6.7 Warn mode — only expired stock, cashier confirms
- Product with policy `warn`. One batch, expired, qty_remaining = 10.
- POS attempts to sell 3 units.
- Verify: warn dialog renders with the "expired 12 days ago" label.
- Click "Yes, complete sale".
- Verify: `record_sale` called with `p_confirm_expired_sale = true`. Sale completes.
- `sale_items.sold_expired = true` on the line.

### 6.8 Warn mode — only expired stock, cashier cancels
- Same setup. Warn dialog renders.
- Click "Cancel".
- Verify: no sale created. Cart preserved with the product still in it.

### 6.9 Warn mode — manual batch override to expired
- Product with policy `warn`. Two batches: non-expired (10) and expired (5).
- Cart line has product, default FEFO selects non-expired. Cashier clicks "Pick batch", picks the expired one.
- Cart line now shows "⚠ EXPIRED" indicator on the batch.
- POS attempts to complete sale.
- Verify: warn dialog renders. Confirmation flow same as 6.7.

### 6.10 Block mode — manual batch override to expired (rejected)
- Same setup, policy `block`.
- Cashier tries to manually pick the expired batch.
- Verify: block dialog renders on submit. Sale rejected.

### 6.11 Mixed cart — one block product, one warn product
- Cart has Brand X Foundation (warn, only expired stock) and Another Product (block, sufficient non-expired stock).
- Pre-flight check returns mixed results.
- Verify: block dialog renders first (block is the strictest). Cashier must remove or fix the block-product line before they can complete the sale.

### 6.12 Receipt disclaimer off (default)
- Shop has `expired_sale_receipt_disclaimer = false`.
- Sale with one expired-stock line completes (warn confirmation).
- Verify: receipt renders without disclaimer footer.

### 6.13 Receipt disclaimer on
- Shop toggles `expired_sale_receipt_disclaimer = true`.
- Sale with one expired-stock line completes.
- Verify: receipt footer includes the disclaimer text.
- Sale with no expired lines on same shop.
- Verify: receipt footer does not include disclaimer (only renders when at least one line is `sold_expired = true`).

### 6.14 Sale detail badge
- Past sale (from 6.7 or 6.10) viewed on sale detail.
- Verify: expired-stock badge renders next to the relevant line.
- Verify: even after the batch is later written off, the badge persists on the historical sale.

### 6.15 Dashboard widget
- Shop with 3 expired-stock sales in last 30 days.
- Verify: "Recent expired-stock sales" widget renders with summary count.
- Top entries listed. "View all" link present (route can be empty for v2.8.4 — placeholder OK).

### 6.16 Audit query — historical sold_expired count
- Run:
  ```sql
  select count(*) from public.sale_items where sold_expired = true;
  ```
- Verify count matches the manual test scenarios above.

### 6.17 RLS / cross-shop
- Account B can't see Account A's expired-sale audit data or override Account A's products' policies.

### 6.18 Regression — non-batched products
- Product with `has_batches = false`.
- POS sale. Verify: no policy check, no pre-flight overhead, no dialogs. Identical behavior to v2.8.3.

### 6.19 Regression — batched product with no expired batches
- Product with `has_batches = true`, all batches non-expired.
- POS sale.
- Verify: pre-flight returns `would_draw_expired = false`. No dialogs. Sale completes normally.

---

## 7. Decision files

1. `2026-05-13-expired-sale-policy-three-modes.md` — block / warn / allow as the policy enum. Why not a numeric "strictness level"? (Enum is clearer; the three behaviors are categorically different.)
2. `2026-05-13-warn-as-default-policy.md` — default to warn rather than block or allow. Rationale (shops that enabled has_batches care about expiry; warn balances safety with shop owner autonomy).
3. `2026-05-13-preflight-rpc-for-expired-stock-check.md` — separate read-only RPC for pre-flight check rather than a single submit-and-handle-error round-trip. Rationale (UX — dialog renders before submit, no "your sale failed" surprise).
4. `2026-05-13-sold-expired-flag-snapshotted-not-derived.md` — store sold_expired on sale_items rather than computing on read. Rationale (snapshot truth; receipt rendering would need joins to determine retroactively; immutable historical record).
5. `2026-05-13-receipt-disclaimer-opt-in.md` — opt-in per shop, default off. Rationale (some shops want legal cover, others find it embarrassing; opt-in respects both).

---

## 8. CLAUDE.md update

Append to versioned PRDs section:

```
- v2.8.4: expired sale policy enforcement. Three policies (block / warn / allow) with shop default + per-product override. record_sale enforces in FEFO: block refuses, warn requires explicit confirmation, allow preserves v2.8 behavior. sale_items.sold_expired flag for historical audit. Opt-in receipt disclaimer for expired-stock sales (default off).
```

Add to **Gotchas**:

```
- Expired sale policy resolves via coalesce(products.expired_sale_policy, shops.default_expired_sale_policy, 'warn'). Null on product means "use shop default" — don't backfill, let the coalesce handle it.
- record_sale's p_confirm_expired_sale parameter is only meaningful in warn mode. In block mode the policy is non-negotiable; in allow mode it's a no-op.
- FEFO with policy != 'allow': non-expired batches selected first (ASC by expiry). If non-expired stock is insufficient AND policy is warn AND confirmation is given, expired batches are added to the candidate list ordered by expiry DESC (least-expired-first). The just-expired stock sells before the long-expired.
- sale_items.sold_expired is a snapshot at sale time. Computed once in record_sale (compare batch.expiry_date to current_date), stored, never recomputed. The historical truth survives later writes to the batch.
- Pre-flight check (preflight_expired_sale_check RPC) is the POS's entry point to know whether a confirmation dialog is needed. It returns policy + would-draw-expired per variant in the cart. Frontend renders dialogs based on this result before calling record_sale.
- Receipt disclaimer renders only when BOTH conditions are true: shop.expired_sale_receipt_disclaimer = true AND the sale has at least one sold_expired = true line.
```

Add to **Open ToDos / Known gaps**:

```
- /inventory/expired-sales route is a v2.8.5 candidate if shops request a full historical view; for v2.8.4 the dashboard widget is sufficient.
- Pharmacy-mode shop profile abstraction (block default + always-on disclaimer + extra audit) deferred until a pharmacy customer materializes.
```

---

## 9. Out of scope

- **Pharmacy industry profile.** Defer until a pharmacy customer signs up.
- **Customer-facing return policy** (separate from the disclaimer). Future.
- **Automatic write-off of expired stock** at a configurable threshold (e.g., "auto-write-off batches expired 30+ days"). Shop owner action — system surfaces (v2.8.3), shop owner decides. Don't automate write-offs.
- **Per-variant policy overrides** within a product. Product-level is enough granularity.
- **Bulk policy update across products.** Shop owner edits one at a time. Tedious for shops with 500 SKUs; not worth the bulk UI yet.
- **Expired sale notifications to shop owner** (email / SMS when an expired sale happens). Dashboard widget covers awareness. Notifications are infra work.
- **Test infrastructure.** Still skipped.

---

*End of v2.8.4 spec.*
