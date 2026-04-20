-- RentPilot realtime publication setup
-- Run this once in Supabase SQL editor (or via migration) after core + extensions.

do $$
declare
  table_name text;
  table_list text[] := array[
    'profiles',
    'plots',
    'units',
    'tenants',
    'tenancies',
    'payments',
    'invoices',
    'maintenance_requests',
    'messages',
    'documents',
    'report_runs',
    'admin_audit_logs',
    'unit_media',
    'viewing_appointments',
    'bookings',
    'utility_bills',
    'payment_receipts',
    'notifications',
    'contractors',
    'maintenance_assignments',
    'subscription_plans',
    'landlord_subscriptions',
    'platform_fee_rules',
    'tenant_subscriptions',
    'landlord_feature_access',
    'platform_income',
    'landlord_documents',
    'meter_readings',
    'insurance_policies',
    'classifieds_listings',
    'payment_provider_events'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publication supabase_realtime not found. Skipping realtime publication setup.';
    return;
  end if;

  foreach table_name in array table_list loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relkind = 'r'
    )
    and not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
