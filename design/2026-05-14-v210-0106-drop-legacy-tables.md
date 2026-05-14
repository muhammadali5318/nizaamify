# Migration 0106 — Drop Legacy Tables (Design Package)

**Status:** Draft for review (2026-05-14). **Not authorized.** The apply
is a **separate** authorization, after this package is reviewed *and*
the execute-then-`ROLLBACK` dry-run is run with §8 output shown (§4).
**Parent docs:** `2026-05-14-v210-contacts-implementation-plan.md`
§1.0/§1.1/§1.2/§1.3, `2026-05-14-v210-0105-row-migration.md` §6 (the
0106 agenda items 0105 deferred).
**Discovery basis:** four queries run against staging
`iamqibcdpeovwavgzswq` 2026-05-14 — reproduced inline in §1 with their
results. Every "nothing references X" claim below is a **checked fact
with its query shown**, not an assertion.

---

## §0 — What 0106 does, and what becomes irreversible

0106 is the **last v2.10 Phase C migration**. It executes the Phase B
lock (`customers` + `suppliers` → unified `contacts`) by removing the
now-empty legacy husk. Three statements + a verification block:

```
DROP TABLE public.customers CASCADE;
DROP TABLE public.suppliers CASCADE;
DROP FUNCTION public.check_customer_tier_change_gate();
```

### Irreversibility — the point of no return

- **There is no down-migration.** Implementation-plan §1.2: *"0106
  (table drop) has no down-migration. Once tables are dropped, data is
  gone. This is intentional: v2.10 is forward-only on the contacts
  unification."* The only rollback path once `COMMIT` lands is a **full
  PITR / snapshot restore** of the staging database — not a migration.
- **What is gone the instant `COMMIT` lands** (full enumeration in §1):
  the `customers` and `suppliers` tables and **all rows in them**, their
  2 TOAST tables, their 2 composite rowtypes, their 7 indexes, their 9
  column defaults, their 13 constraints, their 3 triggers, their 5 RLS
  policies — plus, by explicit statement, the orphaned trigger function
  `check_customer_tier_change_gate()`.
- **On staging:** `customers` / `suppliers` are already frozen-dead
  post-0104 (legacy id columns dropped at 0104; AQ-33 proves no function
  writes them; no live read path). They still hold whatever seed rows
  pre-dated the v2.10 chain. Dropping the tables loses that seed data.
  That is acceptable on staging — but it **is** data loss and **is**
  irreversible without a restore. Stated plainly so the
  owner-reconfirmation decision is made with eyes open.
- **§1.1 owner-reconfirmation gate.** The implementation plan halts
  after 0105 for explicit owner re-confirmation before 0106 runs. This
  package is that surface. **Design authorization ≠ apply
  authorization** — the apply is re-authorized separately after the
  dry-run (§4).
- **Production note.** This package is for the **staging** apply only.
  Production `customers`/`suppliers` are dropped only at the combined
  v2.10+v2.11 production-deploy moment, which is its own authorization
  with its own Finding-1 data-wipe confirmation (implementation-plan
  §4.4) — out of scope here.

---

## §1 — Dependency closure: every claim, with its query

The danger of `DROP TABLE … CASCADE` is **not** that it fails — CASCADE
never fails. The danger is CASCADE silently dropping something we wanted
to keep, or leaving something that references the dropped table broken.
So this section enumerates the **complete dependency closure** of both
tables and classifies every dependent, then re-proves each negative
("nothing else references them") claim with its own query.

### 1.1 — The complete `pg_depend` closure (authoritative: what CASCADE removes)

**Query** (Discovery 1/4):

```sql
select cl.relname as legacy_table, d.refobjsubid as ref_col, d.deptype,
  d.classid::regclass as dep_catalog,
  case d.classid
    when 'pg_class'::regclass      then (select c2.relkind::text||' '||c2.relname from pg_class c2 where c2.oid=d.objid)
    when 'pg_constraint'::regclass then 'constraint '||(select conname from pg_constraint where oid=d.objid)
                                        ||' on '||(select conrelid::regclass::text from pg_constraint where oid=d.objid)
    when 'pg_trigger'::regclass    then 'trigger '||(select tgname from pg_trigger where oid=d.objid)
                                        ||' on '||(select tgrelid::regclass::text from pg_trigger where oid=d.objid)
    when 'pg_rewrite'::regclass    then 'rule/view -> '||(select ev_class::regclass::text from pg_rewrite where oid=d.objid)
    when 'pg_policy'::regclass     then 'policy '||(select polname from pg_policy where oid=d.objid)
                                        ||' on '||(select polrelid::regclass::text from pg_policy where oid=d.objid)
    when 'pg_attrdef'::regclass    then 'default on '||(select adrelid::regclass::text from pg_attrdef where oid=d.objid)
    when 'pg_proc'::regclass       then 'function '||(select proname from pg_proc where oid=d.objid)
    when 'pg_type'::regclass       then 'type '||(select typname from pg_type where oid=d.objid)
    else d.classid::regclass::text||' oid='||d.objid::text
  end as dependent_object
from pg_depend d join pg_class cl on cl.oid = d.refobjid
where d.refobjid in ('public.customers'::regclass, 'public.suppliers'::regclass)
order by cl.relname, d.classid::text, dependent_object;
```

**Result** — every dependent, classified. **Every row's referenced
object is the legacy table itself**, and every dependent is something
that lives *on* or *is part of* that table:

| Catalog | `customers` dependents | `suppliers` dependents | CASCADE action |
|---|---|---|---|
| `pg_type` | `customers` rowtype *(internal)* | `suppliers` rowtype *(internal)* | dropped with table |
| `pg_class` (TOAST) | `pg_toast_17567` *(internal)* | `pg_toast_17989` *(internal)* | dropped with table |
| `pg_class` (index) | `customers_shop_idx`, `idx_customers_name_trgm`, `idx_customers_phone_trgm`, `idx_customers_shop_outstanding`, `idx_customers_tier` (5) | `idx_suppliers_name_trgm`, `uq_suppliers_shop_name_contact` (2) | dropped with table |
| `pg_attrdef` | 5 column defaults | 4 column defaults | dropped with table |
| `pg_constraint` | 8 (see §1.3) | 5 (see §1.3) | dropped with table |
| `pg_trigger` | `customers_touch`, `v29_customers_tier_change_gate` | `suppliers_touch` | dropped with table (§1.5) |
| `pg_policy` | `v29_customers_read`, `v29_customers_update` | `v29_suppliers_read`, `v29_suppliers_update`, `v29_suppliers_write` | dropped with table (§1.8) |
| `pg_rewrite` | **— none —** | **— none —** | **no view depends on either table** |
| `pg_proc` | **— none —** | **— none —** | **no function hard-depends on either table** |

**The two critical absences** — `pg_rewrite` and `pg_proc` do not appear
in the closure at all:
- **No `pg_rewrite`** ⇒ no view (or rule) is built on `customers` /
  `suppliers`. CASCADE drops **zero views**. Cross-checked by text scan
  in §1.4.
- **No `pg_proc`** ⇒ no function has a hard catalog dependency on the
  tables. (Function *bodies* that merely *reference* a table are not
  `pg_depend` edges — those are checked separately in §1.6, because such
  a function would *survive* CASCADE and break at call time, which is the
  more dangerous case.)

Everything CASCADE removes is in the table above and is **expected** —
it is the legacy tables' own machinery.

### 1.2 — Inbound FKs — re-proven, NOT inherited from 0104

0104's package claimed it dropped the `customer_id` / `supplier_id`
columns + their FKs. Per the review standard, that is re-proven here at
0106, not inherited.

**Query** (Discovery 2/4):

```sql
select conrelid::regclass as referencing_table, conname, pg_get_constraintdef(oid)
from pg_constraint
where contype='f' and confrelid in ('public.customers'::regclass,'public.suppliers'::regclass);
```

**Result: `[]`** — zero constraints anywhere have `confrelid` =
`customers` or `suppliers`. No table references either legacy table by
FK. (If any inbound FK still existed, CASCADE would drop *that
constraint* — silently weakening another table — so this returning empty
is load-bearing, not cosmetic.)

### 1.3 — All constraints ON the legacy tables (every `contype` — the CHECK-miss lesson)

The 0105 CHECK-constraint miss came from a discovery query that filtered
`contype IN ('f','u','p')`. This query filters **nothing**:

**Query** (Discovery 2/4):

```sql
select conrelid::regclass as on_table, contype, conname
from pg_constraint
where conrelid in ('public.customers'::regclass,'public.suppliers'::regclass);
```

**Result: 13 constraints, every one `conrelid` = a legacy table:**

| Table | `f` (FK, outbound) | `c` (CHECK) | `p` (PK) | `u` (UNIQUE) |
|---|---|---|---|---|
| `customers` | `customers_created_by_user_id_fkey`, `customers_shop_id_fkey`, `customers_tier_id_fkey`, `customers_updated_by_user_id_fkey` | `customers_outstanding_non_negative`, `customers_phone_not_blank` | `customers_pkey` | `customers_shop_id_phone_key` |
| `suppliers` | `suppliers_created_by_user_id_fkey`, `suppliers_shop_id_fkey`, `suppliers_updated_by_user_id_fkey` | `suppliers_name_not_blank` | `suppliers_pkey` | — |

All 7 `f` constraints are **outbound** (`customers`/`suppliers` →
`shops` / `profiles` / `customer_tiers`) — they are dropped *with* the
legacy table and take nothing else with them. The `c` / `p` / `u`
constraints are intrinsic to the tables. None is an inbound FK (§1.2
confirms). Nothing here survives to dangle.

### 1.4 — Views

`pg_depend` (§1.1) shows **no `pg_rewrite`** dependent — authoritative
that CASCADE drops no view. Cross-checked with a definition text scan:

**Query** (Discovery 2/4):

```sql
select c.relname, c.relkind::text
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('v','m')
  and pg_get_viewdef(c.oid) ~* '\m(customers|suppliers)\M';
```

**Result: `[]`** — no view or matview definition references either
table. (`customers_view` was dropped at 0104; `contacts_view` and the
rest read `contacts`, never the legacy tables.)

### 1.5 — Triggers, and orphaned-after-CASCADE trigger functions

Three triggers live on the legacy tables (§1.1) — CASCADE drops all
three *with* the tables. The question that matters: do their **trigger
functions** survive, and should they?

**Query** (Discovery 3/4):

```sql
select p.proname as fn,
  count(*) filter (where t.tgrelid in ('public.customers'::regclass,'public.suppliers'::regclass)) as on_legacy,
  count(*) filter (where t.tgrelid not in ('public.customers'::regclass,'public.suppliers'::regclass)) as elsewhere
from pg_trigger t join pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal
  and p.oid in (select tgfoid from pg_trigger
                where tgrelid in ('public.customers'::regclass,'public.suppliers'::regclass) and not tgisinternal)
group by p.proname;
```

**Result:**

| Trigger function | on legacy tables | elsewhere | After CASCADE |
|---|---|---|---|
| `touch_updated_at` | 2 (`customers_touch`, `suppliers_touch`) | **9** | **survives — correct.** Shared utility; CASCADE drops the 2 legacy triggers, the function keeps its 9 other triggers. |
| `check_customer_tier_change_gate` | 1 (`v29_customers_tier_change_gate`) | **0** | **orphaned.** CASCADE drops its only trigger; the function itself is *not* table-owned, so CASCADE leaves it behind as a dead, never-invoked orphan. → **0106 drops it explicitly** (§2). |

Confirmed independently (Discovery 2/4): the only trigger referencing
`check_customer_tier_change_gate()` is `v29_customers_tier_change_gate`
on `customers`. This is the exact 0106 agenda item flagged in
`2026-05-14-v210-0105-row-migration.md` §6 — handled here.

### 1.6 — Functions referencing the legacy tables (read OR write)

AQ-33 scans only for **writes** (`INSERT/UPDATE/DELETE … customers|suppliers`).
A function that merely **reads** the tables would *survive* CASCADE
(function bodies aren't `pg_depend` edges — §1.1) and break at call time
— the more dangerous case. So the scan here is read-**and**-write:

**Query** (Discovery 3/4):

```sql
with public_fns as materialized (
  select p.oid, p.proname, p.prokind::text as kind
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind in ('f','p'))
select proname, kind,
  pg_get_functiondef(oid) ~* '(\mfrom\s+|\mjoin\s+|\minto\s+|\mupdate\s+|\mdelete\s+from\s+)(public\.)?(customers|suppliers)\M'
    as references_as_table
from public_fns
where pg_get_functiondef(oid) ~* '\mcustomers\M' or pg_get_functiondef(oid) ~* '\msuppliers\M';
```

**Result: one hit — `deactivate_tier_v28`, `references_as_table = false`.**
Investigated directly (Discovery 4/4, full body pulled). The *only*
occurrence of the word `customers` in its body is a **comment**:

```
  -- v2.10 corrective (mig 0104b): re-point onto contacts.customer_tier_id,
  -- not the customers table (frozen post-0104, dropped at 0106). ...
```

Its actual SQL touches `public.contacts` and `public.customer_tiers`
only (0104b's rewrite). It does **not** reference `customers` or
`suppliers` as a table in any clause. After 0106 it is unaffected.
(`customer_tiers` survives — §1.7. Note: it still uses the legacy
`current_shop_id()`, which is AQ-24-allowlisted for `_v28` shims and not
0106's concern.)

AQ-33 itself (write-only scan) returns **0** — re-confirmed in the
post-0105 verification — so no function writes the legacy tables either.

### 1.7 — Defaults / generated columns on other tables

`pg_depend` (§1.1) shows `pg_attrdef` dependents only *on* the legacy
tables (their own 9 column defaults). Re-proven that no **other** table
has a default or generated-column expression referencing them:

**Query** (Discovery 2/4):

```sql
select ad.adrelid::regclass, pg_get_expr(ad.adbin, ad.adrelid)
from pg_attrdef ad
where ad.adrelid not in ('public.customers'::regclass,'public.suppliers'::regclass)
  and pg_get_expr(ad.adbin, ad.adrelid) ~* '\m(customers|suppliers)\M';
```

**Result: `[]`.** (`pg_attrdef` holds both `DEFAULT` and `GENERATED`
expressions, so this covers generated columns too.) And `customer_tiers`
— which the surviving tier wrappers + `deactivate_tier_v28` read/write —
does **not** depend on `customers`: the FK direction is
`customers.tier_id → customer_tiers.id` (customers references tiers, not
the reverse), so `customer_tiers` is untouched by the CASCADE.

### 1.8 — RLS policies

The 5 v2.9 RLS policies on the legacy tables (`v29_customers_read`,
`v29_customers_update`, `v29_suppliers_read`, `v29_suppliers_update`,
`v29_suppliers_write` — §1.1) are **dropped with their tables by
CASCADE**. This is the second 0106 agenda item from
`2026-05-14-v210-0105-row-migration.md` §6 (the known inert danglers —
they reference 0105-retired permission keys but were left in place
precisely because 0106 removes them wholesale). No explicit statement
needed: a policy cannot outlive its table.

### 1.9 — Classification summary

| Dependent class | Count | Disposition |
|---|---|---|
| Legacy tables + TOAST + rowtypes | 2 + 2 + 2 | `DROP TABLE … CASCADE` |
| Indexes on legacy tables | 7 | CASCADE (with table) |
| Column defaults on legacy tables | 9 | CASCADE (with table) |
| Constraints on legacy tables (all `contype`) | 13 | CASCADE (with table) |
| Triggers on legacy tables | 3 | CASCADE (with table) |
| RLS policies on legacy tables | 5 | CASCADE (with table) |
| `check_customer_tier_change_gate()` | 1 | **explicit `DROP FUNCTION`** — orphaned, not table-owned |
| `touch_updated_at()` | 1 | **survives** — shared (9 other triggers) |
| `deactivate_tier_v28` | 1 | **survives** — comment-only mention; touches `contacts`/`customer_tiers` |
| Views referencing legacy tables | **0** | n/a |
| Inbound FKs | **0** | n/a |
| Other-table defaults/generated refs | **0** | n/a |
| Functions referencing legacy tables as a table | **0** | n/a |

CASCADE's blast radius is **fully enumerated and fully expected.** The
only thing CASCADE does *not* clean that 0106 must — `check_customer_tier_change_gate()` — is handled by an explicit statement.

---

## §2 — The migration

```sql
BEGIN;

-- §1 — drop the legacy tables. CASCADE removes ONLY their own machinery:
-- TOAST + rowtype, 7 indexes, 9 defaults, 13 constraints, 3 triggers,
-- 5 RLS policies — the full, enumerated closure from design §1. No view,
-- no inbound FK, no other-table column, no function depends on either
-- table (design §1.1/§1.2/§1.4/§1.6), so CASCADE takes nothing else.
DROP TABLE public.customers CASCADE;
DROP TABLE public.suppliers CASCADE;

-- §2 — drop the orphaned trigger function. check_customer_tier_change_gate()
-- is the trigger fn behind v29_customers_tier_change_gate (just dropped
-- with public.customers). It is a function, not table-owned, so CASCADE
-- does NOT remove it; it is used by no other trigger (design §1.5). Left
-- behind it is a dead, never-invoked orphan — 0106 removes it explicitly.
DROP FUNCTION public.check_customer_tier_change_gate();

-- §3 — verification (see §3 of this package). RAISE EXCEPTION on any
-- mismatch -> whole txn rolls back.
DO $verify_0106$ ... $verify_0106$;

COMMIT;
```

**Ordering:** the `DROP TABLE`s must precede the `DROP FUNCTION` — while
`v29_customers_tier_change_gate` still exists (i.e. before
`DROP TABLE customers`), `DROP FUNCTION check_customer_tier_change_gate()`
would fail with a dependency error. After `DROP TABLE customers CASCADE`
removes that trigger, the function is free-standing and droppable.

**No `IF EXISTS`.** The objects are proven to exist (Discovery 2/4:
`legacy_tables_still_present` → both; Discovery 2/4: the trigger-fn query
→ `check_customer_tier_change_gate` present). A bare `DROP` that errors
on a missing object is *better* here than `IF EXISTS` silently masking a
surprise — for the point-of-no-return migration, fail loud.

---

## §3 — §8 verification block

Structural post-conditions; `RAISE EXCEPTION` on any mismatch → the
whole transaction rolls back. Six checks — five "the teardown
happened", one "the things that must survive did" (defense-in-depth for
an irreversible op).

```sql
DO $verify_0106$
DECLARE
  v_tables_left   bigint;
  v_orphan_fn     bigint;
  v_v29_policies  bigint;
  v_fn_as_table   bigint;
  v_fn_writes     bigint;
  v_survivors     bigint;
BEGIN
  -- 1. customers + suppliers no longer exist as tables (impl-plan §1.3.4)
  SELECT count(*) INTO v_tables_left
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('customers','suppliers') AND c.relkind='r';
  IF v_tables_left <> 0 THEN
    RAISE EXCEPTION '0106 verify 1: % legacy table(s) still present', v_tables_left;
  END IF;

  -- 2. the orphaned trigger fn check_customer_tier_change_gate is gone
  SELECT count(*) INTO v_orphan_fn
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='check_customer_tier_change_gate';
  IF v_orphan_fn <> 0 THEN
    RAISE EXCEPTION '0106 verify 2: check_customer_tier_change_gate still present';
  END IF;

  -- 3. the 5 v29 customers/suppliers RLS policies went with their tables
  SELECT count(*) INTO v_v29_policies
  FROM pg_policies
  WHERE schemaname='public' AND policyname IN
    ('v29_customers_read','v29_customers_update',
     'v29_suppliers_read','v29_suppliers_update','v29_suppliers_write');
  IF v_v29_policies <> 0 THEN
    RAISE EXCEPTION '0106 verify 3: % legacy RLS policy(ies) still present', v_v29_policies;
  END IF;

  -- 4. no surviving function references customers/suppliers AS A TABLE
  --    (FROM/JOIN/INTO/UPDATE/DELETE). A bare-word scan would still flag
  --    deactivate_tier_v28's comment, so this checks table-reference
  --    SHAPE. MATERIALIZED fence per the AQ-33 / 0104b pattern.
  WITH public_fns AS MATERIALIZED (
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind IN ('f','p'))
  SELECT count(*) INTO v_fn_as_table FROM public_fns
  WHERE pg_get_functiondef(oid) ~*
    '(\mfrom\s+|\mjoin\s+|\minto\s+|\mupdate\s+|\mdelete\s+from\s+)(public\.)?(customers|suppliers)\M';
  IF v_fn_as_table <> 0 THEN
    RAISE EXCEPTION '0106 verify 4: % function(s) reference customers/suppliers as a table', v_fn_as_table;
  END IF;

  -- 5. AQ-33 standing guard: no function writes the legacy tables.
  WITH public_fns AS MATERIALIZED (
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind IN ('f','p'))
  SELECT count(*) INTO v_fn_writes FROM public_fns
  WHERE pg_get_functiondef(oid) ~*
    '(insert\s+into\s+|update\s+|delete\s+from\s+)public\.(customers|suppliers)\M';
  IF v_fn_writes <> 0 THEN
    RAISE EXCEPTION '0106 verify 5 (AQ-33): % function(s) write the legacy tables', v_fn_writes;
  END IF;

  -- 6. defense-in-depth for an irreversible op — the objects that MUST
  --    survive did (CASCADE did not over-reach). §1 proved nothing
  --    outside the legacy tables depends on them; this confirms it from
  --    the other side. Expect all 4 present.
  SELECT count(*) INTO v_survivors
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
    AND c.relname IN ('contacts','contacts_view','ledger_entries','customer_tiers');
  IF v_survivors <> 4 THEN
    RAISE EXCEPTION '0106 verify 6: expected 4 key survivors (contacts, contacts_view, ledger_entries, customer_tiers), found %', v_survivors;
  END IF;

  RAISE NOTICE '0106 OK: customers + suppliers dropped (tables, TOAST, rowtypes, 7 indexes, 9 defaults, 13 constraints, 3 triggers, 5 RLS policies — full enumerated closure); check_customer_tier_change_gate orphan dropped; 0 functions reference the legacy tables as a table; AQ-33 green; contacts / contacts_view / ledger_entries / customer_tiers intact. v2.10 Phase C schema teardown complete.';
END $verify_0106$;
```

---

## §4 — Dry-run plan (execute-then-`ROLLBACK`, §8 output SHOWN)

Per the v2.10 pre-flight discipline ([[feedback-verify-the-sql-fact-you-questioned]]),
and **held until after this package is reviewed** (per the stated
sequence: package → review → dry-run → separate apply authorization).

`DROP TABLE` is transactional in PostgreSQL, so the dry-run is genuinely
net-zero: the tables come back on `ROLLBACK`. The dry-run differs from
the real migration in **one** way — instead of the §3 `DO` block
(`RAISE EXCEPTION`-or-silent-pass), it runs the same six checks as a
**`SELECT` that returns their actual values**, so the verification
output can be *read*, not merely confirmed exception-free (the reviewer's
explicit standard for this migration):

```sql
BEGIN;
  DROP TABLE public.customers CASCADE;
  DROP TABLE public.suppliers CASCADE;
  DROP FUNCTION public.check_customer_tier_change_gate();

  -- §8 checks, SELECT-returning form — values shown, not just "no error"
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname IN ('customers','suppliers') AND c.relkind='r')      AS check1_tables_left,        -- expect 0
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='check_customer_tier_change_gate')                   AS check2_orphan_fn_left,     -- expect 0
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname IN
       ('v29_customers_read','v29_customers_update','v29_suppliers_read',
        'v29_suppliers_update','v29_suppliers_write'))                                             AS check3_v29_policies_left,  -- expect 0
    ( WITH f AS MATERIALIZED (SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.prokind IN ('f','p'))
      SELECT count(*) FROM f WHERE pg_get_functiondef(oid) ~*
        '(\mfrom\s+|\mjoin\s+|\minto\s+|\mupdate\s+|\mdelete\s+from\s+)(public\.)?(customers|suppliers)\M' ) AS check4_fn_as_table, -- expect 0
    ( WITH f AS MATERIALIZED (SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.prokind IN ('f','p'))
      SELECT count(*) FROM f WHERE pg_get_functiondef(oid) ~*
        '(insert\s+into\s+|update\s+|delete\s+from\s+)public\.(customers|suppliers)\M' )           AS check5_fn_writes,          -- expect 0
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname IN
        ('contacts','contacts_view','ledger_entries','customer_tiers'))                            AS check6_survivors;          -- expect 4
ROLLBACK;
```

Expected returned row: `0, 0, 0, 0, 0, 4`. The reviewer sees the actual
six values before the real apply is authorized. The real migration then
runs the §3 `DO`-block form (same logic, `RAISE EXCEPTION` on mismatch)
and `COMMIT`.

---

## §5 — No down-migration

Restated for the record: **0106 has no down-migration** (implementation-plan
§1.2). 0096–0105 each had a staging-only reverse script; 0106 does not,
by design — once `customers` / `suppliers` are dropped, their data is
gone. The only post-`COMMIT` recovery is a PITR / snapshot restore of
the staging database. This is intentional and is the reason the
implementation plan gates 0106 behind explicit owner re-confirmation.

---

## §6 — No new ADR

0106 introduces no new decision — it executes the Phase B lock and the
two cleanup items already recorded in
`2026-05-14-v210-0105-row-migration.md` §6 (`check_customer_tier_change_gate`
explicit drop; `customers`/`suppliers` RLS policies dropped wholesale
with their tables). The dependency-closure analysis in §1 is the
evidence base; if the review or dry-run surfaces anything unexpected,
*that* would merit an ADR.

---

## §7 — Authorization sequence

1. **This package** → reviewer reviews §1 against the standard (every
   dependency claim has its query + result).
2. **Dry-run** (§4) → run on the reviewer's go; §8's six values shown.
3. **Apply** → separate explicit authorization. Then: commit the
   migration file, push, `apply_migration`, §3's `DO`-block runs
   in-commit, then AQ-01..AQ-33 + the impl-plan §1.3.4 check
   (`customers`/`suppliers` absent from `pg_class`).
4. v2.10 Phase C (0096–0106) complete; Phase D (frontend) begins.
