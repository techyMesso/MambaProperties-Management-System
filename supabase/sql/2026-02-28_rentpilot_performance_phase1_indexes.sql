-- RentPilot DB performance phase 1 (zero-downtime indexes)
-- Safe to run on production. Uses CREATE INDEX CONCURRENTLY to avoid table write locks.
--
-- Important:
-- 1) Run with psql/direct DB connection (not inside an explicit transaction block).
-- 2) Keep each statement top-level; do not wrap this file in BEGIN/COMMIT.

create extension if not exists pg_trgm;

-- Dashboard and finance hot paths
create index concurrently if not exists idx_payments_owner_created_at_desc
on public.payments (owner_id, created_at desc);

create index concurrently if not exists idx_payments_owner_status_created_at_desc
on public.payments (owner_id, status, created_at desc);

create index concurrently if not exists idx_payments_owner_paid_partial_created_at_desc
on public.payments (owner_id, created_at desc)
where status in ('paid', 'partial');

create index concurrently if not exists idx_payments_owner_tenant_name_created_at_desc
on public.payments (owner_id, tenant_name, created_at desc);

create index concurrently if not exists idx_invoices_owner_status_created_at_desc
on public.invoices (owner_id, status, created_at desc);

create index concurrently if not exists idx_invoices_owner_open_created_at_desc
on public.invoices (owner_id, created_at desc)
where status in ('pending', 'partial', 'overdue');

create index concurrently if not exists idx_invoices_owner_tenant_name_created_at_desc
on public.invoices (owner_id, tenant_name, created_at desc);

create index concurrently if not exists idx_tenants_auth_user_owner_id
on public.tenants (auth_user_id, owner_id, id);

create index concurrently if not exists idx_tenants_owner_payment_status_created_at_desc
on public.tenants (owner_id, payment_status, created_at desc);

create index concurrently if not exists idx_units_owner_status_created_at_desc
on public.units (owner_id, status, created_at desc);

create index concurrently if not exists idx_units_owner_plot_status_created_at_desc
on public.units (owner_id, plot_id, status, created_at desc);

create index concurrently if not exists idx_maintenance_owner_status_created_at_desc
on public.maintenance_requests (owner_id, status, created_at desc);

create index concurrently if not exists idx_maintenance_owner_open_created_at_desc
on public.maintenance_requests (owner_id, created_at desc)
where status <> 'completed';

create index concurrently if not exists idx_tenancies_owner_status_created_at_desc
on public.tenancies (owner_id, status, created_at desc);

create index concurrently if not exists idx_tenancies_owner_unit_status_created_at_desc
on public.tenancies (owner_id, unit_code, status, created_at desc);

create index concurrently if not exists idx_documents_owner_type_status_created_at_desc
on public.documents (owner_id, type, status, created_at desc);

create index concurrently if not exists idx_admin_audit_logs_event_time_desc
on public.admin_audit_logs (event_time desc);

create index concurrently if not exists idx_admin_audit_logs_owner_event_time_desc
on public.admin_audit_logs (owner_id, event_time desc);

create index concurrently if not exists idx_profiles_role
on public.profiles (role);

-- Module search acceleration (ILIKE multi-column search)
create index concurrently if not exists idx_plots_search_trgm
on public.plots
using gin ((coalesce(plot_id, '') || ' ' || coalesce(name, '') || ' ' || coalesce(location, '') || ' ' || coalesce(manager, '')) gin_trgm_ops);

create index concurrently if not exists idx_units_search_trgm
on public.units
using gin ((coalesce(unit_id, '') || ' ' || coalesce(plot_id, '') || ' ' || coalesce(category, '') || ' ' || coalesce(status, '')) gin_trgm_ops);

create index concurrently if not exists idx_tenants_search_trgm
on public.tenants
using gin ((coalesce(tenant_name, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(occupation, '') || ' ' || coalesce(unit_code, '')) gin_trgm_ops);

create index concurrently if not exists idx_tenancies_search_trgm
on public.tenancies
using gin ((coalesce(agreement_id, '') || ' ' || coalesce(tenant_name, '') || ' ' || coalesce(unit_code, '') || ' ' || coalesce(status, '')) gin_trgm_ops);

analyze public.payments;
analyze public.invoices;
analyze public.tenants;
analyze public.units;
analyze public.tenancies;
analyze public.maintenance_requests;
analyze public.documents;
analyze public.admin_audit_logs;
