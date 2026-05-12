# Receipt disclaimer for expired-stock sales is opt-in per shop

**Date:** 2026-05-13 (v2.8.4)
**Status:** Accepted

## Context

When a sale draws from expired stock, the receipt may need a disclaimer
("Some items in this sale were past their expiry date. No returns or
refunds on expired items."). Shop owners have different preferences:

- Pharmacies / regulated retail: want it always on for legal cover.
- General retail: find it embarrassing to print on a receipt — implies
  routine expired sales, which they want to discourage.

Three implementations:

1. **Always render the disclaimer** when any line is `sold_expired = true`.
2. **Never render the disclaimer** — shop owner prints custom paper if
   they need to.
3. **Opt-in per shop**, default off.

## Decision

**Opt-in per shop, default off.** New column
`shops.expired_sale_receipt_disclaimer boolean NOT NULL DEFAULT false`.
The receipt footer renders the disclaimer only when both conditions
are true:

```
shop.expired_sale_receipt_disclaimer = true
AND any sale_items.sold_expired = true for the invoice
```

This respects both ends of the spectrum: pharmacies turn it on once
and stop worrying; clearance-bin retail leaves it off; receipts that
don't have expired-stock lines never show the footer regardless of
the toggle.

## Alternatives considered

1. **Always on.** Surprises the "embarrassed" shops; once printed, it
   can't be un-printed.
2. **Always off.** Punts the legal-cover need entirely; pharmacies
   would need a paper sticker or a custom receipt template.
3. **Per-product opt-in** (e.g. each product carries its own "include
   disclaimer" flag). Granular but pointlessly so — once a shop wants
   the disclaimer for legal cover, they want it on every receipt that
   could trigger returns.

## Consequences

- The disclaimer text is in `sales:detail.receipt_disclaimer_default`
  (en + ur), editable per locale. A shop owner who wants different
  wording does so by translating the i18n key — out of scope for
  v2.8.4 to ship per-shop custom text, but the structure leaves room.
- The Receipt component takes a `showExpiredDisclaimer: boolean` prop;
  POSPage computes it from `shop.expired_sale_receipt_disclaimer` AND
  a count query on `sale_items where invoice_id = X AND sold_expired
  = true`. Single round-trip, no JS recomputation of `sold_expired`.
- A v2.10+ extension could add "always show" / "never show" /
  "per-product" as a three-way enum if the binary proves too coarse.
  Not on the v2.8.4 critical path.
