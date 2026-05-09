-- profiles: 1:1 with auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  preferred_language text not null default 'en' check (preferred_language in ('en','ur')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- subscription_status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum ('trial','active','expired','suspended');
  end if;
end$$;

-- subscriptions: 1:1 with profiles
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.subscription_status not null default 'trial',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  last_payment_date date,
  last_payment_amount numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_self_read" on public.subscriptions;
create policy "subscriptions_self_read" on public.subscriptions
  for select using (user_id = auth.uid());

-- handle_new_user: trigger on auth.users insert -> creates profile + trial subscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  insert into public.subscriptions (user_id, status, trial_started_at, trial_ends_at)
  values (new.id, 'trial', now(), now() + interval '30 days');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
