-- RentPilot security hardening patch (run after core + backend extensions)
-- Applies role trust fixes, profile policy hardening, and RPC access guards.

create schema if not exists app;

alter table public.profiles
  add column if not exists requested_role text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_requested_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_requested_role_check
      check (requested_role in ('admin', 'landlord', 'agent', 'tenant'));
  end if;
end;
$$;

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

create or replace function public.generate_monthly_invoices(
  p_owner_id uuid,
  p_period text,
  p_due_date date default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  caller_role text;
  is_service_role boolean;
begin
  caller_id := auth.uid();
  caller_role := app.current_role();
  is_service_role := auth.role() = 'service_role';

  if not is_service_role and caller_id is null then
    raise exception 'Authentication required for invoice generation.'
      using errcode = '42501';
  end if;

  if not is_service_role and caller_role not in ('admin', 'landlord', 'agent') then
    raise exception 'Only admin, landlord, or agent can generate invoices.'
      using errcode = '42501';
  end if;

  if not is_service_role and caller_role <> 'admin' and p_owner_id is distinct from caller_id then
    raise exception 'Only admins can generate invoices for other owners.'
      using errcode = '42501';
  end if;

  return app.generate_monthly_invoices(p_owner_id, p_period, p_due_date);
end;
$$;

create or replace function public.queue_invoice_notifications(
  p_owner_id uuid,
  p_period text,
  p_channels text[] default array['sms', 'email']::text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  caller_role text;
  is_service_role boolean;
begin
  caller_id := auth.uid();
  caller_role := app.current_role();
  is_service_role := auth.role() = 'service_role';

  if not is_service_role and caller_id is null then
    raise exception 'Authentication required for notification queueing.'
      using errcode = '42501';
  end if;

  if not is_service_role and caller_role not in ('admin', 'landlord', 'agent') then
    raise exception 'Only admin, landlord, or agent can queue invoice notifications.'
      using errcode = '42501';
  end if;

  if not is_service_role and caller_role <> 'admin' and p_owner_id is distinct from caller_id then
    raise exception 'Only admins can queue notifications for other owners.'
      using errcode = '42501';
  end if;

  return app.queue_invoice_notifications(p_owner_id, p_period, p_channels);
end;
$$;

grant execute on function public.generate_monthly_invoices(uuid, text, date) to authenticated;
grant execute on function public.generate_monthly_invoices(uuid, text, date) to service_role;
grant execute on function public.queue_invoice_notifications(uuid, text, text[]) to authenticated;
grant execute on function public.queue_invoice_notifications(uuid, text, text[]) to service_role;

do $$
begin
  if to_regprocedure('app.generate_monthly_invoices(uuid, text, date)') is not null then
    revoke all on function app.generate_monthly_invoices(uuid, text, date) from public, anon, authenticated;
  end if;

  if to_regprocedure('app.queue_invoice_notifications(uuid, text, text[])') is not null then
    revoke all on function app.queue_invoice_notifications(uuid, text, text[]) from public, anon, authenticated;
  end if;
end;
$$;
