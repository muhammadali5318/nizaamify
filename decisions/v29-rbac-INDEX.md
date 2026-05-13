# v2.9 RBAC — ADR index

20 ADRs filed as decisions land during v2.9 implementation. Filing
order follows Phase D §D.4. Each ADR is one decision; cross-link with
`[[other-adr-name]]`.

## Foundational decisions (Phase A — filed before migration 0068)

1. [x] `2026-05-13-rbac-permission-model-over-roles.md` — Why permission-based, not role-based.
2. [x] `2026-05-13-rbac-50-permission-catalog.md` — The 50-permission count + 8 categories.
3. [x] `2026-05-13-rbac-owner-implicit-shortcut.md` — Owner has every permission via shortcut.
4. [x] `2026-05-13-rbac-presets-as-templates.md` — Presets are starting templates only.
5. [x] `2026-05-13-rbac-dependency-rules-grant-time.md` — Catalog `requires[]` enforced at grant/revoke time.

## Mechanism decisions (Phase A/B — filed during/after migration 0070, 0073, 0074, 0075)

6. [x] `2026-05-13-rbac-set-active-shop-fallback-path.md` — **Fallback chosen.** Per-call header read in `current_active_shop_id`; no Supabase pre-request hook config. (Original "set-active-shop-header-pattern" plan superseded.)
7. [x] `2026-05-13-rbac-permission-conditional-view-projection.md` — `_view`s with conditional column projection (14 DEFINER views).
8. [x] `2026-05-13-rbac-search-rpcs-conditional-projection.md` — Search RPCs gate on read-permission; body NULLs cost columns. **Closed in 0076b.**
9. [x] `2026-05-13-rbac-discount-limits-on-user-shop-access.md` — Discount limits stored per-user, not shop-default.
10. [x] `2026-05-13-rbac-receive-payment-cap-applies-to-all-non-owners.md` — Cap rule. **Closed in 0076b.**
11. [x] `2026-05-13-rbac-cashier-role-snapshot-dropped.md` — No snapshot column; audit log reconstructs.

## Invitation-flow decisions

12. [x] `2026-05-13-rbac-invitation-snapshot-not-resolved-at-accept.md` — Snapshot is authoritative.
13. [x] `2026-05-13-rbac-4-digit-code-mistyped-email-mitigation.md` — Verbal confirmation code.
14. [x] `2026-05-13-rbac-failed-attempts-counter-five-strike.md` — 5-strike auto-cancel.

## Operational decisions

15. [x] `2026-05-13-rbac-client-cache-staleness-bounded.md` — 60s TTL + revalidate-on-focus.
16. [x] `2026-05-13-rbac-archive-product-trigger-gate.md` — Archive permission via trigger.
17. [x] `2026-05-13-rbac-update-shop-via-rpc-only.md` — F-NEW-02 closure.
18. [x] `2026-05-13-rbac-definer-safe-views.md` — Intentional `security_definer_view` advisor warnings.

## Stabilization & deferred

19. [x] `2026-05-13-rbac-deployment-phasing.md` — Compressed Day 0 + synthetic test + same-session Day 7 cutover.
20. [x] `2026-05-13-rbac-leaky-purchase-cost-acknowledgment.md` — Manager can derive profit from purchase data.

## Deferred to v2.10+ (NOT filed as v2.9 ADRs)

- `void_sale` RPC + permission
- `edit_sale_notes` (financial_records_immutable blocks; needs allowlist trigger)
- `apply_discount_above_limit` / manager-override-at-POS
- Real-time permission updates via Supabase Realtime
- Remote JWT invalidation for revoked users
- Ownership transfer (`transfer_ownership` RPC)

---

**Progress: 20 of 20 ADRs filed + 3 bonus ADRs**
(`2026-05-13-rbac-audit-query-refinements.md`,
`2026-05-13-rbac-record-sale-permission-enhancements.md`,
`2026-05-13-v29-cleanup-permissive-policies.md`). All locked
decisions documented. Phase A-G complete + v2.9 cleanup (migration
0081 + AQ-23) shipped 2026-05-13. Phase D-I client-side work
follows in v2.9.1 / v2.9.2 as Phase H (Documentation) + Phase I
(Pilot) per `tasks.md`.
