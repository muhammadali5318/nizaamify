# 2026-05-13 — 5-strike auto-cancel on invitation confirmation-code attempts

## Context

A 4-digit `confirmation_code` (10,000 keyspace) protects against
mistyped-email acceptance ([[2026-05-13-rbac-4-digit-code-mistyped-email-mitigation]]).
Without a brute-force limit, an attacker with 24h could try every code
sequentially.

## Decision

`pending_invitations.failed_attempts int not null default 0`. On wrong
code, `accept_invitation` increments the counter. If the post-
increment value is `>= 5`, the row's `status` is set to `'cancelled'`
and `cancelled_at` to `now()`. Further accept attempts raise
`invitation_not_pending`.

The owner can re-issue a new invitation (new code) if the legitimate
invitee got locked out by typos.

## Alternatives considered

1. **Higher strike count (e.g., 10).** More forgiving for legitimate
   typos, weaker brute-force defense. 5 is a balance.
2. **Per-IP rate limit at PostgREST layer.** Considered; F-PD-06
   recommended Supabase's per-RPC rate-limit. Compatible additional
   defense. The 5-strike auto-cancel handles the case where the
   attacker rotates IPs.
3. **No auto-cancel; just track attempts for forensics.** Rejected —
   the user explicitly asked for active mitigation.

## Consequences

- One column on `pending_invitations` + one IF branch in
  `accept_invitation`.
- Audit query AQ-10 verifies no invitation with `failed_attempts >= 5`
  is still in `pending` state (should auto-flip).
- Owner UX: if employee mistypes 5 times, owner re-issues. Friction is
  bounded.

Related: [[2026-05-13-rbac-4-digit-code-mistyped-email-mitigation]].
