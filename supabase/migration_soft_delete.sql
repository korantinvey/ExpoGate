-- Soft delete sur stands et prestations
alter table public.stands add column if not exists deleted boolean not null default false;
alter table public.prestations add column if not exists deleted boolean not null default false;

-- Remplace la contrainte unique inline par un index partiel (numéro libre si stand supprimé)
alter table public.stands drop constraint if exists stands_evenement_id_numero_key;
create unique index if not exists stands_numero_not_deleted on public.stands(evenement_id, numero) where not deleted;
