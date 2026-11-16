-- Abonnements Léger : un profil par compte, mis à jour uniquement par le serveur (webhook Stripe).
create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  trial_ends_at        timestamptz not null default (now() + interval '7 days'),
  stripe_customer_id   text unique,
  sub_status           text,         -- active, trialing, past_due, canceled, incomplete…
  sub_plan             text,         -- monthly | yearly
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Chaque utilisateur peut lire SA ligne. Aucune règle d'écriture : seule la clé service (fonctions serveur) écrit.
drop policy if exists "Lecture de son profil" on public.profiles;
create policy "Lecture de son profil" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- Création automatique du profil (et donc de l'essai gratuit de 7 jours) à l'inscription.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();
