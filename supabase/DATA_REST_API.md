# Data REST API

Supabase auto-generates a REST API from your database schema so you can interact
with Postgres from the browser or through your own API server. The API is
powered by PostgREST and is available at
`https://<project_ref>.supabase.co/rest/v1/`.

## When to use

- Two-tier apps: call the REST API directly from the browser.
- Three-tier apps: use it alongside your own server-side API.

## Core characteristics

- Instant and auto-generated.
- Schema changes are reflected immediately.
- Self-documenting in the Supabase Dashboard.
- Secure by default with RLS, roles, grants, and key-auth at the API gateway.
- Fast because PostgREST is a thin layer over Postgres.
- Scales to high concurrency and serverless workloads.

## Supported capabilities

- CRUD on tables and views.
- Deeply nested relationships across tables and views.
- Views, materialized views, and foreign tables.
- Functions, including functions that return table types.
- Computed columns and computed relationships.
- Full Postgres security model (RLS, roles, grants).

## API URL and keys

Find the API URL and keys in the Supabase Dashboard.
Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for browser
usage. Use `SUPABASE_SERVICE_ROLE_KEY` only on trusted servers.
