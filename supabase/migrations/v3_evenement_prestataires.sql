-- Table de liaison événement ↔ prestataire (indépendante des membres)
create table if not exists public.evenement_prestataires (
  evenement_id    uuid not null references public.evenements(id) on delete cascade,
  prestataire_id  uuid not null references public.prestataires(id) on delete cascade,
  primary key (evenement_id, prestataire_id)
);

alter table public.evenement_prestataires enable row level security;

create policy "ep_all_admin" on public.evenement_prestataires for all
  using (public.is_admin());

create policy "ep_select" on public.evenement_prestataires for select
  using (auth.uid() is not null);

create policy "ep_organisateur" on public.evenement_prestataires for all
  using (public.role_sur_evenement(evenement_id) = 'organisateur');

-- Politique manquante : les organisateurs doivent pouvoir gérer user_evenements
create policy "user_evenements_organisateur" on public.user_evenements for all
  using (public.role_sur_evenement(evenement_id) = 'organisateur');

-- Migration : on backfille les liaisons existantes depuis user_evenements
insert into public.evenement_prestataires (evenement_id, prestataire_id)
select distinct ue.evenement_id, ue.prestataire_id
from public.user_evenements ue
where ue.prestataire_id is not null
on conflict do nothing;
