-- Compteur quotidien des analyses de photos par IA (limite les coûts par utilisateur).
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default current_date,
  count   integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- Aucune règle : seules les fonctions serveur (clé service) lisent et écrivent cette table.

-- Incrémente le compteur du jour et renvoie la nouvelle valeur (atomique).
create or replace function public.increment_ai_usage(p_user uuid)
returns integer language sql security definer set search_path = public as $$
  insert into public.ai_usage (user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count;
$$;
revoke all on function public.increment_ai_usage(uuid) from public, anon, authenticated;
