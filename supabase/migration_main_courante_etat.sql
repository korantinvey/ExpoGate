-- ============================================================
-- MIGRATION : champ etat sur main_courante
-- À exécuter dans l'éditeur SQL Supabase
-- ============================================================

alter table public.main_courante
  add column etat text not null default 'a_traiter'
  check (etat in ('a_traiter', 'pris_en_charge', 'resolu'));
