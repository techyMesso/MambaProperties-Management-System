-- RentPilot tenant finance/maintenance RLS alignment
-- Safe to run repeatedly (idempotent policy recreation).
-- Run after core schema; works best after backend extensions.

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

