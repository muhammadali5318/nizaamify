# 2026-05-13 — Discount limits stored per-user on `user_shop_access.discount_limits`

## Context

Phase B §B.2.4 locks: per-role default discount limits set at the
shop level, with per-user overrides. Rev 2 simplification: the
discount limits are stored only per-user (in `user_shop_access.discount_limits`
JSONB), seeded from preset defaults at invitation time. No
shop-level `default_discount_limits` jsonb column.

## Decision

`user_shop_access.discount_limits jsonb not null default '{}'::jsonb`.
Shape:
```json
{
  "per_line_max_pct": <number>,    // optional; missing = no limit
  "per_invoice_max_pct": <number>, // optional
  "per_line_max_pkr": <number>,    // optional
  "per_invoice_max_pkr": <number>  // optional
}
```

Owner: typically `{}` (no limits; owner implicit-shortcut bypasses
all enforcement anyway).
Manager preset default at invitation: `{"per_line_max_pct":25,"per_invoice_max_pct":15}`.
Salesperson preset default at invitation: `{"per_line_max_pct":5,"per_invoice_max_pct":3,"per_line_max_pkr":100,"per_invoice_max_pkr":300}`.

Defaults live in `create_invitation` RPC body (Phase B §B.6 + 0075
migration); owner can override per-user at create time or via
`update_user_discount_limits` RPC after acceptance.

Enforcement in `record_sale` wrapper (0076b): reads
`user_shop_access.discount_limits`, applies each cap to per-line +
per-invoice + implicit-discount math.

## Alternatives considered

1. **Shop-level + per-user fallback.** Rejected — adds a level of
   indirection without operational benefit. The owner's
   `create_invitation` UI surfaces the per-user starting values; bulk
   edits across users are rare.
2. **Permissions instead of numerics.** Rejected — the user's
   instruction locked: "booleans are permissions; numerics are
   limits."

## Consequences

- One JSONB column on `user_shop_access`.
- `update_user_discount_limits` RPC sets the value (audit row written).
- Audit query AQ-09 cross-references invoices' actual discount
  amounts against caller's limits at invoice time (approximation
  using current-state limits; for forensic accuracy, query
  `user_shop_permission_audit` for time-travel reconstruction).

Related: [[2026-05-13-rbac-record-sale-permission-enhancements]],
[[2026-05-13-rbac-receive-payment-cap-applies-to-all-non-owners]].
