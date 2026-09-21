-- Account-owned onboarding data. Existing planes and demo fixtures are not modified.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 18),
  pending_invite jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.character_customizations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  person_snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.lands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  ground text not null check (ground in ('grass','sand','stone','earth')),
  home text not null check (home in ('cottage','studio','cabin','tent','kiosk')),
  house_color text not null default 'coral' check (house_color in ('coral','sage','blue','honey')),
  decoration_preset text not null default 'garden' check (decoration_preset in ('garden','calm','social')),
  person_snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_pills (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pill text not null check (char_length(pill) between 1 and 64),
  primary key (user_id,pill)
);

create table if not exists public.plane_arrangements (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  arrangement jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.invitation_contexts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plane_id text,
  invite_token text,
  status text not null default 'pending' check (status in ('pending','accepted','dismissed')),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.character_customizations enable row level security;
alter table public.lands enable row level security;
alter table public.profile_pills enable row level security;
alter table public.plane_arrangements enable row level security;
alter table public.invitation_contexts enable row level security;

drop policy if exists "owners manage profile" on public.profiles;
create policy "owners manage profile" on public.profiles for all to authenticated using (id=auth.uid()) with check (id=auth.uid());
drop policy if exists "owners manage character" on public.character_customizations;
create policy "owners manage character" on public.character_customizations for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "owners manage land" on public.lands;
create policy "owners manage land" on public.lands for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists "owners manage pills" on public.profile_pills;
create policy "owners manage pills" on public.profile_pills for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "owners manage arrangement" on public.plane_arrangements;
create policy "owners manage arrangement" on public.plane_arrangements for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists "owners manage invitation context" on public.invitation_contexts;
create policy "owners manage invitation context" on public.invitation_contexts for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

grant select,insert,update,delete on public.profiles,public.character_customizations,public.lands,public.profile_pills,public.plane_arrangements,public.invitation_contexts to authenticated;
