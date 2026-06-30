-- ============================================================
-- MIGRATION : rendre prestataire_id nullable sur prestations
-- À exécuter dans l'éditeur SQL Supabase
-- ============================================================

alter table public.prestations
  alter column prestataire_id drop not null;
