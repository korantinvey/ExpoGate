-- ============================================================
-- MIGRATION V2 — Annuaire prestataire (user <-> société, global)
-- ============================================================

create table public.prestataire_contacts (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  prestataire_id  uuid not null references public.prestataires(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (user_id, prestataire_id)
);

create index on public.prestataire_contacts (prestataire_id);
create index on public.prestataire_contacts (user_id);

alter table public.prestataire_contacts enable row level security;

-- Lecture : admin, ou l'user concerné par sa propre fiche
create policy "prestataire_contacts_select" on public.prestataire_contacts for select
  using (user_id = auth.uid() or public.is_admin());

-- Gestion : admin uniquement
create policy "prestataire_contacts_all_admin" on public.prestataire_contacts for all
  using (public.is_admin());

