-- Tokens à usage unique pour les actions depuis email (ex: passer une prestation en "à vérifier")
create table public.email_action_tokens (
  id            uuid primary key default uuid_generate_v4(),
  prestation_id uuid not null references public.prestations(id) on delete cascade,
  action        text not null check (action in ('a_verifier')),
  used          boolean not null default false,
  expires_at    timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz not null default now()
);

create index on public.email_action_tokens (prestation_id);
create index on public.email_action_tokens (used, expires_at);

-- Pas de RLS : accès uniquement via service_role dans les Edge Functions
alter table public.email_action_tokens enable row level security;
