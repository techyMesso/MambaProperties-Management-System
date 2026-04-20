-- RentPilot document storage setup
-- Run after core schema so app.is_admin() is available.

grant usage on schema app to anon, authenticated, service_role;
grant execute on function app.normalize_role(text) to anon, authenticated, service_role;
grant execute on function app.current_role() to anon, authenticated, service_role;
grant execute on function app.is_admin() to anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rentpilot-documents',
  'rentpilot-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists rentpilot_documents_select on storage.objects;
create policy rentpilot_documents_select on storage.objects
for select to authenticated
using (
  bucket_id = 'rentpilot-documents'
  and (
    owner = auth.uid()
    or app.is_admin()
  )
);

drop policy if exists rentpilot_documents_insert on storage.objects;
create policy rentpilot_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'rentpilot-documents'
  and owner = auth.uid()
);

drop policy if exists rentpilot_documents_update on storage.objects;
create policy rentpilot_documents_update on storage.objects
for update to authenticated
using (
  bucket_id = 'rentpilot-documents'
  and (
    owner = auth.uid()
    or app.is_admin()
  )
)
with check (
  bucket_id = 'rentpilot-documents'
  and (
    owner = auth.uid()
    or app.is_admin()
  )
);

drop policy if exists rentpilot_documents_delete on storage.objects;
create policy rentpilot_documents_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'rentpilot-documents'
  and (
    owner = auth.uid()
    or app.is_admin()
  )
);
