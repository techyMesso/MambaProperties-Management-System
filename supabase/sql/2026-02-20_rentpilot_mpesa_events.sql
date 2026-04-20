-- RentPilot M-Pesa provider event log
-- Optional but recommended for tracing STK requests and callbacks.

create extension if not exists pgcrypto;
create schema if not exists app;

create table if not exists public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  provider text not null default 'mpesa',
  event_type text not null default 'stk_callback',
  checkout_request_id text,
  merchant_request_id text,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_payment_provider_events_owner on public.payment_provider_events(owner_id);
create index if not exists idx_payment_provider_events_payment on public.payment_provider_events(payment_id);
create index if not exists idx_payment_provider_events_checkout on public.payment_provider_events(checkout_request_id);
create index if not exists idx_payment_provider_events_created on public.payment_provider_events(created_at desc);

alter table public.payment_provider_events enable row level security;

drop policy if exists payment_provider_events_select_policy on public.payment_provider_events;
create policy payment_provider_events_select_policy on public.payment_provider_events
for select
using (
  app.is_admin()
  or owner_id = auth.uid()
);

drop policy if exists payment_provider_events_insert_policy on public.payment_provider_events;
create policy payment_provider_events_insert_policy on public.payment_provider_events
for insert
with check (
  app.is_admin()
  or owner_id = auth.uid()
);

drop policy if exists payment_provider_events_update_policy on public.payment_provider_events;
create policy payment_provider_events_update_policy on public.payment_provider_events
for update
using (
  app.is_admin()
  or owner_id = auth.uid()
)
with check (
  app.is_admin()
  or owner_id = auth.uid()
);
