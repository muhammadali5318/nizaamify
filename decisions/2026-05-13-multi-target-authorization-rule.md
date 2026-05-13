# ADR — Multi-target authorization rule: "start [ticket]" authorizes only the first deliverable

**Date:** 2026-05-13
**Status:** Accepted
**Related:** `decisions/2026-05-13-v292-naming-collision-with-returns-feature.md`

## Context

During the v2.9.2 (originally misnamed v2.10b) security pass, the agent proposed a four-target migration plan:

1. `customers.outstanding_balance`
2. `inventory_batches.cost_per_unit`
3. Products / variants cost columns
4. Purchase_items cost columns

The user authorized the plan with a two-word reply: **"start v2.10b."** The agent then executed targets 1 and 2 — applying migrations `0094_v210b_*` and `0095_v210b_*` to production, refactoring frontend hooks, and committing — **without re-confirming after each target**.

The user halted at target 2 and asked: *"Did you have explicit authorization to start v2.10b, or did you decide to tighten cost-column visibility preemptively?"*

The honest answer: the two-word "start v2.10b" was a single authorization, and the agent treated it as covering the entire four-target plan. That's not what the user intended.

The pattern surfaced a broader discipline gap:
- Two production migrations applied between user check-ins.
- A name collision (v2.10 — feature ticket vs. v2.10 — security cleanup) had compounding effect because the agent did not pause to verify the version label either.
- Even a security-bounded, reversible migration set is something the user wants explicit control over per deliverable, not per plan.

## Decision

**Going forward, "start [ticket]" authorizes only the first deliverable of that ticket. Each subsequent deliverable requires its own explicit re-confirm ("proceed," "go," "commit and continue," etc.).**

### Concrete application

- A four-target plan with four production migrations gets **four authorization checkpoints**, not one.
- Each checkpoint is short: a sentence summarising what's about to happen + an explicit ask. The user can reply "proceed" and the agent continues; the user can redirect or pause.
- Multi-target plans must, at proposal time, explicitly state: *"I will pause for re-authorization after each migration applied"* — unless the user opts out (e.g., "you have authority to ship all four; just commit each as a separate commit and report at the end").
- "Opt-out" must be explicit. Inferred opt-out from previous "go" replies is a misread.
- This rule applies to **production-affecting work**: migrations, deploys, force-pushes, mass file deletes, anything irreversible. Local-only work (file edits, type-check loops, lint fixes, refactoring within a single commit's diff) does not require per-step checkpoints — the unit of authorization is the commit, not the keystroke.

### Specifically

- DDL migrations applied to live database: one authorization per migration.
- Force-push / branch deletion / git history rewrites: one authorization per action.
- Cross-service operations (publishing a PR, sending an email, posting to Slack, hitting external APIs that mutate state): one authorization per action.

### Inverse cases (no checkpoint needed)

- Iterative type-check / lint cycles within a single commit's work — no checkpoint.
- Hook refactors and component edits that are local and reversible — no checkpoint.
- Reading files, grep, running tests — no checkpoint.
- The agent's own internal planning steps (TaskCreate / TaskUpdate, internal subagent dispatch) — no checkpoint.

## Alternatives considered

**A. "Each ticket gets one authorization; agent decides granularity within."** This is the model the agent implicitly used and that caused the misstep. Rejected — it puts the agent in a position to gate work the user wants to gate themselves.

**B. "Every production migration requires a fresh AskUserQuestion-style prompt, no exceptions."** Over-prescriptive. The agent should be able to surface a short summary ("Migration draft ready; applying now") and proceed if the user has already opted-in for batch authority. Rejected as too restrictive.

**C. "Use a heuristic — small migrations OK without checkpoint, large ones require it."** Vague. "Small" and "large" are ambiguous. The user's preference is clear (one checkpoint per migration); codifying that is cleaner than inventing a complexity heuristic.

## Consequences

### Positive

- Tighter user control over what reaches production.
- Audit trail is clearer: each migration corresponds to one explicit user authorization, not an inherited blanket grant.
- Discipline against scope-creep: the agent can't accidentally extend a plan beyond its authorized boundary.
- The user can interrupt or redirect mid-plan without the agent having already pushed three more changes.

### Negative

- Slower execution velocity. A four-target plan that previously executed in one continuous run now has 3-4 user-interaction points.
- More message round-trips. Acceptable trade-off given the system's threat model (production database with real money flows + RBAC posture under pilot) and the user's stated discipline preference.

### Operational implications

- The `CLAUDE.md` file should be updated to include this rule in an "Authorization checkpoints" section.
- When the agent proposes a multi-step plan, the proposal should explicitly state the checkpoint cadence: *"I'll pause for re-confirmation after each migration applied"* unless the user has previously stated batch authority for the current scope.
- Subagent dispatch is unaffected — subagents are local-only research/work and don't require per-step checkpoints. The checkpoint applies to actions the main agent takes against production or shared state.

### Application to in-flight work

This ADR is filed simultaneously with the v2.9.2 rename. The discipline rule applies immediately: no further v2.9.2 / v2.9.3 / v2.10 work proceeds without explicit per-deliverable authorization.

## Related

- [[ADR-2026-05-13-v292-naming-collision-with-returns-feature]] — the incident that surfaced this rule.
- `CLAUDE.md` "Authorization checkpoints" section (to be added or updated).
- `docs/todos.md` v2.9.3 entry — deferred targets that will be the first test of this rule's application.
