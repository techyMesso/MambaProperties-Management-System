-- Account deactivation tracking for profiles
-- Adds soft-delete fields and keeps admin metrics accurate.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_status TEXT
  DEFAULT 'active'
  CHECK (account_status IN ('active', 'deactivated', 'deleted'));

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
ON public.profiles(account_status);

-- Backfill existing profiles to active to avoid null filtering issues
UPDATE public.profiles
SET account_status = 'active'
WHERE account_status IS NULL;

-- Update admin dashboard metrics to ignore deactivated accounts
CREATE OR REPLACE FUNCTION app.dashboard_metrics_admin()
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
  where lower(coalesce(role, '')) = 'landlord'
    and coalesce(account_status, 'active') <> 'deactivated';

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
