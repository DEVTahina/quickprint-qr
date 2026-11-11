-- =============================================================================
-- QuickPrint QR — Bucket de stockage privé
-- -----------------------------------------------------------------------------
-- Les PDF sont envoyés et lus par le backend avec la clé service_role.
-- Aucun accès public n'est autorisé ; les administrateurs ne peuvent que lire
-- les objets du bucket, et les URLs publiques restent désactivées.
-- =============================================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'quickprint-documents',
  'quickprint-documents',
  false,
  20971520, -- 20 MiB par fichier
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lecture seule pour les administrateurs actifs (prévisualisation directe).
-- Aucune politique d'insertion, de mise à jour ou de suppression n'est créée
-- pour anon ou authenticated : les uploads passent exclusivement par le
-- backend en service_role, après validation du PDF et de la session.
drop policy if exists "Active admins can read QuickPrint documents" on storage.objects;
create policy "Active admins can read QuickPrint documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'quickprint-documents'
    and public.is_active_admin()
  );
