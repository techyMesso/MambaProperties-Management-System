-- RentPilot core schema + auth profile trigger + RLS
-- Run this in your Supabase SQL editor (or via psql) before using live module pages.

create extension if not exists pgcrypto;

create schema if not exists app;

create or replace function app.normalize_role(input_role text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(input_role, 'tenant'))
    when 'admin' then 'admin'
    when 'landlord' then 'landlord'
    when 'agent' then 'agent'
    else 'tenant'
  end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'tenant' check (role in ('admin', 'landlord', 'agent', 'tenant')),
  requested_role text check (requested_role in ('admin', 'landlord', 'agent', 'tenant')),
  full_name text,
  phone text,
  id_number text,
  occupation text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists requested_role text check (requested_role in ('admin', 'landlord', 'agent', 'tenant'));

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function app.touch_updated_at();

create or replace function app.current_role()
returns text
language sql
stable
as $$
  select coalesce(
    (select app.normalize_role(p.role) from public.profiles p where p.id = auth.uid()),
    app.normalize_role(auth.jwt() -> 'app_metadata' ->> 'role')
  );
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
as $$
  -- Use app_metadata directly to avoid recursive policy evaluation on profiles.
  select app.normalize_role(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
$$;

grant usage on schema app to anon, authenticated, service_role;
grant execute on function app.normalize_role(text) to anon, authenticated, service_role;
grant execute on function app.current_role() to anon, authenticated, service_role;
grant execute on function app.is_admin() to anon, authenticated, service_role;

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_value text;
  requested_role_value text;
  requested_role_raw text;
begin
  role_value := app.normalize_role(new.raw_app_meta_data ->> 'role');
  requested_role_raw := lower(trim(coalesce(new.raw_user_meta_data ->> 'requested_role', '')));
  requested_role_value := case
    when requested_role_raw in ('admin', 'landlord', 'agent', 'tenant') then requested_role_raw
    else null
  end;

  insert into public.profiles (id, role, requested_role, full_name, phone, id_number, occupation)
  values (
    new.id,
    role_value,
    requested_role_value,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'id_number', ''),
    nullif(new.raw_user_meta_data ->> 'occupation', '')
  )
  on conflict (id)
  do update set
    requested_role = coalesce(excluded.requested_role, public.profiles.requested_role),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    id_number = coalesce(excluded.id_number, public.profiles.id_number),
    occupation = coalesce(excluded.occupation, public.profiles.occupation),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function app.handle_new_user();

create table if not exists public.plots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  plot_id text not null unique,
  name text not null,
  location text,
  manager text,
  availability_status text not null default 'vacant',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  unit_id text not null unique,
  plot_id text,
  category text,
  rent numeric(12,2),
  status text not null default 'vacant',
  booking_stage text not null default 'open',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  auth_user_id uuid references public.profiles(id) on delete set null,
  tenant_name text not null,
  phone text,
  occupation text,
  unit_code text,
  payment_status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tenancies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  agreement_id text not null unique,
  tenant_name text not null,
  unit_code text not null,
  move_in date,
  move_out date,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  receipt_no text not null unique,
  tenant_name text not null,
  channel text,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  invoice_no text not null unique,
  tenant_name text not null,
  period text,
  due_amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  ticket text not null unique,
  unit_code text,
  issue_type text,
  assignee text,
  priority text not null default 'Medium',
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  thread text not null,
  audience text,
  channel text,
  last_update timestamptz not null default timezone('utc', now()),
  status text not null default 'scheduled',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  doc_id text not null unique,
  type text,
  owner_name text,
  uploaded date,
  status text not null default 'active',
  file_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  report text not null,
  scope text,
  generated_by text,
  updated timestamptz not null default timezone('utc', now()),
  status text not null default 'scheduled',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity text,
  action text,
  owner_name text,
  event_time timestamptz not null default timezone('utc', now()),
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_plots_owner_id on public.plots(owner_id);
create index if not exists idx_units_owner_id on public.units(owner_id);
create index if not exists idx_tenants_owner_id on public.tenants(owner_id);
create index if not exists idx_tenancies_owner_id on public.tenancies(owner_id);
create index if not exists idx_payments_owner_id on public.payments(owner_id);
create index if not exists idx_invoices_owner_id on public.invoices(owner_id);
create index if not exists idx_maintenance_requests_owner_id on public.maintenance_requests(owner_id);
create index if not exists idx_messages_owner_id on public.messages(owner_id);
create index if not exists idx_documents_owner_id on public.documents(owner_id);
create index if not exists idx_report_runs_owner_id on public.report_runs(owner_id);
create index if not exists idx_admin_audit_logs_owner_id on public.admin_audit_logs(owner_id);

drop trigger if exists plots_set_updated_at on public.plots;
create trigger plots_set_updated_at before update on public.plots for each row execute function app.touch_updated_at();
drop trigger if exists units_set_updated_at on public.units;
create trigger units_set_updated_at before update on public.units for each row execute function app.touch_updated_at();
drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at before update on public.tenants for each row execute function app.touch_updated_at();
drop trigger if exists tenancies_set_updated_at on public.tenancies;
create trigger tenancies_set_updated_at before update on public.tenancies for each row execute function app.touch_updated_at();
drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments for each row execute function app.touch_updated_at();
drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices for each row execute function app.touch_updated_at();
drop trigger if exists maintenance_requests_set_updated_at on public.maintenance_requests;
create trigger maintenance_requests_set_updated_at before update on public.maintenance_requests for each row execute function app.touch_updated_at();
drop trigger if exists messages_set_updated_at on public.messages;
create trigger messages_set_updated_at before update on public.messages for each row execute function app.touch_updated_at();
drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at before update on public.documents for each row execute function app.touch_updated_at();
drop trigger if exists report_runs_set_updated_at on public.report_runs;
create trigger report_runs_set_updated_at before update on public.report_runs for each row execute function app.touch_updated_at();
drop trigger if exists admin_audit_logs_set_updated_at on public.admin_audit_logs;
create trigger admin_audit_logs_set_updated_at before update on public.admin_audit_logs for each row execute function app.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.plots enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.tenancies enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;
alter table public.report_runs enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Profiles policies
drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy on public.profiles
for select
using (id = auth.uid() or app.is_admin());

drop policy if exists profiles_insert_policy on public.profiles;
create policy profiles_insert_policy on public.profiles
for insert
with check (
  app.is_admin()
  or (
    id = auth.uid()
    and app.normalize_role(role) = 'tenant'
  )
);

drop policy if exists profiles_update_policy on public.profiles;
create policy profiles_update_policy on public.profiles
for update
using (id = auth.uid() or app.is_admin())
with check (
  app.is_admin()
  or (
    id = auth.uid()
    and app.normalize_role(role) = app.current_role()
  )
);

-- Generic owner-scoped policies
drop policy if exists plots_all_policy on public.plots;
create policy plots_all_policy on public.plots
for all
using (app.is_admin() or owner_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());

drop policy if exists units_all_policy on public.units;
create policy units_all_policy on public.units
for all
using (app.is_admin() or owner_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());

drop policy if exists tenants_all_policy on public.tenants;
create policy tenants_all_policy on public.tenants
for all
using (app.is_admin() or owner_id = auth.uid() or auth_user_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());

drop policy if exists tenancies_all_policy on public.tenancies;
create policy tenancies_all_policy on public.tenancies
for all
using (app.is_admin() or owner_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());

do $$
declare
  has_payments_invoice_id boolean;
  has_invoices_tenant_id boolean;
  has_maintenance_tenant_id boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'invoice_id'
  ) into has_payments_invoice_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'tenant_id'
  ) into has_invoices_tenant_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'maintenance_requests'
      and column_name = 'tenant_id'
  ) into has_maintenance_tenant_id;

  execute 'drop policy if exists payments_all_policy on public.payments';

  if has_payments_invoice_id and has_invoices_tenant_id then
    execute $policy$
      create policy payments_all_policy on public.payments
      for all
      using (
        app.is_admin()
        or owner_id = auth.uid()
        or exists (
          select 1
          from public.invoices i
          join public.tenants t on t.id = i.tenant_id
          where i.id = payments.invoice_id
            and i.owner_id = payments.owner_id
            and t.owner_id = payments.owner_id
            and t.auth_user_id = auth.uid()
        )
      )
      with check (app.is_admin() or owner_id = auth.uid())
    $policy$;
  else
    execute $policy$
      create policy payments_all_policy on public.payments
      for all
      using (app.is_admin() or owner_id = auth.uid())
      with check (app.is_admin() or owner_id = auth.uid())
    $policy$;
  end if;

  execute 'drop policy if exists invoices_all_policy on public.invoices';

  if has_invoices_tenant_id then
    execute $policy$
      create policy invoices_all_policy on public.invoices
      for all
      using (
        app.is_admin()
        or owner_id = auth.uid()
        or exists (
          select 1
          from public.tenants t
          where t.auth_user_id = auth.uid()
            and t.owner_id = invoices.owner_id
            and t.id = invoices.tenant_id
        )
      )
      with check (app.is_admin() or owner_id = auth.uid())
    $policy$;
  else
    execute $policy$
      create policy invoices_all_policy on public.invoices
      for all
      using (app.is_admin() or owner_id = auth.uid())
      with check (app.is_admin() or owner_id = auth.uid())
    $policy$;
  end if;

  execute 'drop policy if exists maintenance_requests_all_policy on public.maintenance_requests';

  if has_maintenance_tenant_id then
    execute $policy$
      create policy maintenance_requests_all_policy on public.maintenance_requests
      for all
      using (
        app.is_admin()
        or owner_id = auth.uid()
        or exists (
          select 1
          from public.tenants t
          where t.auth_user_id = auth.uid()
            and t.id = maintenance_requests.tenant_id
        )
      )
      with check (
        app.is_admin()
        or owner_id = auth.uid()
        or exists (
          select 1
          from public.tenants t
          where t.auth_user_id = auth.uid()
            and t.id = maintenance_requests.tenant_id
        )
      )
    $policy$;
  else
    execute $policy$
      create policy maintenance_requests_all_policy on public.maintenance_requests
      for all
      using (app.is_admin() or owner_id = auth.uid())
      with check (app.is_admin() or owner_id = auth.uid())
    $policy$;
  end if;
end;
$$;

drop policy if exists messages_all_policy on public.messages;
create policy messages_all_policy on public.messages
for all
using (app.is_admin() or owner_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());

drop policy if exists documents_all_policy on public.documents;
create policy documents_all_policy on public.documents
for all
using (app.is_admin() or owner_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());

drop policy if exists report_runs_all_policy on public.report_runs;
create policy report_runs_all_policy on public.report_runs
for all
using (app.is_admin() or owner_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());

drop policy if exists admin_audit_logs_all_policy on public.admin_audit_logs;
create policy admin_audit_logs_all_policy on public.admin_audit_logs
for all
using (app.is_admin() or owner_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());
