
-- v2.9 Phase A migration 0069: user_shop_access + user_shop_permissions + audit + pending_invitations
-- Locked design: design/2026-05-13-rbac-model-design.md §B.3.1
-- RLS enabled but policies are placeholders; real policies added in 0073.

-- user_shop_access — one row per (user, shop)
create table if not exists public.user_shop_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  is_owner boolean not null default false,
  preset_applied text check (preset_applied in ('manager', 'salesperson') or preset_applied is null),
  discount_limits jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, shop_id)
);

create unique index uq_user_shop_access_one_owner_per_shop
  on public.user_shop_access (shop_id) where is_owner = true;

create index ix_usa_user on public.user_shop_access (user_id);
create index ix_usa_shop on public.user_shop_access (shop_id);

alter table public.user_shop_access enable row level security;

-- Placeholder policy (real one added 0073). Self-or-owner read for now.
create policy usa_self_or_owner_read on public.user_shop_access
  for select using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.user_shop_access usa_caller
      where usa_caller.user_id = (select auth.uid())
        and usa_caller.shop_id = user_shop_access.shop_id
        and usa_caller.is_owner = true
    )
  );

-- user_shop_permissions — one row per (user_shop_access, permission_key)
create table if not exists public.user_shop_permissions (
  id uuid primary key default gen_random_uuid(),
  user_shop_access_id uuid not null references public.user_shop_access(id) on delete cascade,
  permission_key text not null references public.permissions_catalog(key),
  granted boolean not null,
  granted_by_user_id uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  source text not null default 'preset' check (source in ('preset', 'manual')),
  unique (user_shop_access_id, permission_key)
);

create index ix_usp_lookup on public.user_shop_permissions
  (user_shop_access_id, permission_key) include (granted);

alter table public.user_shop_permissions enable row level security;

-- Placeholder: self or shop-owner read
create policy usp_self_or_owner_read on public.user_shop_permissions
  for select using (
    exists (
      select 1 from public.user_shop_access usa
      where usa.id = user_shop_permissions.user_shop_access_id
        and (usa.user_id = (select auth.uid())
             or exists (
               select 1 from public.user_shop_access usa_caller
               where usa_caller.user_id = (select auth.uid())
                 and usa_caller.shop_id = usa.shop_id
                 and usa_caller.is_owner = true
             ))
    )
  );

-- user_shop_permission_audit
create table if not exists public.user_shop_permission_audit (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id),
  actor_user_id uuid not null references public.profiles(id),
  permission_key text,
  old_granted boolean,
  new_granted boolean,
  old_value jsonb,
  new_value jsonb,
  action text not null check (action in (
    'permission_granted', 'permission_revoked',
    'preset_applied', 'discount_limits_changed',
    'access_granted', 'access_revoked'
  )),
  reason text,
  changed_at timestamptz not null default now()
);

create index ix_uspa_shop on public.user_shop_permission_audit (shop_id, changed_at desc);
create index ix_uspa_target on public.user_shop_permission_audit (target_user_id, changed_at desc);

alter table public.user_shop_permission_audit enable row level security;

-- Placeholder: shop-owner read
create policy uspa_owner_read on public.user_shop_permission_audit
  for select using (
    exists (
      select 1 from public.user_shop_access usa_caller
      where usa_caller.user_id = (select auth.uid())
        and usa_caller.shop_id = user_shop_permission_audit.shop_id
        and usa_caller.is_owner = true
    )
  );

-- pending_invitations
create table if not exists public.pending_invitations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  email text not null check (length(trim(email)) > 0 and email = lower(email)),
  preset_applied text not null check (preset_applied in ('manager', 'salesperson')),
  permissions jsonb not null,
  discount_limits jsonb not null default '{}'::jsonb,
  invited_by_user_id uuid not null references public.profiles(id),
  confirmation_code text not null check (confirmation_code ~ '^[0-9]{4}$'),
  failed_attempts int not null default 0,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id uuid references public.profiles(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index uq_pending_invitations_one_pending_per_shop_email
  on public.pending_invitations (shop_id, email) where status = 'pending';
create index ix_pi_email on public.pending_invitations (lower(email)) where status = 'pending';
create index ix_pi_shop on public.pending_invitations (shop_id, created_at desc);

alter table public.pending_invitations enable row level security;

-- Placeholder: shop-owner or invitee-by-email read
create policy pi_owner_or_invitee_read on public.pending_invitations
  for select using (
    exists (
      select 1 from public.user_shop_access usa_caller
      where usa_caller.user_id = (select auth.uid())
        and usa_caller.shop_id = pending_invitations.shop_id
        and usa_caller.is_owner = true
    )
    or lower(email) = (select lower(email) from public.profiles where id = (select auth.uid()))
  );
