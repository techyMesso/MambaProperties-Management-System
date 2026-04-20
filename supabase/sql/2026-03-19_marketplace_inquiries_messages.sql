-- Marketplace inquiries and richer messaging metadata
-- Safe to run multiple times.

alter table public.messages
  add column if not exists sender_profile_id uuid references public.profiles(id) on delete set null;

alter table public.messages
  add column if not exists recipient_profile_id uuid references public.profiles(id) on delete set null;

alter table public.messages
  add column if not exists inquiry_type text;

alter table public.messages
  add column if not exists related_unit_id uuid references public.units(id) on delete set null;

alter table public.messages
  add column if not exists related_request_id uuid;

alter table public.messages
  add column if not exists body text;

create index if not exists idx_messages_sender_profile_id
on public.messages(sender_profile_id);

create index if not exists idx_messages_recipient_profile_id
on public.messages(recipient_profile_id);

create index if not exists idx_messages_related_unit_id
on public.messages(related_unit_id);

create index if not exists idx_messages_inquiry_type
on public.messages(inquiry_type);
