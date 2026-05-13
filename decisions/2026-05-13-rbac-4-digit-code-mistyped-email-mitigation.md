# 2026-05-13 — 4-digit verbal confirmation code for invitation acceptance

## Context

Owners create invitations by typing an employee's email. SMB Pakistani
context: emails are hand-typed on phone keyboards, typos are common,
and a misaddressed email could be opened by a stranger who clicks the
magic link.

Without an additional verification factor, the stranger could set a
password (Supabase magic-link flow) and accept the invitation,
gaining access to the shop.

## Decision

Each `pending_invitations` row stores a `confirmation_code text` —
a 4-digit string (regex `^[0-9]{4}$`) generated at create time via
`lpad((floor(random()*10000)::int)::text, 4, '0')`.

The owner sees the code in the UI immediately after `create_invitation`
returns. The owner shares the code with the intended employee
**out-of-band** (phone call, WhatsApp message, or in-person — NOT in
the email). The employee enters the code on the accept page along
with their password.

`accept_invitation(p_invitation_id, p_confirmation_code)` raises
`invalid_confirmation_code` on mismatch.

Combined with:
- **24h expiration** (Phase B §B.6 D22 lock).
- **5-strike auto-cancel** ([[2026-05-13-rbac-failed-attempts-counter-five-strike]]).

The brute-force surface is 10,000 possible codes within a 24h window,
auto-cancelled at 5 wrong attempts. Worst-case attacker probability:
`5/10000 = 0.05%`.

## Alternatives considered

1. **SMS to a pre-declared phone.** Adds a paid SMS provider
   dependency (Twilio or local PK SMS gateway). Cost per invitation.
   Rejected for v2.9 SMB context.
2. **6-digit code.** Larger keyspace, more brute-force resistance, but
   harder for owners to read accurately over a noisy phone call.
   4-digit balances brute-force resistance with usability.
3. **No verification code; trust the magic link.** Rejected — magic
   links delivered to a typo'd email are the threat we're defending
   against.

## Consequences

- Owner UI must surface the code prominently and explain "share this
  verbally."
- Accept page has a 4-digit input field.
- Invitation email itself does NOT contain the code (it's only in the
  owner's UI).
- Phase E UI work includes the share-code modal pattern.

Related: [[2026-05-13-rbac-failed-attempts-counter-five-strike]],
[[2026-05-13-rbac-invitation-snapshot-not-resolved-at-accept]].
