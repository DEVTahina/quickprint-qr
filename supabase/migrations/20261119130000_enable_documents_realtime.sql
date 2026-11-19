-- Le tableau de bord s'abonne aux changements de `public.documents` pour
-- afficher les nouveaux PDF sans rechargement. La RLS existante
-- (`is_active_admin()`) continue de filtrer les evenements recus.
--
-- Migration idempotente : l'ajout a la publication est ignore si la table y
-- figure deja.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'documents'
  ) then
    alter publication supabase_realtime add table public.documents;
  end if;
end
$$;
