This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

If you ever see `Cannot find module './xxxx.js'` from `.next/server/webpack-runtime.js` in dev mode, run:

```bash
npm run dev:clean
```

This clears stale Next/Webpack caches before restarting dev.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the dashboard by modifying `src/app/(dashboard)/page.jsx`. The page auto-updates as you edit the file.

## Supabase Setup

1. Copy envs and fill values:

```bash
cp .env.example .env.local
```

2. Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, optional for initial UI wiring)

3. Supabase helpers added in this project:

- Browser client: `src/libs/supabase/client.js`
- Server client: `src/libs/supabase/server.js`

4. Run database SQL (in order):

- `supabase/sql/2026-02-19_rentpilot_core.sql`
- `supabase/sql/2026-02-19_rentpilot_backend_extensions.sql`
- `supabase/sql/2026-02-19_rentpilot_realtime_publication.sql`
- `supabase/sql/2026-02-20_rentpilot_security_hardening.sql`
- `supabase/sql/2026-02-20_rentpilot_storage_documents.sql`
- `supabase/sql/2026-02-20_rentpilot_mpesa_events.sql`
- `supabase/sql/2026-02-20_rentpilot_tenant_finance_rls.sql`

5. Live module data and mutations:

- Server data loader: `src/libs/property/getModulePageData.js`
- Module definitions/mappings: `src/libs/property/modules.js`
- Create API route: `src/app/api/modules/[module]/route.js`

6. Realtime dashboard sync:

- `src/components/layout/shared/RealtimeDashboardSync.jsx`
- Wired in `src/app/(dashboard)/layout.jsx`
- Metrics API: `src/app/api/dashboard/metrics/route.js`
- KPI streaming hook: `src/hooks/useRealtimeDashboardMetrics.js`
- Module data API: `src/app/api/modules/[module]/route.js` (`GET` + `POST`)
- Module realtime hook: `src/hooks/useRealtimeModuleData.js`

7. Document upload and download APIs:

- Upload route: `src/app/api/storage/documents/upload/route.js`
- Download route: `src/app/api/storage/documents/download/route.js`
- Module create form supports file upload for `documents` module

8. M-Pesa API routes:

- STK push: `POST /api/payments/mpesa/stk-push`
- Callback: `POST /api/payments/mpesa/callback`
- Server helper: `src/libs/payments/mpesa.js`
- Requires envs in `.env.local`: `MPESA_*` + `SUPABASE_SERVICE_ROLE_KEY`

## Uptime Monitoring

Health endpoints are available for production monitoring:

- `GET /api/health/live`
  - Liveness probe (process is up)
  - Expected status: `200`
- `GET /api/health/ready`
  - Readiness probe (checks Supabase env + Supabase auth health endpoint)
  - Expected status: `200` when ready, `503` when degraded
- `GET /api/monitoring/heartbeat`
  - Secured monitoring endpoint for cron/uptime platforms
  - Requires header: `Authorization: Bearer <MONITORING_CRON_KEY>`
  - Sends webhook alerts when readiness is degraded

Recommended monitors:

1. Uptime check every 60s on `/api/health/live`.
2. Readiness check every 2-5 min on `/api/health/ready`.
3. Alert policy:
   - `live` failing 2 consecutive checks = critical page.
   - `ready` failing 3 consecutive checks = warning page.

Suggested external cron call:

```bash
curl -H "Authorization: Bearer $MONITORING_CRON_KEY" \
  https://your-domain.com/api/monitoring/heartbeat
```

Alerting envs:

- `MONITORING_CRON_KEY` (required for `/api/monitoring/heartbeat`)
- `ALERT_WEBHOOK_URL` (Slack/Teams/custom webhook endpoint)
- `ALERT_MIN_INTERVAL_MS` (cooldown to prevent alert spam)

## Update Operations

Automated update PRs:

- Dependabot config: `.github/dependabot.yml` (weekly npm + GitHub Actions updates).

Manual update commands:

```bash
npm run deps:outdated
npm run deps:audit
```

Suggested cadence:

1. Weekly: merge patch/minor updates after CI passes.
2. Monthly: planned window for major updates (Next.js, React, Supabase SDK).
3. Always run: `npm run lint && npm run test:contracts && npm run build` before deploy.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
# MambaProperties-Management-System
