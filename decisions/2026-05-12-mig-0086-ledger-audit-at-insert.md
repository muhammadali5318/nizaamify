# 2026-05-12 — Migration 0086: ledger audit-at-INSERT (split audit pattern)

**Status:** Filed. Resolves an architectural incompatibility between 0080's audit pattern and append-only tables.
**Date:** 2026-05-12

## Context

Migration 0080 (`v29_audit_by_user_id_writes`) introduced the v2.9 audit pattern: every wrapper RPC delegates to its `_v28` inner function, captures the affected row's primary key, then issues a post-delegation `UPDATE` to stamp `created_by_user_id = auth.uid()` (or the equivalent column). This pattern works uniformly for mutable financial tables and was QA'd against the audit-query suite.

The pattern is **incompatible with append-only tables**. The project has six append-only tables, each protected by a `*_no_modify` trigger that rejects every UPDATE:

- `ledger_entries` (trigger `ledger_entries_no_modify`)
- `invoices`
- `sale_items`
- `purchases`
- `purchase_items`
- `purchase_overhead_items`

Migration 0086's pre-investigation found that of these six, only three v2.9 wrappers attempt post-delegation UPDATEs against an append-only table — and all three target `ledger_entries`:

- `record_sale` — credit/partial-pay sales insert a debit row in `ledger_entries`.
- `receive_payment` — inserts a credit row in `ledger_entries`.
- `reverse_ledger_entry` — inserts a reversal row.

All three crashed with `P0001: ledger_entries are append-only — reverse the entry instead of updating it` on first live invocation. The trigger correctly refused the audit-stamp UPDATE; the wrapper had no fallback. The other five append-only tables already received their audit columns at INSERT time inside the `_v28` body (e.g. `invoices.cashier_id` is set inline at INSERT). No other wrapper needs this fix.

## Decision

**Split the audit pattern by table mutability.**

- **Mutable target tables** keep the 0080 pattern: wrapper delegates to `_v28`, then issues a post-delegation `UPDATE ... SET <audit_column> = auth.uid()`. No change.
- **Append-only target tables** (any of the six) use an **audit-at-INSERT** pattern: the wrapper passes `auth.uid()` as `p_created_by_user_id` directly into the `_v28` body, which stamps the column inside the INSERT statement. The row is born with its audit column populated; no UPDATE is ever attempted.

Migration 0086 rewrites `record_sale_v28`, `receive_payment_v28`, and `reverse_ledger_entry_v28` to accept the user ID via parameter and stamp it at INSERT. The outer wrappers pass `auth.uid()` explicitly. The append-only trigger is left untouched — the immutability invariant on `ledger_entries` is preserved.

The discipline rule added to `docs/gotchas.md`: **for append-only tables, audit columns must be written at INSERT inside the function doing the insert. Post-delegation UPDATEs do not work.**

See `supabase/migrations/0086_ledger_audit_at_insert.sql` for the full rewrite (lines 1-23 contain the rationale block).

## Alternatives considered

1. **Add an allowlist exception to the `ledger_entries_no_modify` trigger admitting audit-only UPDATEs.** Rejected. The trigger's purpose is to enforce ledger immutability — that's a load-bearing invariant for forensic reconstruction and for ADR-0007's "ledger entries are records, not state." Weakening the trigger to allow audit-only UPDATEs creates a column-allowlist surface that future migrations would have to expand each time a new audit column appears; the invariant erodes per migration.
2. **Maintain a parallel `ledger_entries_audit` side table and join at read time.** Rejected. Extra storage + a join cost on every ledger read. The audit data is already part of the row's semantic identity (who recorded the sale that caused this ledger debit); separating it into a side table inverts the data model.
3. **Move all six append-only tables to the audit-at-INSERT pattern uniformly.** Considered. Five of the six already do this naturally (the column is set inline at INSERT). Only `ledger_entries` needed the explicit fix because three wrappers had been written assuming the 0080 pattern. The "uniform" version would require auditing all `_v28` bodies for partial implementations; not worth the churn when the actual breakage is isolated.

## Consequences

**Positive:**
- The three wrapper RPCs (`record_sale`, `receive_payment`, `reverse_ledger_entry`) execute under live traffic without raising the append-only trigger.
- `ledger_entries.created_by_user_id` is authoritative from the moment of INSERT. No window where the row exists with NULL audit data. Forensic queries that filter on `created_by_user_id IS NOT NULL` will catch every ledger row recorded after 0086.
- The append-only invariant on `ledger_entries` (and all five other append-only tables) is preserved exactly.

**Negative / accepted:**
- The audit pattern is no longer uniform. Wrapper authors must know which target table is append-only and pick the correct pattern. Documented in `docs/gotchas.md` and called out at the top of the migration.
- AQ-23 (the DEFINER-wrapper shape-drift detector, see [[2026-05-13-rbac-audit-query-refinements]]) was extended to accept both audit patterns. Wrappers targeting append-only tables are exempt from the "post-delegation UPDATE" shape check.

## Discipline lesson

The discovery path for this bug traces back through `decisions/2026-05-12-v2-9-0-1-frontend-sweep.md` §Discipline lesson. The audit pattern in 0080 was QA'd against synthetic tests that called the wrappers in `BEGIN ... ROLLBACK` blocks. The post-delegation UPDATE succeeded in those tests because the synthetic role had `BYPASSRLS` privileges or because the trigger was somehow not exercised in the test path. Only real `authenticated`-role traffic from a new owner recording their first credit sale fired the trigger.

This is the same lesson that motivated the [[feedback-synthetic-tests-real-role]] memory rule (`docs/gotchas.md`): synthetic tests do not exercise the planner / trigger path the way real-role traffic does. The 0086 fix is part of the same forensic chain that produced [[2026-05-12-mig-0082-revert-profiles-policy-recursion]], [[2026-05-12-mig-0083-drop-profiles-team-read]], [[2026-05-12-mig-0084-current-active-shop-id-grouping-fix]], and [[2026-05-12-mig-0085-current-active-shop-id-array-agg]] — four bugs in four migrations, all surfaced within the same live-traffic session, all rooted in the same QA gap.

Cross-reference: `decisions/2026-05-12-v2-9-0-1-frontend-sweep.md` §Discipline lesson — "backend RPC migrations that remove or tighten RLS policies on write-target tables MUST land in the same ticket as the corresponding frontend call-site sweep."

## Bookkeeping

- `supabase/migrations/0086_ledger_audit_at_insert.sql` — the DDL (30,488 bytes; rationale block at lines 1-23, rewrites for `record_sale_v28` / `receive_payment_v28` / `reverse_ledger_entry_v28` follow).
- Closes the four-migration same-session hot-patch chain: [[2026-05-12-mig-0082-revert-profiles-policy-recursion]] → [[2026-05-12-mig-0083-drop-profiles-team-read]] → [[2026-05-12-mig-0084-current-active-shop-id-grouping-fix]] → [[2026-05-12-mig-0085-current-active-shop-id-array-agg]] → 0086.
- Bundle context: `decisions/2026-05-12-v2-9-0-1-frontend-sweep.md` §Bookkeeping (lines ~140) groups 0082-0086 as backend hot-patches in front of the v2.9.1 frontend ticket.
- Related ADRs on the underlying immutability invariant: ADR-0007 (`record_sale`/`record_purchase` are SQL functions), ADR-0015 (v1.8 database hardening — append-only triggers extended to all financial tables).
- Memory rule trace: [[feedback-synthetic-tests-real-role]] for the discovery-path generalization.
