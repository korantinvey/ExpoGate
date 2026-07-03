-- ============================================================
-- Migration v4 : tables messages (in-app) et push_subscriptions
-- ============================================================

-- Table des notifications in-app par utilisateur
create table if not exists public.messages (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  body        text,
  lu          boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists messages_user_id_idx on public.messages (user_id);
create index if not exists messages_created_at_idx on public.messages (created_at desc);

alter table public.messages enable row level security;

-- Chaque utilisateur ne voit que ses propres messages
create policy "messages_select_own" on public.messages for select
  using (user_id = auth.uid());

-- Seul le service role peut insérer (via Edge Function)
create policy "messages_insert_service" on public.messages for insert
  with check (false);

-- L'utilisateur peut marquer ses messages comme lus
create policy "messages_update_own" on public.messages for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admins : accès total
create policy "messages_all_admin" on public.messages for all
  using (public.is_admin());

-- ──────────────────────────────────────────────────────────

-- Table des abonnements push Web (une ligne par appareil/navigateur)
create table if not exists public.push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Chaque utilisateur gère ses propres abonnements
create policy "push_select_own" on public.push_subscriptions for select
  using (user_id = auth.uid());

create policy "push_insert_own" on public.push_subscriptions for insert
  with check (user_id = auth.uid());

create policy "push_update_own" on public.push_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "push_delete_own" on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- Admins : accès total
create policy "push_all_admin" on public.push_subscriptions for all
  using (public.is_admin());
