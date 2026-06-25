-- ============================================================
-- Migration v2 : conformité intégrée dans prestations
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- 1. Supprimer les tables dépendantes EN PREMIER
--    (notifications et photos sont liées à controles via FK)
drop table if exists public.notifications cascade;
drop table if exists public.photos cascade;
drop table if exists public.controles cascade;

-- 2. Ajout des colonnes de conformité sur prestations
alter table public.prestations
  add column if not exists statut_conformite  text check (statut_conformite in ('conforme', 'non_conforme', 'absent', 'a_verifier')),
  add column if not exists quantite_constatee int check (quantite_constatee >= 0),
  add column if not exists commentaire        text,
  add column if not exists controleur_id      uuid references public.users(id) on delete set null,
  add column if not exists date_controle      timestamptz;

create index if not exists prestations_statut_conformite_idx on public.prestations (statut_conformite);
create index if not exists prestations_controleur_id_idx on public.prestations (controleur_id);

-- 3. Recréer photos liée à prestation
create table public.photos (
  id              uuid primary key default uuid_generate_v4(),
  prestation_id   uuid not null references public.prestations(id) on delete cascade,
  url             text,
  url_local       text,
  synced          boolean not null default false,
  prise_le        timestamptz not null default now(),
  constraint url_ou_local check (url is not null or url_local is not null)
);

create index on public.photos (prestation_id);
create index on public.photos (synced) where synced = false;

alter table public.photos enable row level security;

create policy "photos_select" on public.photos for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.prestations p
      join public.stands s on s.id = p.stand_id
      join public.user_evenements ue on ue.evenement_id = s.evenement_id
      where p.id = photos.prestation_id
        and ue.user_id = auth.uid()
    )
  );

create policy "photos_insert" on public.photos for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.prestations p
      join public.stands s on s.id = p.stand_id
      join public.user_evenements ue on ue.evenement_id = s.evenement_id
      where p.id = prestation_id
        and ue.user_id = auth.uid()
        and ue.role_local in ('controleur', 'organisateur')
    )
  );

create policy "photos_all_admin" on public.photos for all
  using (public.is_admin());

-- 4. Politique update sur prestations pour les contrôleurs
drop policy if exists "prestations_update_conformite" on public.prestations;
create policy "prestations_update_conformite" on public.prestations for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.stands s
      join public.user_evenements ue on ue.evenement_id = s.evenement_id
      where s.id = prestations.stand_id
        and ue.user_id = auth.uid()
        and ue.role_local in ('controleur', 'organisateur')
    )
  );

-- 5. Recréer notifications liée à prestation
create table public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  prestation_id   uuid not null references public.prestations(id) on delete cascade,
  destinataire_id uuid not null references public.users(id),
  type            text not null check (type in ('non_conformite', 'rappel')),
  statut          text not null default 'en_attente' check (statut in ('en_attente', 'envoyee', 'echec')),
  envoyee_le      timestamptz
);

create index on public.notifications (destinataire_id);
create index on public.notifications (statut) where statut = 'en_attente';

alter table public.notifications enable row level security;

create policy "notifications_select" on public.notifications for select
  using (destinataire_id = auth.uid() or public.is_admin());
