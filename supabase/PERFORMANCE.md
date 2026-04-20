# MambaProperties Database Performance Runbook

This runbook applies the first production-safe optimization phase for Supabase Postgres.

## 1) Apply zero-downtime indexes

Run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/sql/2026-02-28_rentpilot_performance_phase1_indexes.sql
```

Notes:

- Uses `CREATE INDEX CONCURRENTLY`, so do not wrap in `BEGIN/COMMIT`.
- If one statement fails, re-run the file; all statements are idempotent via `IF NOT EXISTS`.

## 2) Validate index usage

Top expensive statements:

```sql
create extension if not exists pg_stat_statements;

select
  queryid,
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as mean_ms,
  rows
from pg_stat_statements
order by total_exec_time desc
limit 30;
```

Find tables still doing sequential scans:

```sql
select
  relname,
  seq_scan,
  idx_scan,
  n_live_tup
from pg_stat_user_tables
order by seq_scan desc
limit 30;
```

Inspect index hit ratio:

```sql
select
  schemaname,
  relname,
  idx_scan,
  seq_scan,
  case when (idx_scan + seq_scan) = 0 then 0
       else round((idx_scan::numeric / (idx_scan + seq_scan)) * 100, 2)
  end as index_usage_pct
from pg_stat_user_tables
order by index_usage_pct asc, seq_scan desc
limit 30;
```

## 3) Validate p95 latency improvement

Track these API endpoints before/after:

- `/api/dashboard/metrics`
- `/api/modules/[module]`
- `/api/tenant/payments/context`
- `/api/tenant/invoices/[invoiceId]/download`

Target after phase 1:

- Dashboard p95: 40-70% lower
- Module listing/search p95: 50-80% lower
- Tenant payments context p95: 45-75% lower

## 4) Phase 2 (after schema stabilization)

If your production schema has these columns in place:

- `invoices.tenant_id`
- `payments.invoice_id`
- `maintenance_requests.tenant_id`

Then add FK-path composite indexes (recommended):

```sql
create index concurrently if not exists idx_invoices_owner_tenant_id_created_at_desc
on public.invoices (owner_id, tenant_id, created_at desc);

create index concurrently if not exists idx_payments_owner_invoice_id_created_at_desc
on public.payments (owner_id, invoice_id, created_at desc);

create index concurrently if not exists idx_maintenance_owner_tenant_id_status_created_at_desc
on public.maintenance_requests (owner_id, tenant_id, status, created_at desc);
```

## 5) Ongoing checks

- Re-run `analyze` after large data loads.
- Keep `pg_stat_statements` enabled.
- Alert on:
  - DB CPU > 70% for 10+ minutes
  - p95 API latency regression > 25%
  - connection saturation > 80%
