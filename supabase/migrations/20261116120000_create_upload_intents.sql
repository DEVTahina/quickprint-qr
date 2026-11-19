-- =============================================================================
-- QuickPrint QR — Intentions d'envoi sécurisé
-- -----------------------------------------------------------------------------
-- Une intention réserve un emplacement avant l'envoi direct du PDF vers
-- Supabase Storage. Elle permet de :
--   * générer un chemin imprévisible côté serveur ;
--   * compter les envois en cours dans la limite de la session ;
--   * rendre la finalisation idempotente.
--
-- Accès exclusivement via le backend (service_role). Aucune politique RLS
-- n'est créée : les rôles anon et authenticated n'ont aucun accès direct.
-- =============================================================================

create table public.upload_intents (
  id uuid primary key,
  session_id uuid not null references public.print_sessions (id) on delete cascade,
  original_name text not null,
  storage_path text not null,
  declared_size_bytes bigint not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint upload_intents_original_name_length
    check (char_length(btrim(original_name)) between 1 and 255),
  constraint upload_intents_original_name_no_path
    check (original_name !~ '[/\\]'),
  constraint upload_intents_storage_path_format
    check (storage_path ~ '^sessions/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),
  constraint upload_intents_size_positive
    check (declared_size_bytes > 0),
  constraint upload_intents_expires_after_created
    check (expires_at > created_at)
);

comment on table public.upload_intents is
  'Autorisations temporaires d''envoi direct vers le bucket privé. Une intention consommée devient un document.';
comment on column public.upload_intents.id is
  'Identifiant du futur document ; il est aussi utilisé dans le chemin de stockage.';
comment on column public.upload_intents.declared_size_bytes is
  'Taille annoncée par le navigateur. La taille réelle est vérifiée à la finalisation.';
comment on column public.upload_intents.expires_at is
  'Fin de la fenêtre pendant laquelle la finalisation est acceptée.';

create unique index upload_intents_storage_path_key
  on public.upload_intents (storage_path);
create index upload_intents_session_id_idx
  on public.upload_intents (session_id);
create index upload_intents_expiration_idx
  on public.upload_intents (session_id, expires_at)
  where consumed_at is null;

alter table public.upload_intents enable row level security;
