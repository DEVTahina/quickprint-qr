-- =============================================================================
-- QuickPrint QR — Consultation des documents
-- -----------------------------------------------------------------------------
-- L'espace administrateur liste les PDF déposés de la plus récente à la plus
-- ancienne dépôt, avec filtres par statut et par session. L'index existant
-- (session_id, status, uploaded_at desc) ne couvre pas le tri global ni le
-- filtre par statut seul trié par date. Ces deux index restent en lecture seule
-- pour l'application : aucune donnée n'est modifiée.
-- =============================================================================

create index documents_uploaded_at_idx
  on public.documents (uploaded_at desc);

create index documents_status_uploaded_at_idx
  on public.documents (status, uploaded_at desc);
