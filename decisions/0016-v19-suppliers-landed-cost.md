# 0016 — v1.9 stock-in: suppliers, landed cost, snapshot avg-before/after

## Context

The pre-v1.9 stock-in module had four separate problems:

1. The "Effect on inventory" panel on the stock-in detail page was effectively broken. `avg_before` was hard-coded to `—`, and `avg_after` only ever showed a value when `products.last_purchase_cost` happened to match this row's `cost_at_purchase` — a fragile inference that gave wrong results whenever a later purchase was at the same unit cost or whenever the most-recent cost had since changed. Even when the inference matched, it surfaced the *current* `products.avg_cost` rather than the avg-cost right after that specific stock-in.
2. The product picker in the new-stock-in form was a `<TextField select>` that loaded *all* products. Past 1,000 products it became unusable.
3. There was no concept of a supplier as a first-class entity. Stock-ins had a free-text `source` column. No way to filter, no foundation for supplier-comparison reports.
4. There was no way to capture the real cost of stock — delivery, labor, customs, and other overheads were either lost or recorded separately as expenses, leaving `avg_cost` understated. The user's specific question on this ticket: *"I bought 10,000 PKR of stock, paid 9,000 delivery + 4,500 labor — how do I handle this?"*

v1.9 closes all four.

## Decisions

### 1. Snapshot avg-before/after on `purchase_items` at insert time

`purchase_items` gained two new columns: `avg_cost_before numeric(12,2)` and `avg_cost_after numeric(12,2)`, populated inside `record_purchase`. The stock-in detail page reads them directly. No replay, no inference. Pre-v1.9 rows show `—` honestly via a banner — *"Average-cost snapshots are recorded for stock-ins from v1.9 onwards. Older entries show —."*

This replaces the heuristic in `PurchaseDetailPage.tsx:99-121`. The fix is simpler and always correct.

### 2. Suppliers as a first-class entity

New `suppliers` table — shop-scoped via RLS, soft-delete via `is_active`, case-insensitive uniqueness on `(shop_id, lower(trim(name))) where is_active = true`, pg_trgm index for fuzzy search. Three RPCs follow the v1.4 customer pattern: `search_suppliers`, `recent_suppliers`, `create_supplier_inline`.

`purchases.supplier_id` is **nullable** — opening-stock entries (`is_opening = true`) and pre-v1.9 rows have no supplier. The form requires it for non-opening stock-ins; the DB doesn't. ON DELETE on suppliers is `RESTRICT` so a supplier can't be hard-deleted without first detaching its purchases (which the append-only trigger would block anyway — admin must run with trigger disabled).

The v1.5 `source` text column stays. It's now denormalized to the supplier's name at insert time when one is provided, falling back to `'Direct purchase'` or `'Opening Stock'`. This preserves backward compatibility with pre-v1.9 rows that only have `source`.

### 3. Landed-cost allocation: pro-rata by line value

When a stock-in includes overhead (delivery, labor, customs, packaging, other), the totals are stored on the parent `purchases` row (`items_subtotal`, `overhead_subtotal`, with the invariant `total_cost = items_subtotal + overhead_subtotal`). Each overhead item is recorded in a new append-only `purchase_overhead_items` table for audit.

Overhead is distributed across line items proportional to their line value:

```
items_subtotal      = sum over all lines of (qty × cost_at_purchase)
overhead_subtotal   = sum over all overhead rows of amount
overhead_share      = overhead_subtotal × (line_value / items_subtotal)
overhead_per_unit   = overhead_share / qty
effective_unit_cost = cost_at_purchase + overhead_per_unit
```

The product's WAC update inside `record_purchase` uses `effective_unit_cost`, not `cost_at_purchase`. So when a shop owner pays 9,000 in delivery + 4,500 in labor on a 900,000 PKR purchase, every product's `avg_cost` reflects the 1.5% overhead lift. Profit calculation downstream (`sale_price − cost_at_sale`) is correct.

`purchase_items.overhead_per_unit` is stored separately from `cost_at_purchase`. The detail view shows both columns plus the effective cost.

### 4. `last_purchase_cost` stays as supplier's quoted price, not effective landed cost

The two columns serve different purposes:

- **`last_purchase_cost`** answers *"what did I pay the supplier per unit?"* — useful for re-ordering decisions, supplier comparisons, and recognizing that a supplier raised prices.
- **`avg_cost`** answers *"what does this unit really cost me on average?"* — used by sale-side cost recording (`sale_items.cost_at_sale`) and by gross-profit reports.

Conflating them would obscure both signals.

### 5. Bidirectional cost calculation in the line-item editor

The form's three numeric fields per line — qty / unit cost / line total — are now bidirectional. Editing any two computes the third. The last-edited field stays put; the others recompute if they have enough information. When a back-computed quantity isn't an integer (the schema requires `qty > 0` integer) the form rounds and surfaces an inline warning: *"Unit cost doesn't divide evenly into total — adjust qty or unit cost."*

The recompute logic is local to the form (`recompute()` helper in `NewPurchasePage.tsx`). The submit path validates qty as positive integer and cost as non-negative numeric(12,2) regardless of which fields the user actually typed in.

### 6. Searchable product / supplier comboboxes shared with the rest of the app

`<ProductCombobox>` and `<SupplierCombobox>` are new shared components built on `<Combobox>` (v1.7's MUI Autocomplete wrapper). They mirror the v1.4 `CustomerPicker` pattern exactly: debounced 250ms, server-paginated 10 results, accumulating "Load more" tail, "+ Create new …" footer that opens an inline-create modal and auto-selects the new entity.

POS does not currently use a `<ProductCombobox>` — it renders the products list directly. When POS is rebuilt (future ticket), it should adopt this combobox so we don't ship two parallel implementations.

### 7. Stock-in list defaults to MTD; pagination + filters are URL-driven

`/purchases` defaults to **this month** (first of month → today) and 10 rows per page. Filters: date-range preset (MTD / 30 / 90 / year / custom), supplier, include-opening-stock checkbox. State is mirrored to URL search params so refresh + back-button work.

Server-side pagination via two RPCs (`search_purchases`, `search_purchases_count`) — same pattern as v1.5 product search.

## Alternatives considered

- **Snapshot only avg_cost_after, compute avg_cost_before on the fly** by reading the previous stock-in's avg_cost_after. Rejected — adds a dependency between rows, breaks if any row is later voided, and gains nothing over snapshotting both. Storage cost is two `numeric(12,2)` per row.
- **Pro-rata allocation by quantity** (each unit gets equal share of overhead) — rejected. Overhead correlates more with value than with units in most retail/wholesale contexts. By-value matches the standard accounting treatment of "landed cost" / "freight-in capitalization."
- **By weight or volume allocation** — most accurate for delivery, but requires per-product weight data we don't have.
- **Track overhead as a separate expense** (don't allocate to inventory) — undercounts product cost, overstates gross margin. Rejected because the shop owner specifically wants `avg_cost` to reflect what units really cost.
- **Make `purchases.supplier_id` NOT NULL with a synthetic "walk-in" row** — rejected as needless ceremony for opening stock and direct purchases. Nullable is honest.
- **Build a full supplier balance / payable feature** — out of scope for v1.9, deferred to a future ticket; mirrors the customer khata model but is its own design problem.

## Consequences

- **Cross-shop isolation preserved**: suppliers + purchase_overhead_items both have shop-scoped RLS via `current_shop_id()`; the `record_purchase` RPC validates that any supplier_id passed in belongs to the caller's shop.
- **Append-only enforcement extended**: `purchase_overhead_items` joins the v1.8 list of immutable financial tables. Corrections require a separate corrective entry; the table can't be patched.
- **Migration backfilled `purchases.items_subtotal = total_cost`** on existing rows (where overhead is 0). This required temporarily disabling the v1.8 `purchases_no_modify` trigger inside the migration — see §B of `0024_v19_suppliers_landed_cost.sql`. New gotcha logged in CLAUDE.md.
- **Frontend RPC contract changed**: `record_purchase` now takes `(p_supplier_id, p_purchase_date, p_note, p_items, p_overhead_items, p_is_opening)` instead of the v1.5 `(p_source, p_note, p_purchase_date, p_items, p_is_opening)` signature. The old function was dropped explicitly to prevent a stale overload.
- **Auth gotcha** (v1.9a fix-up): Supabase auto-grants EXECUTE explicitly to `anon` (not via PUBLIC) on every newly created function, so `revoke from public` is a no-op for anon. The standing pattern is now `revoke from public, anon; grant to authenticated`. Same root cause as v1.8a's `revoke from public` issue, different symptom.
- **`auto_focus` accessibility lint** kicked in on the new dialogs — removed `autoFocus` from the first input on supplier and product create modals. (Non-fatal; lint just complained.)
- **`pg_trgm` operator usage** in `search_suppliers` requires `set search_path = public, extensions, pg_catalog` since v1.8 moved the extension. Already applied; mentioned in the gotchas section of CLAUDE.md.

## Runbooks

- **Drift check**: `select count(*) from public.customer_balance_reconciliation where drift <> 0;` should still be 0. Unrelated to v1.9 but worth re-running after any migration.
- **Verify v1.9 worked example**: stock-in with two lines (10@50,000 and 5@80,000) plus 9,000 delivery + 4,500 labor should produce `purchase_items.overhead_per_unit` of 750 and 1,200 respectively, and effective unit costs of 50,750 and 81,200 in the avg_cost calculation.
- **Editing a stock-in**: not possible. Append-only. To correct, void the original (future `void_sale` for sales; manual `purchase_overhead_items` reversal RPC for purchases — also a future ticket) or record an adjusting purchase.
- **Archiving a supplier**: `update suppliers set is_active = false where id = …`. Hidden from new stock-ins; past purchases keep their history via the FK.
