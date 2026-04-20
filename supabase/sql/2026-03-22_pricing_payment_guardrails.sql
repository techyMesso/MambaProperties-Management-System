-- MambaProperties Platform: Pricing & payment guardrails
-- Migration File: 2026-03-22_pricing_payment_guardrails.sql
--
-- Adds basic non-negative / sane constraints to pricing, payment, and fee data.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscription_plans_amount_nonnegative'
      and conrelid = 'public.subscription_plans'::regclass
  ) then
    alter table public.subscription_plans
      add constraint subscription_plans_amount_nonnegative
      check (amount >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscription_plans_duration_positive'
      and conrelid = 'public.subscription_plans'::regclass
  ) then
    alter table public.subscription_plans
      add constraint subscription_plans_duration_positive
      check (duration_days > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_amount_nonnegative'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_amount_nonnegative
      check (amount >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_subscriptions_amount_due_nonnegative'
      and conrelid = 'public.tenant_subscriptions'::regclass
  ) then
    alter table public.tenant_subscriptions
      add constraint tenant_subscriptions_amount_due_nonnegative
      check (amount_due >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_subscriptions_amount_paid_nonnegative'
      and conrelid = 'public.tenant_subscriptions'::regclass
  ) then
    alter table public.tenant_subscriptions
      add constraint tenant_subscriptions_amount_paid_nonnegative
      check (amount_paid >= 0);
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_fee_rules'
      and column_name = 'rate_percent'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'platform_fee_rules_rate_percent_bounds'
      and conrelid = 'public.platform_fee_rules'::regclass
  ) then
    alter table public.platform_fee_rules
      add constraint platform_fee_rules_rate_percent_bounds
      check (rate_percent is null or (rate_percent >= 0 and rate_percent <= 100));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_fee_rules'
      and column_name = 'percentage'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'platform_fee_rules_percentage_bounds'
      and conrelid = 'public.platform_fee_rules'::regclass
  ) then
    alter table public.platform_fee_rules
      add constraint platform_fee_rules_percentage_bounds
      check (percentage is null or (percentage >= 0 and percentage <= 100));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_fee_rules'
      and column_name = 'commission_percent'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'platform_fee_rules_commission_percent_bounds'
      and conrelid = 'public.platform_fee_rules'::regclass
  ) then
    alter table public.platform_fee_rules
      add constraint platform_fee_rules_commission_percent_bounds
      check (commission_percent is null or (commission_percent >= 0 and commission_percent <= 100));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_fee_rules'
      and column_name = 'flat_amount'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'platform_fee_rules_flat_amount_nonnegative'
      and conrelid = 'public.platform_fee_rules'::regclass
  ) then
    alter table public.platform_fee_rules
      add constraint platform_fee_rules_flat_amount_nonnegative
      check (flat_amount is null or flat_amount >= 0);
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_fee_rules'
      and column_name = 'amount'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'platform_fee_rules_amount_nonnegative'
      and conrelid = 'public.platform_fee_rules'::regclass
  ) then
    alter table public.platform_fee_rules
      add constraint platform_fee_rules_amount_nonnegative
      check (amount is null or amount >= 0);
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_fee_rules'
      and column_name = 'fixed_fee'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'platform_fee_rules_fixed_fee_nonnegative'
      and conrelid = 'public.platform_fee_rules'::regclass
  ) then
    alter table public.platform_fee_rules
      add constraint platform_fee_rules_fixed_fee_nonnegative
      check (fixed_fee is null or fixed_fee >= 0);
  end if;
end $$;
