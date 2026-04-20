-- Harden document ownership policy to prevent cross-tenant file_path spoofing.
-- Authenticated users can only insert/update rows that reference their own storage prefix.

drop policy if exists documents_all_policy on public.documents;

create policy documents_all_policy on public.documents
for all
using (
  app.is_admin()
  or owner_id = auth.uid()
)
with check (
  app.is_admin()
  or (
    owner_id = auth.uid()
    and (
      file_path is null
      or file_path like (auth.uid()::text || '/%')
    )
  )
);
