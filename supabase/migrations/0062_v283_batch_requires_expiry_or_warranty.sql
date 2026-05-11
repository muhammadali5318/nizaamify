-- v2.8.3 — batched products must have at least one of:
--   * expiry_date set, OR
--   * supplier_warranty_days > 0
--
-- Without one or the other there's nothing for batch tracking to alert
-- on — the user might as well not enable has_batches.
--
-- NOT VALID so the constraint applies to new INSERTs/UPDATEs but
-- doesn't retroactively reject existing rows created under the looser
-- rule. The frontend gives a friendlier error before this fires; this
-- is the defense-in-depth backstop.

alter table public.inventory_batches
  drop constraint if exists batch_must_have_expiry_or_warranty;

alter table public.inventory_batches
  add constraint batch_must_have_expiry_or_warranty
  check (
    expiry_date is not null
    or (supplier_warranty_days is not null and supplier_warranty_days > 0)
  )
  not valid;
