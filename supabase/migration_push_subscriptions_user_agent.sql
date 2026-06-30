-- ============================================================
-- MIGRATION : ajout colonne user_agent sur push_subscriptions
-- À exécuter dans l'éditeur SQL Supabase
-- ============================================================

alter table public.push_subscriptions
  add column if not exists user_agent text;
