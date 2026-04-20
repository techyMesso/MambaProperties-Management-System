-- MambaProperties Platform: Subscription plan catalog
-- Migration File: 2026-03-19_subscription_plan_catalog.sql
--
-- Adds a database-backed pricing catalog for tenant and landlord subscriptions
-- so admin can change plan amounts and features without code edits.

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null unique,
  plan_name text not null,
  description text,
  audience text not null default 'tenant'
    check (audience in ('tenant', 'landlord', 'agent', 'landlord_agent', 'platform')),
  feature_key text not null,
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'yearly', 'one_time')),
  amount numeric(12, 2) not null default 0,
  currency text not null default 'KES',
  duration_days integer not null default 30,
  features jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.subscription_plans
  add column if not exists code text;

alter table public.subscription_plans
  add column if not exists name text;

alter table public.subscription_plans
  add column if not exists plan_code text;

alter table public.subscription_plans
  add column if not exists plan_name text;

alter table public.subscription_plans
  add column if not exists description text;

alter table public.subscription_plans
  add column if not exists audience text;

alter table public.subscription_plans
  add column if not exists feature_key text;

alter table public.subscription_plans
  add column if not exists billing_cycle text;

alter table public.subscription_plans
  add column if not exists amount numeric(12, 2);

alter table public.subscription_plans
  add column if not exists currency text;

alter table public.subscription_plans
  add column if not exists duration_days integer;

alter table public.subscription_plans
  add column if not exists features jsonb;

alter table public.subscription_plans
  add column if not exists sort_order integer;

alter table public.subscription_plans
  add column if not exists active boolean not null default true;

alter table public.subscription_plans
  add column if not exists metadata jsonb;

alter table public.subscription_plans
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.subscription_plans
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.subscription_plans
set
  code = coalesce(nullif(code, ''), nullif(plan_code, ''), lower(regexp_replace(coalesce(plan_name, name, 'plan'), '[^a-zA-Z0-9]+', '_', 'g'))),
  name = coalesce(nullif(name, ''), nullif(plan_name, ''), initcap(replace(coalesce(plan_code, code, 'plan'), '_', ' '))),
  plan_code = coalesce(nullif(plan_code, ''), nullif(code, ''), lower(regexp_replace(coalesce(plan_name, name, 'plan'), '[^a-zA-Z0-9]+', '_', 'g'))),
  plan_name = coalesce(nullif(plan_name, ''), nullif(name, ''), initcap(replace(coalesce(plan_code, code, 'plan'), '_', ' '))),
  audience = coalesce(nullif(audience, ''), 'tenant'),
  feature_key = coalesce(nullif(feature_key, ''), coalesce(plan_code, code, 'general_plan')),
  billing_cycle = coalesce(nullif(billing_cycle, ''), 'monthly'),
  amount = coalesce(amount, 0),
  currency = coalesce(nullif(currency, ''), 'KES'),
  duration_days = coalesce(duration_days, 30),
  features = coalesce(features, '[]'::jsonb),
  sort_order = coalesce(sort_order, 0),
  active = coalesce(active, true),
  metadata = coalesce(metadata, '{}'::jsonb),
  updated_at = coalesce(updated_at, timezone('utc', now()))
where
  plan_code is null
  or plan_name is null
  or audience is null
  or feature_key is null
  or billing_cycle is null
  or amount is null
  or currency is null
  or duration_days is null
  or features is null
  or sort_order is null
  or active is null
  or metadata is null
  or updated_at is null;

alter table public.subscription_plans
  alter column plan_code set not null;

alter table public.subscription_plans
  alter column plan_name set not null;

alter table public.subscription_plans
  alter column audience set default 'tenant';

alter table public.subscription_plans
  alter column audience set not null;

alter table public.subscription_plans
  alter column feature_key set not null;

alter table public.subscription_plans
  alter column billing_cycle set default 'monthly';

alter table public.subscription_plans
  alter column billing_cycle set not null;

alter table public.subscription_plans
  alter column amount set default 0;

alter table public.subscription_plans
  alter column amount set not null;

alter table public.subscription_plans
  alter column currency set default 'KES';

alter table public.subscription_plans
  alter column currency set not null;

alter table public.subscription_plans
  alter column duration_days set default 30;

alter table public.subscription_plans
  alter column duration_days set not null;

alter table public.subscription_plans
  alter column features set default '[]'::jsonb;

alter table public.subscription_plans
  alter column features set not null;

alter table public.subscription_plans
  alter column sort_order set default 0;

alter table public.subscription_plans
  alter column sort_order set not null;

alter table public.subscription_plans
  alter column metadata set default '{}'::jsonb;

alter table public.subscription_plans
  alter column metadata set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscription_plans_audience_check'
      and conrelid = 'public.subscription_plans'::regclass
  ) then
    alter table public.subscription_plans
      add constraint subscription_plans_audience_check
      check (audience in ('tenant', 'landlord', 'agent', 'landlord_agent', 'platform'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscription_plans_billing_cycle_check'
      and conrelid = 'public.subscription_plans'::regclass
  ) then
    alter table public.subscription_plans
      add constraint subscription_plans_billing_cycle_check
      check (billing_cycle in ('monthly', 'yearly', 'one_time'));
  end if;
end $$;

create unique index if not exists idx_subscription_plans_plan_code
on public.subscription_plans(plan_code);

create index if not exists idx_subscription_plans_active_sort
on public.subscription_plans(active, sort_order, created_at desc);

create index if not exists idx_subscription_plans_feature_key
on public.subscription_plans(feature_key);

alter table public.subscription_plans enable row level security;

grant select on public.subscription_plans to anon, authenticated;
grant all on public.subscription_plans to service_role;

drop policy if exists subscription_plans_read_policy on public.subscription_plans;
create policy subscription_plans_read_policy on public.subscription_plans
for select
using (active = true or app.is_admin());

drop policy if exists subscription_plans_admin_policy on public.subscription_plans;
create policy subscription_plans_admin_policy on public.subscription_plans
for all
using (app.is_admin())
with check (app.is_admin());

drop trigger if exists subscription_plans_set_updated_at on public.subscription_plans;
create trigger subscription_plans_set_updated_at
before update on public.subscription_plans
for each row
execute function app.touch_updated_at();

insert into public.subscription_plans (
  code,
  name,
  plan_code,
  plan_name,
  description,
  audience,
  feature_key,
  billing_cycle,
  amount,
  currency,
  duration_days,
  features,
  sort_order,
  active
)
values
  (
    'tenant_house_search',
    'Tenant House Search',
    'tenant_house_search',
    'Tenant House Search',
    'Monthly marketplace access for tenants searching for a house.',
    'tenant',
    'house_search',
    'monthly',
    299,
    'KES',
    30,
    '["Search listed houses","Save favorites","Contact landlords","Book viewings"]'::jsonb,
    10,
    true
  ),
  (
    'landlord_marketplace',
    'Marketplace Only',
    'landlord_marketplace',
    'Marketplace Only',
    'Annual listing access for landlords and agents who only want advertising.',
    'landlord_agent',
    'marketplace_listing',
    'yearly',
    999,
    'KES',
    365,
    '["List houses on marketplace","Receive tenant inquiries","Publish vacancy updates"]'::jsonb,
    20,
    true
  ),
  (
    'landlord_management',
    'Management Module Only',
    'landlord_management',
    'Management Module Only',
    'Annual management tools for landlords with existing tenants.',
    'landlord_agent',
    'management_module',
    'yearly',
    1499,
    'KES',
    365,
    '["Manage tenants","Record rent payments","Track rent balances","Send reminders"]'::jsonb,
    30,
    true
  ),
  (
    'landlord_full_access',
    'Full Subscription',
    'landlord_full_access',
    'Full Subscription',
    'Annual access to both marketplace and property management tools.',
    'landlord_agent',
    'full_access',
    'yearly',
    2199,
    'KES',
    365,
    '["Marketplace listings","Tenant search and inquiries","Full tenant management","Rent tracking and payment records"]'::jsonb,
    40,
    true
  )
on conflict (plan_code) do update
set
  code = excluded.code,
  name = excluded.name,
  plan_name = excluded.plan_name,
  description = excluded.description,
  audience = excluded.audience,
  feature_key = excluded.feature_key,
  billing_cycle = excluded.billing_cycle,
  amount = excluded.amount,
  currency = excluded.currency,
  duration_days = excluded.duration_days,
  features = excluded.features,
  sort_order = excluded.sort_order;
