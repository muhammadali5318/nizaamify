# Architectural Decision Records (ADRs)

One file per decision. Numeric prefix preserves ordering. Each ADR has four sections:

- **Context** — why this came up
- **Decision** — what was chosen
- **Alternatives considered** — what was rejected and why
- **Consequences** — what this locks in

Granularity: one ADR per *reversal of a PRD assumption* or *cross-cutting architectural choice*. Skip small CSS / naming decisions.

## Index

- [0001 — Stack overrides vs PRD](./0001-stack-overrides.md)
- [0002 — React Router v7 declarative mode](./0002-router-v7-declarative.md)
- [0003 — MUI RTL pipeline](./0003-mui-rtl-pipeline.md)
- [0004 — Supabase Auth replaces Auth0](./0004-supabase-auth-replaces-auth0.md)
- [0005 — RLS enabled in same migration as table](./0005-rls-enabled-with-table.md)
- [0006 — Subscription enforcement in client only](./0006-subscription-enforcement-client-only.md)
- [0007 — record_sale and record_purchase as SQL functions](./0007-sale-purchase-sql-functions.md)
- [0008 — No Zustand for now](./0008-no-zustand-for-now.md)
- [0009 — Decision log structure (this folder)](./0009-decision-log-format.md)
- [0010 — Admin runbook for manual subscription activation](./0010-admin-runbook.md)
- [0011 — Intentional SECURITY DEFINER RPCs](./0011-intentional-security-definer-rpcs.md)
- [0012 — M8 RTL audit status](./0012-m8-rtl-audit-status.md)
- [0013 — v1.7 RTL audit residuals](./0013-v17-rtl-residuals.md)
- [0014 — v1.7 design system acceptance](./0014-v17-design-system-acceptance.md)
- [0015 — v1.8 database hardening](./0015-v18-database-hardening.md)
- [0016 — v1.9 stock-in: suppliers, landed cost, snapshot avg-before/after](./0016-v19-suppliers-landed-cost.md)
- [0019 — v2.5 product_categories entity replaces products.type](./0019-v25-product-categories-entity.md)
- [0020 — v2.5 product detail routing pattern (full route + POS drawer)](./0020-v25-product-detail-routing-pattern.md)
- [0021 — v2.5 eye icon as primary row action; Actions column dropped](./0021-v25-eye-icon-and-actions-column-drop.md)
- [0022 — v2.6 product-template / variant architecture](./0022-v26-product-template-variant-architecture.md)
- [0023 — v2.6 synthetic default variant for single-variant products](./0023-v26-default-variant-pattern.md)
- [0024 — v2.6 deprecate (don't drop) legacy product_id and products.* columns](./0024-v26-deprecate-without-drop-product-id-columns.md)
- [0025 — v2.6 `record_sale` / `record_purchase` accept variant_id OR product_id](./0025-v26-variant-id-or-product-id-rpc-contract.md)
