-- Minimal private-preview schema. Enable Anonymous Sign-Ins in Auth first.
create table if not exists public.planes (
  id uuid primary key,
  invite_token uuid not null unique,
  state jsonb not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists public.plane_members (
  plane_id uuid not null references public.planes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (plane_id,user_id)
);

alter table public.planes enable row level security;
alter table public.plane_members enable row level security;

create policy "members can read their planes" on public.planes
  for select to authenticated using (
    exists (select 1 from public.plane_members where plane_id=planes.id and user_id=auth.uid())
  );
create policy "members can update their planes" on public.planes
  for update to authenticated using (
    exists (select 1 from public.plane_members where plane_id=planes.id and user_id=auth.uid())
  ) with check (
    exists (select 1 from public.plane_members where plane_id=planes.id and user_id=auth.uid())
  );
create policy "members can see their membership" on public.plane_members
  for select to authenticated using (user_id=auth.uid());

create or replace function public.join_plane(p_plane_id uuid,p_invite_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then return false; end if;
  insert into public.plane_members(plane_id,user_id)
    select id,auth.uid() from public.planes where id=p_plane_id and invite_token=p_invite_token
    on conflict do nothing;
  return exists(select 1 from public.plane_members where plane_id=p_plane_id and user_id=auth.uid());
end;
$$;

create or replace function public.save_plane(p_plane_id uuid,p_invite_token uuid,p_state jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Anonymous identity required'; end if;
  if not exists(select 1 from public.planes where id=p_plane_id) then
    insert into public.planes(id,invite_token,state,created_by) values(p_plane_id,p_invite_token,p_state,auth.uid());
    insert into public.plane_members(plane_id,user_id) values(p_plane_id,auth.uid());
  else
    perform public.join_plane(p_plane_id,p_invite_token);
    if not exists(select 1 from public.plane_members where plane_id=p_plane_id and user_id=auth.uid()) then raise exception 'Invalid Plane invite'; end if;
    update public.planes set state=p_state,updated_at=now() where id=p_plane_id;
  end if;
end;
$$;

revoke all on function public.join_plane(uuid,uuid) from public;
revoke all on function public.save_plane(uuid,uuid,jsonb) from public;
grant execute on function public.join_plane(uuid,uuid) to authenticated;
grant execute on function public.save_plane(uuid,uuid,jsonb) to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='planes') then
    alter publication supabase_realtime add table public.planes;
  end if;
end $$;
