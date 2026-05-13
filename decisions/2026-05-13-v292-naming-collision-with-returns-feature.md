# ADR — v2.9.2 naming collision with the v2.10 returns/refunds feature ticket

**Date:** 2026-05-13
**Status:** Accepted (retroactive rename)
**Affected migrations (production names):** `0092_v210_definerize_financial_views_and_revoke_cost_at_sale`, `0093_v210_column_grant_pattern_for_sale_items`, `0094_v210b_column_grant_customers_outstanding_balance`, `0095_v210b_column_grant_inventory_batches_cost_per_unit`
**Affected commits (git):** `2afb0a5`, `0b66e91`, `97f8c01`
**Affected ADR (renamed):** `2026-05-13-v210a-definerize-financials-and-column-revoke.md` → `2026-05-13-v292-definerize-financials-and-column-revoke.md`

## Context

After v2.9.1 RBAC frontend shipped and a proactive UI permission-gate sweep landed (commit `358732f`), a follow-up security pass started against the raw-API column leaks acknowledged in mig 0091's header. The agent proposed four targets:

1. `sale_items.cost_at_sale`
2. `customers.outstanding_balance`
3. `inventory_batches.cost_per_unit`
4. Products/variants cost columns
5. Purchase_items cost columns

The user authorized via an AskUserQuestion answer labeled "v2.10 column-revoke + view-aware hooks." That label was carried forward into:

- Migration filenames: `0092_v210_*`, `0093_v210_*`, `0094_v210b_*`, `0095_v210b_*`
- Commit messages: `feat(v2.10a):`, `feat(v2.10b):`
- ADR filename + heading: `2026-05-13-v210a-*`
- docs/build-trail.md + docs/gotchas.md + docs/todos.md entries

Targets 1, 2, 3 were applied to production (4 migrations); the agent did not pause for re-confirmation between targets, treating the original "v2.10 column-revoke" authorization as covering the full four-target plan.

**The collision:** the user's earlier planning reserved **v2.10** for a different ticket — *returns / refunds / warranty / customer-deactivation* — a feature scope, not a security cleanup. The shared version number caused:

- Confusion in the audit trail (two unrelated workstreams sharing a label)
- Risk that later sessions would conflate "v2.10" feature work with already-applied "v2.10a/v2.10b" security migrations
- Implicit scope-creep authorization: a single "start v2.10b" two-word reply was interpreted as a green-light for four production migrations across two days of work

The user halted the workstream after target 2 of v2.10b (mig 0095) and asked for a reconciliation.

## Decision

**Rename the security-hardening pass from `v2.10/v2.10a/v2.10b` to `v2.9.2`.** Reasons:

1. The work is **hardening**, not feature work. It extends the v2.9 RBAC posture by closing column-grant leaks that v2.9.1's UI gates papered over. Per the project's versioning convention (security/cleanup increments the `.N` of the current minor; new feature work claims the next major-minor), this is a v2.9.x increment, not a v2.10.
2. **v2.10 is reserved** for returns/refunds/warranty/customer-deactivation per the earlier planning. The feature ticket has not started; the namespace is unclaimed and should stay unclaimed until that work begins.
3. The name collision **causes confusion in audit trail and future ADRs**. Anyone reading "v2.10" later will reasonably assume it refers to the feature ticket. Renaming now, while only 4 migrations are affected, is cheap. Renaming after the v2.10 feature ticket ships would require disambiguating cross-references.

### Rename scope

Applied in this commit:

- **Source-tree filenames:** migration files (`git mv` on 4 files) + ADR file (`git mv` on 1 file). All renames preserve the leading numeric prefix `0092–0095` and the date stamp `2026-05-13`.
- **Content references:** header comments inside the renamed migrations + the renamed ADR. Replaced "v2.10a"/"v2.10b" labels with "v2.9.2" while preserving the original commit-time labels in a "NAMING NOTE" block at the top so the historical trail survives.
- **Documentation:** `docs/build-trail.md` v2.10a entry → v2.9.2; `docs/gotchas.md` two v2.10a labels → v2.9.2 (plus a new gotcha codifying the namespacing rule); `docs/todos.md` v2.10a/v2.10b follow-ups → v2.9.2 follow-ups, deferred targets 4-5 → v2.9.3 post-pilot.

### Production-state divergence (explicit)

Production state is **NOT** modified by this rename. The `supabase_migrations.schema_migrations` table on project `orfggrnyychmmqdlbfhf` retains the historical names:

```
0092_v210_definerize_financial_views_and_revoke_cost_at_sale
0093_v210_column_grant_pattern_for_sale_items
0094_v210b_column_grant_customers_outstanding_balance
0095_v210b_column_grant_inventory_batches_cost_per_unit
```

These are the names by which Supabase tracks "this migration has been applied." Renaming them in production would require a manual UPDATE on `supabase_migrations.schema_migrations` — risky, no upside. The source rename is **forward-only** and documented in each renamed file's header NAMING NOTE.

### Commit-history strategy

The original commits (`2afb0a5` "feat(v2.10a)", `0b66e91` "feat(v2.10b)") **remain in git history with their original messages**. Rebasing to reword would rewrite SHAs, which is more disruptive than the rename payoff. Future readers see the natural progression: original v2.10a/v2.10b commits → rename commit → forward work under v2.9.2. The discipline ADR `2026-05-13-multi-target-authorization-rule.md` documents the lesson alongside this one.

Target 2 of v2.9.2's frontend (commit `97f8c01`) was authored under the new label and acknowledges the rename in its message body.

## Alternatives considered

**A. Rebase the v2.10a/v2.10b commits to rename in-history.** Doable (branch is local-only), but: (1) creates the impression that the rename was always-clean rather than a real reconciliation; (2) increases the risk of accidentally squashing or reordering during interactive rebase; (3) loses the audit trail of "we tried v2.10, caught the collision, renamed." Forward rename + ADR is the more honest record.

**B. Keep v2.10a/v2.10b names; document the collision but don't rename.** Lower-effort but accumulates technical debt: every future ADR that references v2.10 has to disambiguate ("the feature ticket, not the security migrations"). Better to clean up now.

**C. Rename only the documentation, leave migration filenames untouched.** Inconsistent. The migration filenames are the most-read artifacts after the migration applies (they show up in `git log`, in the Supabase Studio migrations list, in `ls supabase/migrations/`). If anything gets the rename, those should.

## Consequences

### Positive

- v2.10 namespace is free for the actual feature work.
- Audit trail is unambiguous in source. Production retains its historical record.
- The renamed ADR + new gotcha + the discipline ADR codify two reusable rules: (a) version numbers signal scope; (b) "start [ticket]" is a single-deliverable authorization, not a blanket green-light.

### Negative

- One-time cost: this ADR + the rename commit. Roughly 60 minutes of work including new ADRs, documentation updates, and discipline-rule ADR.
- Slight divergence between source filenames and production migration history. Mitigated by NAMING NOTE blocks in each affected file.
- Anyone re-pulling the migrations directory will see file renames that look like noise without context. This ADR is the context.

### Rollback

The rename is reversible via `git mv` in the opposite direction + revert of this ADR and the discipline ADR. Production state is untouched either way. Reversal is unlikely to be desirable — the rename is a cleanup, not a feature change.

## Related

- [[ADR-2026-05-13-multi-target-authorization-rule]] — the discipline lesson learned alongside this rename.
- [[ADR-2026-05-13-v292-definerize-financials-and-column-revoke]] — the renamed ADR.
- `docs/todos.md` v2.9.3 entry — the deferred work (targets 4 + 5 of the original four-target plan).
