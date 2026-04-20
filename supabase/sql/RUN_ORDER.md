# Fresh Supabase Setup - SQL Run Order

Run the following files in order in the Supabase SQL Editor. Early files create core tables and extensions; later files add policies, indexes, and RPCs.

## Phase 1: Foundation
1. `supabase/sql/2026-02-19_rentpilot_backend_extensions.sql` - Enable UUID, citext extensions
2. `supabase/sql/2026-02-19_rentpilot_core.sql` - Core tables (profiles, tenants, plots, units, payments, invoices)
3. `supabase/sql/2026-02-19_rentpilot_realtime_publication.sql` - Enable realtime

## Phase 2: Features
4. `supabase/sql/2026-02-20_rentpilot_marketplace_tenant_access.sql` - Tenant marketplace access
5. `supabase/sql/2026-02-20_rentpilot_marketplace_booking_tenant_access.sql` - Booking system
6. `supabase/sql/2026-02-20_rentpilot_mpesa_events.sql` - M-Pesa payment events
7. `supabase/sql/2026-02-20_rentpilot_storage_documents.sql` - Storage buckets
8. `supabase/sql/2026-02-20_rentpilot_tenant_finance_rls.sql` - Tenant finance RLS
9. `supabase/sql/2026-02-20_rentpilot_security_hardening.sql` - RLS policies

## Phase 3: Performance
10. `supabase/sql/2026-02-28_rentpilot_performance_phase1_indexes.sql` - Performance indexes
11. `supabase/sql/2026-02-28_rentpilot_performance_phase1_indexes_sql_editor.sql` - SQL editor indexes

## Phase 4: Subscriptions
12. `supabase/sql/2026-03-05_subscription_approval_system.sql` - Subscription system
13. `supabase/sql/2026-03-19_subscription_plan_catalog.sql` - Admin-controlled pricing catalog
14. `supabase/sql/2026-03-19_tenant_saved_listings.sql` - Tenant favorites / saved houses
15. `supabase/sql/2026-03-19_marketplace_inquiries_messages.sql` - Rich marketplace inquiries in messaging

## Phase 5: Final
16. `supabase/sql/2026-02-27_rentpilot_documents_policy_hardening.sql` - Document policies
17. `supabase/sql/2026-02-26_rentpilot_dashboard_metrics_rpc.sql` - Dashboard RPC functions
18. `supabase/sql/2026-03-12_payments_and_enforcement.sql` - Payment enforcement
19. `supabase/sql/2026-03-13_notifications_queue.sql` - Notifications queue + RPC
20. `supabase/sql/2026-03-22_pricing_payment_guardrails.sql` - Pricing, payment, and fee guardrails

## Notes
- Each file uses `if not exists` / `create or replace` where possible, so re-runs are safe.
- Run them in order: early files create tables and extensions used by later ones.

## Optional: CLI Reset
```bash
cd supabase
npx supabase db reset
```
