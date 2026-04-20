-- RentPilot marketplace booking/viewing tenant access
-- Run after core schema + backend extensions.
-- Replaces broad all-in-one policies with safer role-split policies.

do $$
declare
  has_is_listed boolean;
  has_viewing_appointments boolean;
  has_bookings boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'units'
      and column_name = 'is_listed'
  ) into has_is_listed;

  select to_regclass('public.viewing_appointments') is not null into has_viewing_appointments;
  select to_regclass('public.bookings') is not null into has_bookings;

  if has_viewing_appointments then
    execute 'drop policy if exists viewing_appointments_all_policy on public.viewing_appointments';
    execute 'drop policy if exists viewing_appointments_management_all_policy on public.viewing_appointments';
    execute 'drop policy if exists viewing_appointments_tenant_select_policy on public.viewing_appointments';
    execute 'drop policy if exists viewing_appointments_tenant_insert_policy on public.viewing_appointments';

    execute $policy$
      create policy viewing_appointments_management_all_policy on public.viewing_appointments
      for all
      to authenticated
      using (app.is_admin() or owner_id = auth.uid())
      with check (app.is_admin() or owner_id = auth.uid())
    $policy$;

    execute $policy$
      create policy viewing_appointments_tenant_select_policy on public.viewing_appointments
      for select
      to authenticated
      using (
        app.current_role() = 'tenant'
        and tenant_profile_id = auth.uid()
      )
    $policy$;

    if has_is_listed then
      execute $policy$
        create policy viewing_appointments_tenant_insert_policy on public.viewing_appointments
        for insert
        to authenticated
        with check (
          app.current_role() = 'tenant'
          and tenant_profile_id = auth.uid()
          and exists (
            select 1
            from public.units u
            where u.id = viewing_appointments.unit_id
              and u.owner_id = viewing_appointments.owner_id
              and u.status = 'vacant'
              and coalesce(u.is_listed, true)
          )
        )
      $policy$;
    else
      execute $policy$
        create policy viewing_appointments_tenant_insert_policy on public.viewing_appointments
        for insert
        to authenticated
        with check (
          app.current_role() = 'tenant'
          and tenant_profile_id = auth.uid()
          and exists (
            select 1
            from public.units u
            where u.id = viewing_appointments.unit_id
              and u.owner_id = viewing_appointments.owner_id
              and u.status = 'vacant'
          )
        )
      $policy$;
    end if;
  end if;

  if has_bookings then
    execute 'drop policy if exists bookings_all_policy on public.bookings';
    execute 'drop policy if exists bookings_management_all_policy on public.bookings';
    execute 'drop policy if exists bookings_tenant_select_policy on public.bookings';
    execute 'drop policy if exists bookings_tenant_insert_policy on public.bookings';

    execute $policy$
      create policy bookings_management_all_policy on public.bookings
      for all
      to authenticated
      using (app.is_admin() or owner_id = auth.uid())
      with check (app.is_admin() or owner_id = auth.uid())
    $policy$;

    execute $policy$
      create policy bookings_tenant_select_policy on public.bookings
      for select
      to authenticated
      using (
        app.current_role() = 'tenant'
        and tenant_profile_id = auth.uid()
      )
    $policy$;

    if has_is_listed then
      execute $policy$
        create policy bookings_tenant_insert_policy on public.bookings
        for insert
        to authenticated
        with check (
          app.current_role() = 'tenant'
          and tenant_profile_id = auth.uid()
          and exists (
            select 1
            from public.units u
            where u.id = bookings.unit_id
              and u.owner_id = bookings.owner_id
              and u.status = 'vacant'
              and coalesce(u.is_listed, true)
          )
        )
      $policy$;
    else
      execute $policy$
        create policy bookings_tenant_insert_policy on public.bookings
        for insert
        to authenticated
        with check (
          app.current_role() = 'tenant'
          and tenant_profile_id = auth.uid()
          and exists (
            select 1
            from public.units u
            where u.id = bookings.unit_id
              and u.owner_id = bookings.owner_id
              and u.status = 'vacant'
          )
        )
      $policy$;
    end if;
  end if;
end;
$$;

