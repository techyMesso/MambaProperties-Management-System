-- RentPilot marketplace tenant access policy
-- Run after core schema + backend extensions.
-- Grants tenants read access to listed vacant units for marketplace browsing.

do $$
declare
  has_is_listed boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'units'
      and column_name = 'is_listed'
  ) into has_is_listed;

  execute 'drop policy if exists units_marketplace_tenant_select on public.units';

  if has_is_listed then
    execute $policy$
      create policy units_marketplace_tenant_select on public.units
      for select
      to authenticated
      using (
        app.current_role() = 'tenant'
        and status = 'vacant'
        and coalesce(is_listed, true)
      )
    $policy$;
  else
    execute $policy$
      create policy units_marketplace_tenant_select on public.units
      for select
      to authenticated
      using (
        app.current_role() = 'tenant'
        and status = 'vacant'
      )
    $policy$;
  end if;
end;
$$;

