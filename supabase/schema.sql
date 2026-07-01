-- ============================================================
-- SCHEMA SUPABASE — Conformité événementielle
-- Version 2.0 — conformité intégrée dans prestations
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (géré par Supabase Auth + profil étendu)
-- ============================================================
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  nom         text not null,
  prenom      text not null,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PRESTATAIRES
-- ============================================================
create table public.prestataires (
  id              uuid primary key default uuid_generate_v4(),
  raison_sociale  text not null,
  email_contact   text,
  telephone       text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- EVENEMENTS
-- statut : 'parametrage' | 'actif' | 'termine'
-- ============================================================
create table public.evenements (
  id          uuid primary key default uuid_generate_v4(),
  nom         text not null,
  date_debut  date not null,
  date_fin    date not null,
  lieu        text,
  statut      text not null default 'parametrage'
                check (statut in ('parametrage', 'actif', 'termine')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- USER_EVENEMENTS
-- role_local : 'organisateur' | 'controleur' | 'prestataire'
-- prestataire_id : null sauf pour role_local = 'prestataire'
-- ============================================================
create table public.user_evenements (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  evenement_id    uuid not null references public.evenements(id) on delete cascade,
  role_local      text not null
                    check (role_local in ('organisateur', 'controleur', 'prestataire')),
  prestataire_id  uuid references public.prestataires(id) on delete set null,
  unique (user_id, evenement_id),
  constraint prestataire_requis check (
    role_local != 'prestataire' or prestataire_id is not null
  )
);

-- ============================================================
-- STANDS
-- ============================================================
create table public.stands (
  id              uuid primary key default uuid_generate_v4(),
  evenement_id    uuid not null references public.evenements(id) on delete cascade,
  numero          text not null,
  nom_exposant    text,
  hall            text,
  surface         numeric,
  angles          int,
  deleted         boolean not null default false
);
-- Numéro unique seulement parmi les stands non supprimés
create unique index stands_numero_not_deleted on public.stands(evenement_id, numero) where not deleted;

-- ============================================================
-- PRESTATIONS
-- La conformité est enregistrée directement sur la prestation.
-- statut_conformite : null = non encore contrôlée
-- ============================================================
create table public.prestations (
  id                  uuid primary key default uuid_generate_v4(),
  stand_id            uuid not null references public.stands(id) on delete cascade,
  prestataire_id      uuid references public.prestataires(id),
  libelle             text not null,
  categorie           text,
  quantite_attendue   int not null default 1 check (quantite_attendue > 0),
  emplacement_prevu   text,
  -- Conformité
  statut_conformite   text check (statut_conformite in ('conforme', 'non_conforme', 'absent', 'a_verifier')),
  quantite_constatee  int check (quantite_constatee >= 0),
  commentaire         text,
  controleur_id       uuid references public.users(id) on delete set null,
  date_controle       timestamptz,
  deleted             boolean not null default false
);

-- ============================================================
-- PHOTOS
-- Liées directement à une prestation (non plus à un contrôle).
-- url_local : chemin fichier sur le device (avant sync)
-- url       : URL Supabase Storage (après sync)
-- ============================================================
create table public.photos (
  id              uuid primary key default uuid_generate_v4(),
  prestation_id   uuid not null references public.prestations(id) on delete cascade,
  url             text,
  url_local       text,
  synced          boolean not null default false,
  prise_le        timestamptz not null default now(),
  constraint url_ou_local check (url is not null or url_local is not null)
);

-- ============================================================
-- NOTIFICATIONS
-- type   : 'non_conformite' | 'rappel'
-- statut : 'en_attente' | 'envoyee' | 'echec'
-- ============================================================
create table public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  prestation_id   uuid not null references public.prestations(id) on delete cascade,
  destinataire_id uuid not null references public.users(id),
  type            text not null
                    check (type in ('non_conformite', 'rappel')),
  statut          text not null default 'en_attente'
                    check (statut in ('en_attente', 'envoyee', 'echec')),
  envoyee_le      timestamptz
);

-- ============================================================
-- INDEX
-- ============================================================
create index on public.user_evenements (user_id);
create index on public.user_evenements (evenement_id);
create index on public.user_evenements (prestataire_id);
create index on public.stands (evenement_id);
create index on public.prestations (stand_id);
create index on public.prestations (prestataire_id);
create index on public.prestations (controleur_id);
create index on public.prestations (statut_conformite);
create index on public.photos (prestation_id);
create index on public.photos (synced) where synced = false;
create index on public.notifications (destinataire_id);
create index on public.notifications (statut) where statut = 'en_attente';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users           enable row level security;
alter table public.prestataires    enable row level security;
alter table public.evenements      enable row level security;
alter table public.user_evenements enable row level security;
alter table public.stands          enable row level security;
alter table public.prestations     enable row level security;
alter table public.photos          enable row level security;
alter table public.notifications   enable row level security;

-- Helper : est-ce que l'user courant est admin ?
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select coalesce(
    (select is_admin from public.users where id = auth.uid()),
    false
  );
$$;

-- Helper : quel est le role_local de l'user sur un événement ?
create or replace function public.role_sur_evenement(p_evenement_id uuid)
returns text language sql security definer as $$
  select role_local
  from public.user_evenements
  where user_id = auth.uid()
    and evenement_id = p_evenement_id
  limit 1;
$$;

-- USERS : chacun voit son propre profil, admin voit tout
create policy "users_select" on public.users for select
  using (id = auth.uid() or public.is_admin());

create policy "users_update" on public.users for update
  using (id = auth.uid() or public.is_admin());

-- EVENEMENTS : visibilité selon statut et rôle
create policy "evenements_select" on public.evenements for select
  using (
    public.is_admin()
    or (
      statut = 'actif'
      and exists (
        select 1 from public.user_evenements
        where user_id = auth.uid() and evenement_id = id
      )
    )
    or (
      statut = 'termine'
      and exists (
        select 1 from public.user_evenements
        where user_id = auth.uid()
          and evenement_id = id
          and role_local in ('organisateur')
      )
    )
  );

create policy "evenements_all_admin" on public.evenements for all
  using (public.is_admin());

-- USER_EVENEMENTS : visible par l'user concerné et les admins
create policy "user_evenements_select" on public.user_evenements for select
  using (user_id = auth.uid() or public.is_admin());

create policy "user_evenements_all_admin" on public.user_evenements for all
  using (public.is_admin());

-- STANDS : visible si accès à l'événement actif
create policy "stands_select" on public.stands for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.user_evenements ue
      join public.evenements e on e.id = ue.evenement_id
      where ue.user_id = auth.uid()
        and ue.evenement_id = stands.evenement_id
        and e.statut in ('actif', 'termine')
    )
  );

create policy "stands_all_admin" on public.stands for all
  using (public.is_admin());

-- PRESTATIONS : idem stands
create policy "prestations_select" on public.prestations for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.stands s
      join public.user_evenements ue on ue.evenement_id = s.evenement_id
      join public.evenements e on e.id = s.evenement_id
      where s.id = prestations.stand_id
        and ue.user_id = auth.uid()
        and e.statut in ('actif', 'termine')
    )
  );

-- Contrôleurs peuvent mettre à jour la conformité
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

create policy "prestations_all_admin" on public.prestations for all
  using (public.is_admin());

-- PHOTOS : liées à une prestation
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

-- NOTIFICATIONS
create policy "notifications_select" on public.notifications for select
  using (destinataire_id = auth.uid() or public.is_admin());

-- PRESTATAIRES : visibles par tous les users authentifiés, gérés par admin
create policy "prestataires_select" on public.prestataires for select
  using (auth.uid() is not null);

create policy "prestataires_all_admin" on public.prestataires for all
  using (public.is_admin());

-- ============================================================
-- TRIGGER : création automatique du profil user après signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, nom, prenom)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
