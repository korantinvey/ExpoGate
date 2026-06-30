-- ============================================================
-- MIGRATION : table main_courante + photos
-- À exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- Table principale
create table public.main_courante (
  id           uuid primary key default uuid_generate_v4(),
  evenement_id uuid not null references public.evenements(id) on delete cascade,
  stand_id     uuid references public.stands(id) on delete set null,
  titre        text not null,
  descriptif   text,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.users(id) on delete set null
);

create index on public.main_courante (evenement_id);
create index on public.main_courante (stand_id);
create index on public.main_courante (created_at desc);

alter table public.main_courante enable row level security;

-- Lecture : organisateurs et contrôleurs (pas les prestataires)
create policy "mc_select" on public.main_courante for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.user_evenements ue
      where ue.user_id = auth.uid()
        and ue.evenement_id = main_courante.evenement_id
        and ue.role_local in ('organisateur', 'controleur')
    )
  );

-- Création : organisateurs et contrôleurs
create policy "mc_insert" on public.main_courante for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.user_evenements ue
      where ue.user_id = auth.uid()
        and ue.evenement_id = main_courante.evenement_id
        and ue.role_local in ('organisateur', 'controleur')
    )
  );

-- Modification : créateur ou organisateur de l'événement
create policy "mc_update" on public.main_courante for update
  using (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.user_evenements ue
      where ue.user_id = auth.uid()
        and ue.evenement_id = main_courante.evenement_id
        and ue.role_local = 'organisateur'
    )
  );

-- Suppression : créateur ou organisateur
create policy "mc_delete" on public.main_courante for delete
  using (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.user_evenements ue
      where ue.user_id = auth.uid()
        and ue.evenement_id = main_courante.evenement_id
        and ue.role_local = 'organisateur'
    )
  );

-- Table photos liées
create table public.main_courante_photos (
  id               uuid primary key default uuid_generate_v4(),
  main_courante_id uuid not null references public.main_courante(id) on delete cascade,
  url              text not null,
  created_at       timestamptz not null default now()
);

create index on public.main_courante_photos (main_courante_id);

alter table public.main_courante_photos enable row level security;

create policy "mc_photos_select" on public.main_courante_photos for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.main_courante mc
      join public.user_evenements ue on ue.evenement_id = mc.evenement_id
      where mc.id = main_courante_photos.main_courante_id
        and ue.user_id = auth.uid()
        and ue.role_local in ('organisateur', 'controleur')
    )
  );

create policy "mc_photos_insert" on public.main_courante_photos for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.main_courante mc
      join public.user_evenements ue on ue.evenement_id = mc.evenement_id
      where mc.id = main_courante_id
        and ue.user_id = auth.uid()
        and ue.role_local in ('organisateur', 'controleur')
    )
  );

create policy "mc_photos_delete" on public.main_courante_photos for delete
  using (
    public.is_admin()
    or exists (
      select 1 from public.main_courante mc
      join public.user_evenements ue on ue.evenement_id = mc.evenement_id
      where mc.id = main_courante_photos.main_courante_id
        and ue.user_id = auth.uid()
        and ue.role_local in ('organisateur', 'controleur')
    )
  );
