-- Suivi des anomalies prestataire :
-- anomalie      : flag permanent, passé à true dès la 1ère détection (non_conforme/absent), jamais réinitialisé
-- date_anomalie : horodatage de la 1ère détection, jamais écrasé
-- date_retour_a_verifier : horodatage du 1er passage en "à vérifier" après une anomalie

alter table public.prestations
  add column if not exists anomalie boolean not null default false,
  add column if not exists date_anomalie timestamptz,
  add column if not exists date_retour_a_verifier timestamptz;

-- Fonction de protection : anomalie ne peut jamais repasser à false et date_anomalie ne peut jamais être effacée
create or replace function public.protect_anomalie()
returns trigger language plpgsql as $$
begin
  if old.anomalie = true and new.anomalie = false then
    new.anomalie := true;
  end if;
  if old.date_anomalie is not null and new.date_anomalie is null then
    new.date_anomalie := old.date_anomalie;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_protect_anomalie on public.prestations;
create trigger tg_protect_anomalie
  before update on public.prestations
  for each row execute function public.protect_anomalie();
