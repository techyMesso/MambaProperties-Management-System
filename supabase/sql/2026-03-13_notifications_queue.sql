-- Notifications queue + provider-ready payloads
-- Migration File: 2026-03-13_notifications_queue.sql
-- Safe to run multiple times.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  period text,
  channel text not null check (channel in ('sms', 'whatsapp', 'email')),
  recipient_name text,
  recipient_phone text,
  recipient_email text,
  subject text,
  message text,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  error text,
  sent_at timestamptz,
  last_attempted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Ensure columns exist if the table was created previously with fewer fields.
alter table public.notifications
  add column if not exists owner_id uuid references public.profiles(id) on delete cascade;

alter table public.notifications
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

alter table public.notifications
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

alter table public.notifications
  add column if not exists period text;

alter table public.notifications
  add column if not exists channel text;

alter table public.notifications
  add column if not exists recipient_name text;

alter table public.notifications
  add column if not exists recipient_phone text;

alter table public.notifications
  add column if not exists recipient_email text;

alter table public.notifications
  add column if not exists subject text;

alter table public.notifications
  add column if not exists message text;

alter table public.notifications
  add column if not exists status text;

alter table public.notifications
  add column if not exists attempts integer;

alter table public.notifications
  add column if not exists error text;

alter table public.notifications
  add column if not exists sent_at timestamptz;

alter table public.notifications
  add column if not exists last_attempted_at timestamptz;

alter table public.notifications
  add column if not exists created_at timestamptz;

alter table public.notifications
  add column if not exists updated_at timestamptz;

alter table public.notifications
  alter column status set default 'queued';

alter table public.notifications
  alter column attempts set default 0;

alter table public.notifications
  alter column created_at set default timezone('utc', now());

alter table public.notifications
  alter column updated_at set default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_channel_check'
  ) then
    alter table public.notifications
      add constraint notifications_channel_check
      check (channel in ('sms', 'whatsapp', 'email'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_status_check'
  ) then
    alter table public.notifications
      add constraint notifications_status_check
      check (status in ('queued', 'sending', 'sent', 'failed'));
  end if;
end;
$$;

create index if not exists idx_notifications_owner_id on public.notifications(owner_id);
create index if not exists idx_notifications_status_created_at on public.notifications(status, created_at desc);

create unique index if not exists uniq_notifications_invoice_channel_period
on public.notifications (invoice_id, channel, period)
where invoice_id is not null and period is not null;

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function app.touch_updated_at();

alter table public.notifications enable row level security;

drop policy if exists notifications_all_policy on public.notifications;
create policy notifications_all_policy on public.notifications
for all
using (app.is_admin() or owner_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());

create or replace function app.queue_invoice_notifications(
  p_owner_id uuid,
  p_period text,
  p_channels text[] default array['sms', 'whatsapp']::text[]
)
returns integer
language plpgsql
security definer
set search_path = public, app, auth
as $$
declare
  inserted_count integer := 0;
  normalized_channels text[];
  has_invoice_tenant_id boolean := false;
begin
  normalized_channels := array(
    select distinct lower(trim(c))
    from unnest(p_channels) as c
    where c is not null
      and trim(c) <> ''
      and lower(trim(c)) in ('sms', 'whatsapp', 'email')
  );

  if normalized_channels is null or array_length(normalized_channels, 1) is null then
    normalized_channels := array['sms', 'whatsapp'];
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'tenant_id'
  ) into has_invoice_tenant_id;

  if has_invoice_tenant_id then
    insert into public.notifications (
      owner_id,
      invoice_id,
      tenant_id,
      period,
      channel,
      recipient_name,
      recipient_phone,
      recipient_email,
      subject,
      message,
      status
    )
    select
      i.owner_id,
      i.id,
      t.id,
      i.period,
      channel,
      coalesce(nullif(i.tenant_name, ''), nullif(t.tenant_name, ''), 'Tenant'),
      case when channel in ('sms', 'whatsapp') then nullif(t.phone, '') end,
      case when channel = 'email' then nullif(au.email, '') end,
      concat('Invoice reminder: ', coalesce(i.period, '')),
      concat(
        'Hi ',
        coalesce(nullif(i.tenant_name, ''), nullif(t.tenant_name, ''), 'Tenant'),
        ', your invoice ',
        coalesce(i.invoice_no, ''),
        ' for ',
        coalesce(i.period, ''),
        ' is due. Amount KES ',
        coalesce(i.due_amount, 0)::text,
        '.'
      ),
      'queued'
    from public.invoices i
    left join public.tenants t on t.id = i.tenant_id
    left join auth.users au on au.id = t.auth_user_id
    cross join unnest(normalized_channels) as channel
    where i.owner_id = p_owner_id
      and coalesce(i.period, '') = p_period
      and coalesce(lower(i.status), 'pending') not in ('paid', 'settled')
      and (
        (channel in ('sms', 'whatsapp') and nullif(t.phone, '') is not null)
        or (channel = 'email' and nullif(au.email, '') is not null)
      )
    on conflict (invoice_id, channel, period)
      where invoice_id is not null and period is not null
      do nothing;
  else
    insert into public.notifications (
      owner_id,
      invoice_id,
      tenant_id,
      period,
      channel,
      recipient_name,
      recipient_phone,
      recipient_email,
      subject,
      message,
      status
    )
    select
      i.owner_id,
      i.id,
      t.id,
      i.period,
      channel,
      coalesce(nullif(i.tenant_name, ''), nullif(t.tenant_name, ''), 'Tenant'),
      case when channel in ('sms', 'whatsapp') then nullif(t.phone, '') end,
      case when channel = 'email' then nullif(au.email, '') end,
      concat('Invoice reminder: ', coalesce(i.period, '')),
      concat(
        'Hi ',
        coalesce(nullif(i.tenant_name, ''), nullif(t.tenant_name, ''), 'Tenant'),
        ', your invoice ',
        coalesce(i.invoice_no, ''),
        ' for ',
        coalesce(i.period, ''),
        ' is due. Amount KES ',
        coalesce(i.due_amount, 0)::text,
        '.'
      ),
      'queued'
    from public.invoices i
    left join public.tenants t on t.owner_id = i.owner_id
      and t.tenant_name = i.tenant_name
    left join auth.users au on au.id = t.auth_user_id
    cross join unnest(normalized_channels) as channel
    where i.owner_id = p_owner_id
      and coalesce(i.period, '') = p_period
      and coalesce(lower(i.status), 'pending') not in ('paid', 'settled')
      and (
        (channel in ('sms', 'whatsapp') and nullif(t.phone, '') is not null)
        or (channel = 'email' and nullif(au.email, '') is not null)
      )
    on conflict (invoice_id, channel, period)
      where invoice_id is not null and period is not null
      do nothing;
  end if;

  get diagnostics inserted_count = row_count;

  return inserted_count;
end;
$$;

revoke all on function app.queue_invoice_notifications(uuid, text, text[]) from public, anon, authenticated;
