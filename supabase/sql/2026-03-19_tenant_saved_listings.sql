-- MambaProperties Platform: Tenant saved listings
-- Migration File: 2026-03-19_tenant_saved_listings.sql
--
-- Adds tenant favorites so saved houses can be revisited from the marketplace.

create table if not exists public.tenant_saved_listings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, unit_id)
);

create index if not exists idx_tenant_saved_listings_tenant_created
on public.tenant_saved_listings (tenant_id, created_at desc);

create index if not exists idx_tenant_saved_listings_unit
on public.tenant_saved_listings (unit_id);

alter table public.tenant_saved_listings enable row level security;

drop policy if exists tenant_saved_listings_select_policy on public.tenant_saved_listings;
create policy tenant_saved_listings_select_policy on public.tenant_saved_listings
for select
using (
  tenant_id = auth.uid()
  or app.is_admin()
);

drop policy if exists tenant_saved_listings_insert_policy on public.tenant_saved_listings;
create policy tenant_saved_listings_insert_policy on public.tenant_saved_listings
for insert
with check (
  tenant_id = auth.uid()
  or app.is_admin()
);

drop policy if exists tenant_saved_listings_delete_policy on public.tenant_saved_listings;
create policy tenant_saved_listings_delete_policy on public.tenant_saved_listings
for delete
using (
  tenant_id = auth.uid()
  or app.is_admin()
);
