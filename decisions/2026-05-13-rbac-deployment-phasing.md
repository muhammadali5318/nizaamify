# 2026-05-13 — v2.9 deployment phasing (compressed from 7-day calendar to synthetic-test pass)

## Context

Phase D §D.3 originally locked a 7-day calendar stabilization window
between Day 0 (migrations 0068–0076) and Day 7 cutover (migrations
0077–0079). The calendar window was intended to let real-world
non-owner activity surface defects before the legacy RLS policies were
dropped.

During the actual deploy, the owner (the SaaS operator) opted to
**compress the calendar window to a synthetic test pass** — a single
SQL transaction that creates real non-owner accounts via the invitation
flow, runs ~14 boundary tests, then rolls back. Same coverage, no
calendar delay, no production exposure.

## Decision

The compressed sequence (executed 2026-05-13):

1. **Day 0**: migrations 0068–0076 (foundation, RLS, views, RPCs).
2. **Mid-day**: AQ-13 / AQ-14 refinement per
   [[2026-05-13-rbac-audit-query-refinements]] resolved 2 false-positive
   findings. ADRs #1–#6 + #7, #11, #17, #18 filed.
3. **0076b**: conditional projection on search/list RPCs +
   record_sale enhancements + receive_payment cap (
   [[2026-05-13-rbac-search-rpcs-conditional-projection]],
   [[2026-05-13-rbac-record-sale-permission-enhancements]],
   [[2026-05-13-rbac-receive-payment-cap-applies-to-all-non-owners]]).
4. **Synthetic test pass**: 12 boundary tests + 4 setup checkpoints +
   1 dependency-validation check inside a `BEGIN..ROLLBACK` transaction
   with transient `current_shop_id()` alias. **All 12 ST-* tests
   returned PASS.**
5. **0077–0079** same session: drop legacy policies, schedule cleanup
   cron, permanently alias `current_shop_id()`.

## Alternatives considered

1. **7-day calendar window as originally specified.** Considered;
   value vs. cost was unfavorable for SMB scale (production has 2
   owners, no real non-owner users yet). The synthetic test gives
   identical coverage without the wait.
2. **Skip stabilization entirely.** Rejected by the owner. Synthetic
   test is the floor.
3. **Pilot with 1 real non-owner first.** Rejected — would still
   require manual cleanup of the test user post-pilot; synthetic
   transaction-rollback is cleaner.

## Consequences

- Total v2.9 deploy: ~3 hours of focused work (migrations + ADRs +
  test pass + cutover), not 7 days.
- Synthetic test approach is reusable for v2.10+ RBAC iterations.
- The `current_shop_id()` permanent alias landed in 0078 (the
  follow-up migration after old policies dropped in 0077).
- Production state: all 22 AQs green, all 80 advisor lints accounted
  for (45 + 17 + 5 - 2 = 65 DEFINER fns granted authenticated + 14
  intentional security_definer_view + 1 HIBP).

Related: [[2026-05-13-rbac-audit-query-refinements]] (compressed
stabilization required AQ refinement before non-owner test could
run cleanly).
