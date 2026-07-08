-- Tokens à usage unique pour les actions prestataire par lien email
create table if not exists public.action_tokens (
  id         uuid primary key default gen_random_uuid(),
  prestation_id uuid not null references public.prestations(id) on delete cascade,
  action     text not null default 'a_verifier',
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table public.action_tokens enable row level security;
-- Aucune policy publique : accès exclusivement via service role dans les Edge Functions
