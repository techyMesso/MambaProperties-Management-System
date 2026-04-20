# Supabase Bootstrap (MambaProperties)

Run the SQL bootstrap before using live module data:

- `supabase/sql/2026-02-19_rentpilot_core.sql`
- `supabase/sql/2026-02-19_rentpilot_backend_extensions.sql`
- `supabase/sql/2026-02-19_rentpilot_realtime_publication.sql`
- `supabase/sql/2026-02-20_rentpilot_security_hardening.sql`
- `supabase/sql/2026-02-20_rentpilot_storage_documents.sql`
- `supabase/sql/2026-02-20_rentpilot_mpesa_events.sql`
- `supabase/sql/2026-02-20_rentpilot_tenant_finance_rls.sql`
- `supabase/sql/2026-03-05_subscription_approval_system.sql`
- `supabase/sql/2026-03-19_subscription_plan_catalog.sql`
- `supabase/sql/2026-03-19_tenant_saved_listings.sql`
- `supabase/sql/2026-03-12_payments_and_enforcement.sql`
- `supabase/sql/2026-03-13_notifications_queue.sql`
- `supabase/sql/2026-02-28_rentpilot_performance_phase1_indexes.sql` (recommended for production scale)

`2026-02-19_rentpilot_core.sql` creates:

- `profiles` table with role support (`admin`, `landlord`, `agent`, `tenant`)
- Auto profile creation trigger on `auth.users`
- Core module tables used by the dashboard pages
- RLS policies (owner scoped + admin override)

`2026-02-19_rentpilot_backend_extensions.sql` adds:

- ID/code automation triggers (`PLT`, `UNT`, `AGR`, `RCP`, `INV`, `MT`, `DOC`, `BKG`)
- Tenancy-to-unit occupancy synchronization
- Invoice total + payment status automation
- Auto digital receipt generation (`payment_receipts`)
- Booking and scheduling tables (`bookings`, `viewing_appointments`)
- Utility billing + notifications (`utility_bills`, `notifications`)
- Contractor assignment workflow (`contractors`, `maintenance_assignments`)
- Admin monetization tables (`subscription_plans`, `landlord_subscriptions`, `platform_fee_rules`)
- Optional revenue modules (`meter_readings`, `insurance_policies`, `classifieds_listings`)
- Additional RLS policies for all new tables

`2026-02-20_rentpilot_security_hardening.sql` adds:

- Role trust hardening (`profiles.role` + `app_metadata` fallback only)
- Profile RLS policy tightening to prevent self-role escalation
- Authorization guards on invoice/notification RPC wrappers

`2026-02-20_rentpilot_storage_documents.sql` adds:

- Private `rentpilot-documents` storage bucket (10 MB/file)
- Storage object RLS policies for owner/admin access
- Supported MIME policy for document and image uploads

`2026-02-20_rentpilot_mpesa_events.sql` adds:

- `payment_provider_events` table for STK initiation + callback audit trails
- RLS policies so owners/admin can view provider event logs

`2026-02-20_rentpilot_tenant_finance_rls.sql` adds:

- Tenant-safe read access to `payments` and `invoices` via tenant linkage
- Tenant-safe access to `maintenance_requests` via `tenant_id`
- Keeps writes owner/admin controlled while enabling tenant dashboards

`2026-03-05_subscription_approval_system.sql` adds:

- Landlord approval + KYC tracking on `profiles`
- Plot approval + ownership verification on `plots`
- `tenant_subscriptions`, `landlord_feature_access`, and `platform_income`
- RLS enforcement helpers for marketplace access

`2026-03-19_subscription_plan_catalog.sql` adds:

- Database-backed `subscription_plans` catalog for tenant and landlord pricing
- Plan metadata for billing cycle, duration, feature access, and admin-controlled pricing
- Seed plans for tenant house search, landlord marketplace, landlord management, and full subscription

`2026-03-19_tenant_saved_listings.sql` adds:

- `tenant_saved_listings` for tenant favorite houses
- RLS policies so tenants manage only their own saved listings

`2026-03-12_payments_and_enforcement.sql` adds:

- Missing `payments` columns used by live APIs (invoice refs, metadata, callbacks)
- `units.is_listed` flag for marketplace listing enforcement

`2026-02-28_rentpilot_performance_phase1_indexes.sql` adds:

- Zero-downtime concurrent indexes for dashboard, module list/search, and tenant finance lookups
- `pg_trgm`-based search indexes for the multi-column module filters
- Table `ANALYZE` refresh after index creation

## Run with Supabase SQL Editor

1. Open your project SQL editor.
2. Paste `supabase/sql/2026-02-19_rentpilot_core.sql` and execute.
3. Paste `supabase/sql/2026-02-19_rentpilot_backend_extensions.sql` and execute.
4. Paste `supabase/sql/2026-02-19_rentpilot_realtime_publication.sql` and execute.
5. Paste `supabase/sql/2026-02-20_rentpilot_security_hardening.sql` and execute.
6. Paste `supabase/sql/2026-02-20_rentpilot_storage_documents.sql` and execute.
7. Paste `supabase/sql/2026-02-20_rentpilot_mpesa_events.sql` and execute.
8. Paste `supabase/sql/2026-02-20_rentpilot_tenant_finance_rls.sql` and execute.
9. Paste `supabase/sql/2026-03-05_subscription_approval_system.sql` and execute.
10. Paste `supabase/sql/2026-03-19_subscription_plan_catalog.sql` and execute.
11. Paste `supabase/sql/2026-03-19_tenant_saved_listings.sql` and execute.
12. Paste `supabase/sql/2026-03-12_payments_and_enforcement.sql` and execute.
13. Paste `supabase/sql/2026-03-13_notifications_queue.sql` and execute.
14. Paste `supabase/sql/2026-02-28_rentpilot_performance_phase1_indexes.sql` and execute.

## Run with psql

```bash
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-02-19_rentpilot_core.sql
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-02-19_rentpilot_backend_extensions.sql
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-02-19_rentpilot_realtime_publication.sql
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-02-20_rentpilot_security_hardening.sql
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-02-20_rentpilot_storage_documents.sql
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-02-20_rentpilot_mpesa_events.sql
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-02-20_rentpilot_tenant_finance_rls.sql
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-03-05_subscription_approval_system.sql
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-03-19_subscription_plan_catalog.sql
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-03-19_tenant_saved_listings.sql
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-03-12_payments_and_enforcement.sql
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-03-13_notifications_queue.sql
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-02-28_rentpilot_performance_phase1_indexes.sql
```

## Data REST API

See `supabase/DATA_REST_API.md` for a quick overview of the auto-generated
PostgREST endpoint, capabilities, and key handling.
