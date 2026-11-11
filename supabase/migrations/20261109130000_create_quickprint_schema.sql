-- =============================================================================
-- QuickPrint QR — Schéma principal
-- -----------------------------------------------------------------------------
-- Tables, contraintes, index, Row Level Security et politiques d'accès.
--
-- Principes :
--   * aucun accès anonyme aux données ;
--   * seuls les administrateurs présents dans admin_profiles et actifs peuvent
--     lire les données via le client Supabase ;
--   * les écritures sensibles (documents, réglages) passent par le backend,
--     qui utilise la clé service_role et vérifie les autorisations ;
--   * RLS reste activé : le backend ne s'appuie jamais uniquement sur RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------

create type public.admin_role as enum ('admin');

create type public.print_session_status as enum ('active', 'expired', 'closed');

create type public.document_status as enum ('received', 'printed', 'deleted');

create type public.print_batch_status as enum ('pending', 'processing', 'completed', 'failed');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Profils administrateurs, rattachés aux comptes Supabase Auth.
create table public.admin_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role public.admin_role not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint admin_profiles_full_name_length
    check (char_length(btrim(full_name)) between 2 and 120),
  constraint admin_profiles_email_format
    check (position('@' in email) > 1)
);

comment on table public.admin_profiles is
  'Profils des administrateurs autorisés. Un compte doit exister dans auth.users et dans cette table pour accéder à l''application.';
comment on column public.admin_profiles.is_active is
  'Désactive un administrateur sans supprimer son compte Auth ni son historique.';

create unique index admin_profiles_email_lower_key
  on public.admin_profiles (lower(email));
create index admin_profiles_active_idx
  on public.admin_profiles (is_active)
  where is_active;

-- Sessions de réception temporaires, ouvertes par un administrateur.
create table public.print_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.admin_profiles (id) on delete restrict,
  token_hash text not null,
  status public.print_session_status not null default 'active',
  expires_at timestamptz not null,
  max_files integer not null default 5,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint print_sessions_token_hash_format
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint print_sessions_max_files_range
    check (max_files between 1 and 20),
  constraint print_sessions_expires_after_created
    check (expires_at > created_at),
  constraint print_sessions_closed_at_consistent
    check ((status = 'closed') = (closed_at is not null))
);

comment on table public.print_sessions is
  'Sessions de dépôt temporaires. Le token du QR Code n''est jamais stocké en clair : seule son empreinte SHA-256 est conservée.';

create unique index print_sessions_token_hash_key
  on public.print_sessions (token_hash);
create index print_sessions_created_by_idx
  on public.print_sessions (created_by);
create index print_sessions_status_expires_at_idx
  on public.print_sessions (status, expires_at);

-- Documents PDF reçus dans une session.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.print_sessions (id) on delete cascade,
  original_name text not null,
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  size_bytes bigint not null,
  pages_count integer,
  status public.document_status not null default 'received',
  uploaded_at timestamptz not null default now(),
  printed_at timestamptz,
  deleted_at timestamptz,
  constraint documents_original_name_length
    check (char_length(btrim(original_name)) between 1 and 255),
  constraint documents_original_name_no_path
    check (original_name !~ '[/\\]'),
  constraint documents_storage_path_not_empty
    check (char_length(btrim(storage_path)) > 0),
  constraint documents_mime_type_pdf
    check (mime_type = 'application/pdf'),
  constraint documents_size_bytes_positive
    check (size_bytes > 0),
  constraint documents_pages_count_positive
    check (pages_count is null or pages_count > 0),
  constraint documents_printed_at_consistent
    check (status <> 'printed' or printed_at is not null),
  constraint documents_deleted_at_consistent
    check (status <> 'deleted' or deleted_at is not null),
  constraint documents_printed_at_status
    check (printed_at is null or status in ('printed', 'deleted'))
);

comment on table public.documents is
  'Métadonnées des PDF déposés. Le fichier lui-même reste dans le bucket privé quickprint-documents.';
comment on column public.documents.storage_path is
  'Chemin dans le bucket, au format sessions/<session_id>/<document_id>.pdf.';
comment on column public.documents.pages_count is
  'Nombre de pages, nul tant qu''il n''a pas été déterminé.';

create unique index documents_storage_path_key
  on public.documents (storage_path);
create index documents_session_id_idx
  on public.documents (session_id);
create index documents_session_status_uploaded_at_idx
  on public.documents (session_id, status, uploaded_at desc);
create index documents_status_idx
  on public.documents (status);

-- Lots d'impression créés par un administrateur.
create table public.print_batches (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admin_profiles (id) on delete restrict,
  status public.print_batch_status not null default 'pending',
  total_documents integer not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint print_batches_total_documents_positive
    check (total_documents > 0),
  constraint print_batches_completed_at_consistent
    check (status <> 'completed' or completed_at is not null),
  constraint print_batches_completed_at_status
    check (completed_at is null or status = 'completed')
);

comment on table public.print_batches is
  'Historique des lots d''impression lancés par les administrateurs.';

create index print_batches_admin_id_idx
  on public.print_batches (admin_id);
create index print_batches_status_created_at_idx
  on public.print_batches (status, created_at desc);

-- Association ordonnée entre un lot et ses documents.
create table public.print_batch_documents (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.print_batches (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete restrict,
  print_order integer not null,
  constraint print_batch_documents_print_order_positive
    check (print_order > 0),
  constraint print_batch_documents_batch_document_unique
    unique (batch_id, document_id),
  constraint print_batch_documents_batch_order_unique
    unique (batch_id, print_order)
);

comment on table public.print_batch_documents is
  'Documents composant un lot d''impression, avec leur ordre d''impression.';

create index print_batch_documents_document_id_idx
  on public.print_batch_documents (document_id);

-- Réglages applicatifs modifiables sans redéploiement.
create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  setting_value jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_settings_setting_key_format
    check (setting_key ~ '^[a-z][a-z0-9_.]*$')
);

comment on table public.app_settings is
  'Réglages applicatifs stockés en JSON. Les écritures sont réservées au backend (service_role).';

create unique index app_settings_setting_key_key
  on public.app_settings (setting_key);

-- -----------------------------------------------------------------------------
-- Trigger générique de mise à jour de updated_at
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Vérification des administrateurs actifs
-- -----------------------------------------------------------------------------

-- Retourne true si l'utilisateur authentifié possède un profil admin actif.
-- SECURITY DEFINER évite les problèmes de récursion RLS lors de la lecture de
-- admin_profiles depuis les politiques d'autres tables.
create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role = 'admin'
  );
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.admin_profiles enable row level security;
alter table public.print_sessions enable row level security;
alter table public.documents enable row level security;
alter table public.print_batches enable row level security;
alter table public.print_batch_documents enable row level security;
alter table public.app_settings enable row level security;

-- Aucune politique n'est créée pour le rôle anon : l'accès anonyme est refusé.

-- Profils : lecture seule pour les administrateurs actifs. La création et la
-- désactivation se font manuellement (dashboard Supabase / service_role).
drop policy if exists "Active admins can read admin profiles" on public.admin_profiles;
create policy "Active admins can read admin profiles"
  on public.admin_profiles
  for select
  to authenticated
  using (public.is_active_admin());

-- Sessions : un administrateur actif gère ses propres sessions.
drop policy if exists "Active admins can read print sessions" on public.print_sessions;
create policy "Active admins can read print sessions"
  on public.print_sessions
  for select
  to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can create print sessions" on public.print_sessions;
create policy "Active admins can create print sessions"
  on public.print_sessions
  for insert
  to authenticated
  with check (
    public.is_active_admin()
    and created_by = (select auth.uid())
  );

drop policy if exists "Active admins can update print sessions" on public.print_sessions;
create policy "Active admins can update print sessions"
  on public.print_sessions
  for update
  to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

-- Documents : lecture et mise à jour du statut par les administrateurs.
-- L'insertion et la suppression sont réservées au backend (service_role).
drop policy if exists "Active admins can read documents" on public.documents;
create policy "Active admins can read documents"
  on public.documents
  for select
  to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can update documents" on public.documents;
create policy "Active admins can update documents"
  on public.documents
  for update
  to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

-- Lots d'impression : gestion par les administrateurs actifs.
drop policy if exists "Active admins can read print batches" on public.print_batches;
create policy "Active admins can read print batches"
  on public.print_batches
  for select
  to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can create print batches" on public.print_batches;
create policy "Active admins can create print batches"
  on public.print_batches
  for insert
  to authenticated
  with check (
    public.is_active_admin()
    and admin_id = (select auth.uid())
  );

drop policy if exists "Active admins can update print batches" on public.print_batches;
create policy "Active admins can update print batches"
  on public.print_batches
  for update
  to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

-- Composition des lots.
drop policy if exists "Active admins can read print batch documents" on public.print_batch_documents;
create policy "Active admins can read print batch documents"
  on public.print_batch_documents
  for select
  to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can add print batch documents" on public.print_batch_documents;
create policy "Active admins can add print batch documents"
  on public.print_batch_documents
  for insert
  to authenticated
  with check (public.is_active_admin());

drop policy if exists "Active admins can remove print batch documents" on public.print_batch_documents;
create policy "Active admins can remove print batch documents"
  on public.print_batch_documents
  for delete
  to authenticated
  using (public.is_active_admin());

-- Réglages : lecture seule pour les administrateurs actifs.
drop policy if exists "Active admins can read app settings" on public.app_settings;
create policy "Active admins can read app settings"
  on public.app_settings
  for select
  to authenticated
  using (public.is_active_admin());
