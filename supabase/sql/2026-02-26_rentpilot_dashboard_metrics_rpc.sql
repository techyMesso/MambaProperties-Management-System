-- Dashboard metric aggregation RPCs
-- Purpose: keep dashboard metrics fast at scale by pushing aggregations to SQL.
-- JS loaders will fallback to query-based logic if this RPC is unavailable.

create schema if not exists app;

create or replace function app.format_kes(amount numeric)
returns text
language sql
immutable
as $$
  select 'KES ' || trim(to_char(greatest(0, round(coalesce(amount, 0)))::numeric, 'FM999G999G999G999G990'));
$$;

create or replace function app.dashboard_metrics_admin()
returns jsonb
language plpgsql
security invoker
set search_path = public, app
as $$
declare
  v_verified_landlords integer := 0;
  v_active_subscriptions integer := 0;
  v_platform_transactions numeric := 0;
  v_audit_events_24h integer := 0;
  v_total_plots integer := 0;
  v_occupied_units integer := 0;
  v_current_month timestamptz := date_trunc('month', timezone('utc', now()));
  v_has_subscriptions boolean := to_regclass('public.landlord_subscriptions') is not null;
begin
  if not app.is_admin() then
    raise exception 'Only admin role can access admin metrics.'
      using errcode = '42501';
  end if;

  select count(*)::int
  into v_verified_landlords
  from public.profiles
  where lower(coalesce(role, '')) = 'landlord';

  if v_has_subscriptions then
    execute $sql$
      select count(*)::int
      from public.landlord_subscriptions
      where lower(coalesce(status, '')) in ('active', 'trial')
    $sql$
    into v_active_subscriptions;
  else
    v_active_subscriptions := v_verified_landlords;
  end if;

  select coalesce(sum(amount), 0)
  into v_platform_transactions
  from public.payments
  where lower(coalesce(status, '')) in ('paid', 'partial')
    and created_at >= v_current_month;

  select count(*)::int
  into v_audit_events_24h
  from public.admin_audit_logs
  where event_time >= (timezone('utc', now()) - interval '24 hours');

  select count(*)::int
  into v_total_plots
  from public.plots;

  select count(*)::int
  into v_occupied_units
  from public.units
  where lower(coalesce(status, '')) = 'occupied';

  return jsonb_build_object(
    'verifiedLandlords', v_verified_landlords,
    'activeSubscriptions', v_active_subscriptions,
    'platformTransactions', app.format_kes(v_platform_transactions),
    'auditEvents24h', v_audit_events_24h,
    'totalPlots', v_total_plots,
    'occupiedUnits', v_occupied_units
  );
end;
$$;

create or replace function app.dashboard_metrics_landlord()
returns jsonb
language plpgsql
security invoker
set search_path = public, app
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := app.current_role();
  v_now timestamptz := timezone('utc', now());
  v_current_month timestamptz := date_trunc('month', timezone('utc', now()));
  v_previous_month timestamptz := date_trunc('month', timezone('utc', now())) - interval '1 month';
  v_week_start timestamptz := date_trunc('day', timezone('utc', now())) - ((extract(dow from timezone('utc', now())))::int * interval '1 day');
  v_week_end timestamptz := date_trunc('day', timezone('utc', now())) - ((extract(dow from timezone('utc', now())))::int * interval '1 day') + interval '7 day';
  v_previous_week_start timestamptz := date_trunc('day', timezone('utc', now())) - ((extract(dow from timezone('utc', now())))::int * interval '1 day') - interval '7 day';
  v_total_plots integer := 0;
  v_total_units integer := 0;
  v_occupied_units integer := 0;
  v_vacant_units integer := 0;
  v_pending_invoices integer := 0;
  v_arrears_tenants integer := 0;
  v_open_maintenance integer := 0;
  v_current_month_total numeric := 0;
  v_previous_month_total numeric := 0;
  v_week_total numeric := 0;
  v_previous_week_total numeric := 0;
  v_sun numeric := 0;
  v_mon numeric := 0;
  v_tue numeric := 0;
  v_wed numeric := 0;
  v_thu numeric := 0;
  v_fri numeric := 0;
  v_sat numeric := 0;
  v_occupancy_rate text := '0%';
  v_rent_collected text := 'KES 0';
  v_trend_percentage integer := 0;
  v_trend_direction text := 'up';
  v_weekly_performance integer := 0;
  v_channels jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if v_role not in ('landlord', 'admin') then
    raise exception 'Only landlord role can access landlord metrics.'
      using errcode = '42501';
  end if;

  select count(*)::int into v_total_plots from public.plots where owner_id = v_uid;
  select count(*)::int into v_total_units from public.units where owner_id = v_uid;
  select count(*)::int into v_occupied_units from public.units where owner_id = v_uid and lower(coalesce(status, '')) = 'occupied';
  select count(*)::int into v_vacant_units from public.units where owner_id = v_uid and lower(coalesce(status, '')) = 'vacant';

  select count(*)::int
  into v_pending_invoices
  from public.invoices
  where owner_id = v_uid
    and lower(coalesce(status, '')) in ('pending', 'partial', 'overdue');

  select count(*)::int
  into v_arrears_tenants
  from public.tenants
  where owner_id = v_uid
    and lower(coalesce(payment_status, '')) = 'arrears';

  select count(*)::int
  into v_open_maintenance
  from public.maintenance_requests
  where owner_id = v_uid
    and lower(coalesce(status, '')) <> 'completed';

  select
    coalesce(sum(amount) filter (where created_at >= v_current_month), 0),
    coalesce(sum(amount) filter (where created_at >= v_previous_month and created_at < v_current_month), 0),
    coalesce(sum(amount) filter (where created_at >= v_week_start and created_at < v_week_end), 0),
    coalesce(sum(amount) filter (where created_at >= v_previous_week_start and created_at < v_week_start), 0),
    coalesce(sum(amount) filter (where created_at >= v_week_start and created_at < v_week_end and extract(dow from created_at) = 0), 0),
    coalesce(sum(amount) filter (where created_at >= v_week_start and created_at < v_week_end and extract(dow from created_at) = 1), 0),
    coalesce(sum(amount) filter (where created_at >= v_week_start and created_at < v_week_end and extract(dow from created_at) = 2), 0),
    coalesce(sum(amount) filter (where created_at >= v_week_start and created_at < v_week_end and extract(dow from created_at) = 3), 0),
    coalesce(sum(amount) filter (where created_at >= v_week_start and created_at < v_week_end and extract(dow from created_at) = 4), 0),
    coalesce(sum(amount) filter (where created_at >= v_week_start and created_at < v_week_end and extract(dow from created_at) = 5), 0),
    coalesce(sum(amount) filter (where created_at >= v_week_start and created_at < v_week_end and extract(dow from created_at) = 6), 0)
  into
    v_current_month_total,
    v_previous_month_total,
    v_week_total,
    v_previous_week_total,
    v_sun,
    v_mon,
    v_tue,
    v_wed,
    v_thu,
    v_fri,
    v_sat
  from public.payments
  where owner_id = v_uid
    and lower(coalesce(status, '')) in ('paid', 'partial')
    and created_at >= v_previous_month;

  if v_total_units > 0 then
    v_occupancy_rate := concat(round((v_occupied_units::numeric / v_total_units::numeric) * 100)::int, '%');
  end if;

  v_rent_collected := app.format_kes(v_current_month_total);

  if v_previous_month_total > 0 then
    v_trend_percentage := round(((v_current_month_total - v_previous_month_total) / v_previous_month_total) * 100)::int;
  elsif v_current_month_total > 0 then
    v_trend_percentage := 100;
  else
    v_trend_percentage := 0;
  end if;

  if v_previous_week_total > 0 then
    v_weekly_performance := round(((v_week_total - v_previous_week_total) / v_previous_week_total) * 100)::int;
  elsif v_week_total > 0 then
    v_weekly_performance := 100;
  else
    v_weekly_performance := 0;
  end if;

  v_trend_direction := case when v_trend_percentage < 0 then 'down' else 'up' end;

  with channel_totals as (
    select
      coalesce(nullif(trim(channel), ''), 'Other') as channel,
      coalesce(sum(amount), 0) as amount
    from public.payments
    where owner_id = v_uid
      and lower(coalesce(status, '')) in ('paid', 'partial')
      and created_at >= v_previous_month
    group by 1
    order by amount desc, channel asc
    limit 3
  ),
  ranked as (
    select
      channel,
      amount,
      row_number() over (order by amount desc, channel asc) as rn
    from channel_totals
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', concat(lower(regexp_replace(channel, '[^a-zA-Z0-9]+', '-', 'g')), '-', rn),
        'title', channel,
        'subtitle', 'Collected rent inflow',
        'amount', app.format_kes(amount),
        'progress', case
          when v_current_month_total > 0 then greatest(1, round((amount / v_current_month_total) * 100)::int)
          else 0
        end,
        'color', case rn
          when 1 then 'primary'
          when 2 then 'info'
          when 3 then 'secondary'
          else 'success'
        end,
        'icon', case
          when lower(channel) like '%mpesa%' or lower(channel) like '%m-pesa%' or lower(channel) like '%mobile money%' then 'ri-smartphone-line'
          when lower(channel) like '%bank%' or lower(channel) like '%transfer%' then 'ri-bank-line'
          when lower(channel) like '%cash%' then 'ri-wallet-3-line'
          when lower(channel) like '%card%' or lower(channel) like '%visa%' or lower(channel) like '%mastercard%' then 'ri-bank-card-line'
          else 'ri-exchange-funds-line'
        end
      )
      order by rn
    ),
    '[]'::jsonb
  )
  into v_channels
  from ranked;

  return jsonb_build_object(
    'totalPlots', v_total_plots,
    'totalUnits', v_total_units,
    'occupiedUnits', v_occupied_units,
    'vacantUnits', v_vacant_units,
    'occupancyRate', v_occupancy_rate,
    'rentCollected', v_rent_collected,
    'pendingInvoices', v_pending_invoices,
    'arrearsTenants', v_arrears_tenants,
    'openMaintenance', v_open_maintenance,
    'analytics', jsonb_build_object(
      'weeklyOverview', jsonb_build_object(
        'categories', to_jsonb(array['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
        'series', to_jsonb(array[
          round(v_sun)::int,
          round(v_mon)::int,
          round(v_tue)::int,
          round(v_wed)::int,
          round(v_thu)::int,
          round(v_fri)::int,
          round(v_sat)::int
        ]),
        'total', round(v_week_total)::int,
        'previousWeekTotal', round(v_previous_week_total)::int,
        'performancePercentage', v_weekly_performance
      ),
      'totalEarning', jsonb_build_object(
        'totalCollected', app.format_kes(v_current_month_total),
        'currentMonthTotal', round(v_current_month_total)::int,
        'previousMonthTotal', round(v_previous_month_total)::int,
        'trendPercentage', v_trend_percentage,
        'trendDirection', v_trend_direction,
        'comparisonLabel', concat('Compared to ', app.format_kes(v_previous_month_total), ' last month'),
        'channels', v_channels
      )
    )
  );
end;
$$;

create or replace function app.dashboard_metrics_agent()
returns jsonb
language plpgsql
security invoker
set search_path = public, app
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := app.current_role();
  v_week_start timestamptz := date_trunc('day', timezone('utc', now())) - ((extract(dow from timezone('utc', now())))::int * interval '1 day');
  v_week_end timestamptz := date_trunc('day', timezone('utc', now())) - ((extract(dow from timezone('utc', now())))::int * interval '1 day') + interval '7 day';
  v_has_viewings boolean := to_regclass('public.viewing_appointments') is not null;
  v_has_messages boolean := to_regclass('public.messages') is not null;
  v_active_listings integer := 0;
  v_viewings_this_week integer := 0;
  v_pending_tenancies integer := 0;
  v_open_tickets integer := 0;
  v_unread_or_pending_messages integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if v_role not in ('agent', 'admin') then
    raise exception 'Only agent role can access agent metrics.'
      using errcode = '42501';
  end if;

  select count(*)::int
  into v_active_listings
  from public.units
  where owner_id = v_uid
    and lower(coalesce(status, '')) = 'vacant';

  if v_has_viewings then
    execute $sql$
      select count(*)::int
      from public.viewing_appointments
      where owner_id = auth.uid()
        and preferred_time >= $1
        and preferred_time < $2
    $sql$
    into v_viewings_this_week
    using v_week_start, v_week_end;
  end if;

  select count(*)::int
  into v_pending_tenancies
  from public.tenancies
  where owner_id = v_uid
    and lower(coalesce(status, '')) in ('pending', 'move-out scheduled');

  select count(*)::int
  into v_open_tickets
  from public.maintenance_requests
  where owner_id = v_uid
    and lower(coalesce(status, '')) <> 'completed';

  if v_has_messages then
    execute $sql$
      select count(*)::int
      from public.messages
      where owner_id = auth.uid()
        and lower(coalesce(status, '')) <> 'completed'
    $sql$
    into v_unread_or_pending_messages;
  end if;

  return jsonb_build_object(
    'activeListings', v_active_listings,
    'viewingsThisWeek', v_viewings_this_week,
    'pendingTenancies', v_pending_tenancies,
    'openTickets', v_open_tickets,
    'unreadOrPendingMessages', v_unread_or_pending_messages
  );
end;
$$;

create or replace function app.dashboard_metrics_tenant()
returns jsonb
language plpgsql
security invoker
set search_path = public, app
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := app.current_role();
  v_owner_ids uuid[] := '{}'::uuid[];
  v_tenant_ids uuid[] := '{}'::uuid[];
  v_tenant_names text[] := '{}'::text[];
  v_unit_codes text[] := '{}'::text[];
  v_active_unit_codes text[] := '{}'::text[];
  v_has_invoices_tenant_id boolean := false;
  v_has_payments_invoice_id boolean := false;
  v_has_maintenance_tenant_id boolean := false;
  v_due_amount numeric := 0;
  v_paid_amount numeric := 0;
  v_rent_balance numeric := 0;
  v_invoice_count integer := 0;
  v_paid_invoices integer := 0;
  v_open_requests integer := 0;
  v_relocation_units integer := 0;
  v_payment_status text := 'No invoices';
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if v_role not in ('tenant', 'admin') then
    raise exception 'Only tenant role can access tenant metrics.'
      using errcode = '42501';
  end if;

  select
    coalesce(array_remove(array_agg(id), null), '{}'::uuid[]),
    coalesce(array_remove(array_agg(distinct owner_id), null), '{}'::uuid[]),
    coalesce(array_remove(array_agg(distinct tenant_name), null), '{}'::text[]),
    coalesce(array_remove(array_agg(distinct unit_code), null), '{}'::text[])
  into
    v_tenant_ids,
    v_owner_ids,
    v_tenant_names,
    v_unit_codes
  from public.tenants
  where auth_user_id = v_uid;

  if coalesce(cardinality(v_owner_ids), 0) = 0 then
    return jsonb_build_object(
      'rentBalance', app.format_kes(0),
      'paidThisMonth', app.format_kes(0),
      'paymentStatus', 'No invoices',
      'openRequests', 0,
      'relocationUnits', 0
    );
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'tenant_id'
  )
  into v_has_invoices_tenant_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'invoice_id'
  )
  into v_has_payments_invoice_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'maintenance_requests'
      and column_name = 'tenant_id'
  )
  into v_has_maintenance_tenant_id;

  if v_has_invoices_tenant_id and coalesce(cardinality(v_tenant_ids), 0) > 0 then
    select
      coalesce(sum(due_amount), 0),
      count(*)::int,
      count(*) filter (where lower(coalesce(status, '')) = 'paid')::int
    into
      v_due_amount,
      v_invoice_count,
      v_paid_invoices
    from public.invoices
    where owner_id = any(v_owner_ids)
      and tenant_id = any(v_tenant_ids);
  elsif coalesce(cardinality(v_tenant_names), 0) > 0 then
    select
      coalesce(sum(due_amount), 0),
      count(*)::int,
      count(*) filter (where lower(coalesce(status, '')) = 'paid')::int
    into
      v_due_amount,
      v_invoice_count,
      v_paid_invoices
    from public.invoices
    where owner_id = any(v_owner_ids)
      and tenant_name = any(v_tenant_names);
  end if;

  if v_has_payments_invoice_id and v_has_invoices_tenant_id and coalesce(cardinality(v_tenant_ids), 0) > 0 then
    select coalesce(sum(p.amount), 0)
    into v_paid_amount
    from public.payments p
    join public.invoices i
      on i.id = p.invoice_id
     and i.owner_id = p.owner_id
    where p.owner_id = any(v_owner_ids)
      and i.tenant_id = any(v_tenant_ids);
  elsif coalesce(cardinality(v_tenant_names), 0) > 0 then
    select coalesce(sum(amount), 0)
    into v_paid_amount
    from public.payments
    where owner_id = any(v_owner_ids)
      and tenant_name = any(v_tenant_names);
  end if;

  if v_has_maintenance_tenant_id and coalesce(cardinality(v_tenant_ids), 0) > 0 then
    select count(*)::int
    into v_open_requests
    from public.maintenance_requests
    where owner_id = any(v_owner_ids)
      and tenant_id = any(v_tenant_ids)
      and lower(coalesce(status, '')) <> 'completed';
  elsif coalesce(cardinality(v_unit_codes), 0) > 0 then
    select count(*)::int
    into v_open_requests
    from public.maintenance_requests
    where owner_id = any(v_owner_ids)
      and unit_code = any(v_unit_codes)
      and lower(coalesce(status, '')) <> 'completed';
  end if;

  if coalesce(cardinality(v_tenant_names), 0) > 0 then
    select coalesce(array_remove(array_agg(distinct unit_code), null), '{}'::text[])
    into v_active_unit_codes
    from public.tenancies
    where owner_id = any(v_owner_ids)
      and tenant_name = any(v_tenant_names)
      and lower(coalesce(status, '')) in ('active', 'move-out scheduled');
  end if;

  if coalesce(cardinality(v_active_unit_codes), 0) = 0 then
    v_active_unit_codes := v_unit_codes;
  end if;

  if coalesce(cardinality(v_owner_ids), 0) > 0 then
    if coalesce(cardinality(v_active_unit_codes), 0) > 0 then
      select count(*)::int
      into v_relocation_units
      from public.units
      where owner_id = any(v_owner_ids)
        and lower(coalesce(status, '')) = 'vacant'
        and (unit_id is null or not (unit_id = any(v_active_unit_codes)));
    else
      select count(*)::int
      into v_relocation_units
      from public.units
      where owner_id = any(v_owner_ids)
        and lower(coalesce(status, '')) = 'vacant';
    end if;
  end if;

  v_rent_balance := greatest(0, coalesce(v_due_amount, 0) - coalesce(v_paid_amount, 0));

  if v_invoice_count > 0 and v_paid_invoices = v_invoice_count then
    v_payment_status := 'Paid';
  elsif coalesce(v_paid_amount, 0) > 0 then
    v_payment_status := 'Partial';
  elsif v_invoice_count > 0 then
    v_payment_status := 'Pending';
  else
    v_payment_status := 'No invoices';
  end if;

  return jsonb_build_object(
    'rentBalance', app.format_kes(v_rent_balance),
    'paidThisMonth', app.format_kes(v_paid_amount),
    'paymentStatus', v_payment_status,
    'openRequests', v_open_requests,
    'relocationUnits', v_relocation_units
  );
end;
$$;

create or replace function app.get_dashboard_metrics(p_scope text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public, app
as $$
declare
  v_scope text := lower(trim(coalesce(p_scope, '')));
  v_role text := app.current_role();
begin
  if v_scope = '' then
    v_scope := case v_role
      when 'admin' then 'admin'
      when 'landlord' then 'landlord'
      when 'agent' then 'agent'
      else 'tenant'
    end;
  end if;

  case v_scope
    when 'admin' then
      return app.dashboard_metrics_admin();
    when 'landlord' then
      return app.dashboard_metrics_landlord();
    when 'agent' then
      return app.dashboard_metrics_agent();
    when 'tenant' then
      return app.dashboard_metrics_tenant();
    else
      raise exception 'Unsupported dashboard scope: %', v_scope
        using errcode = '22023';
  end case;
end;
$$;

grant usage on schema app to authenticated, service_role;
grant execute on function app.format_kes(numeric) to authenticated, service_role;
grant execute on function app.dashboard_metrics_admin() to authenticated, service_role;
grant execute on function app.dashboard_metrics_landlord() to authenticated, service_role;
grant execute on function app.dashboard_metrics_agent() to authenticated, service_role;
grant execute on function app.dashboard_metrics_tenant() to authenticated, service_role;
grant execute on function app.get_dashboard_metrics(text) to authenticated, service_role;
