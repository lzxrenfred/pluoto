-- Active Bubbles are friend-visible; history is private to its owner.
create table if not exists public.bubbles (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 80),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.bubble_archive (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 80),
  created_at timestamptz not null,
  archived_at timestamptz not null default now(),
  reason text not null check (reason in ('replaced','cleared','expired'))
);
create index if not exists bubble_archive_owner_time on public.bubble_archive(owner_id, archived_at desc);

alter table public.bubbles enable row level security;
alter table public.bubble_archive enable row level security;
drop policy if exists "owners and friends read active bubbles" on public.bubbles;
create policy "owners and friends read active bubbles" on public.bubbles for select to authenticated using (
  expires_at > now() and (
    owner_id = auth.uid() or exists (
      select 1 from public.friendships f
      where f.user_a = least(auth.uid(), owner_id) and f.user_b = greatest(auth.uid(), owner_id)
    )
  )
);
drop policy if exists "owners read bubble archive" on public.bubble_archive;
create policy "owners read bubble archive" on public.bubble_archive for select to authenticated using (owner_id = auth.uid());
revoke all on public.bubbles, public.bubble_archive from anon;
revoke insert, update, delete on public.bubbles, public.bubble_archive from authenticated;
grant select on public.bubbles, public.bubble_archive to authenticated;

create or replace function public.archive_expired_bubbles(p_owner uuid default null) returns void
language plpgsql security definer set search_path=public as $$
begin
  insert into public.bubble_archive(owner_id,text,created_at,archived_at,reason)
  select owner_id,text,created_at,expires_at,'expired' from public.bubbles
  where expires_at <= now() and (p_owner is null or owner_id=p_owner);
  delete from public.bubbles where expires_at <= now() and (p_owner is null or owner_id=p_owner);
end $$;

create or replace function public.bubble_state() returns jsonb
language plpgsql security definer set search_path=public as $$
declare active jsonb; history jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public.archive_expired_bubbles(auth.uid());
  select jsonb_build_object('text',b.text,'createdAt',extract(epoch from b.created_at)*1000,'expiresAt',extract(epoch from b.expires_at)*1000)
    into active from public.bubbles b where b.owner_id=auth.uid();
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'text',a.text,'createdAt',extract(epoch from a.created_at)*1000,'expiredAt',extract(epoch from a.archived_at)*1000,'reason',a.reason) order by a.archived_at desc),'[]'::jsonb)
    into history from public.bubble_archive a where a.owner_id=auth.uid();
  return jsonb_build_object('active',active,'archive',history);
end $$;

create or replace function public.publish_bubble(p_text text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare clean text:=btrim(p_text); existing public.bubbles;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(clean)<1 or char_length(clean)>80 then raise exception 'INVALID_BUBBLE'; end if;
  perform public.archive_expired_bubbles(auth.uid());
  select * into existing from public.bubbles where owner_id=auth.uid() for update;
  if existing.owner_id is not null then
    insert into public.bubble_archive(owner_id,text,created_at,reason) values(existing.owner_id,existing.text,existing.created_at,'replaced');
  end if;
  insert into public.bubbles(owner_id,text,created_at,expires_at,updated_at)
    values(auth.uid(),clean,now(),now()+interval '24 hours',now())
    on conflict(owner_id) do update set text=excluded.text,created_at=excluded.created_at,expires_at=excluded.expires_at,updated_at=excluded.updated_at;
  return public.bubble_state();
end $$;

create or replace function public.clear_bubble() returns jsonb
language plpgsql security definer set search_path=public as $$
declare existing public.bubbles;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public.archive_expired_bubbles(auth.uid());
  select * into existing from public.bubbles where owner_id=auth.uid() for update;
  if existing.owner_id is not null then
    insert into public.bubble_archive(owner_id,text,created_at,reason) values(existing.owner_id,existing.text,existing.created_at,'cleared');
    delete from public.bubbles where owner_id=auth.uid();
  end if;
  return public.bubble_state();
end $$;

-- A personal link stays a limited preview. Active Bubble text is visible only to the owner or an accepted friend.
create or replace function public.friend_preview(p_user uuid) returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'userId',p.id,
    'code',coalesce(i.short_code,''),
    'person',(
      (l.person_snapshot-'bubble'-'bubbleCreatedAt'-'bubbleExpiresAt'-'owner'-'plotX'-'plotY'-'pills') ||
      jsonb_build_object('id',p.id,'nickname',p.nickname,'owner',false,'plotX',0,'plotY',0,'pills','[]'::jsonb) ||
      case when b.owner_id is not null and (
        auth.uid()=p.id or exists(select 1 from public.friendships f where f.user_a=least(auth.uid(),p.id) and f.user_b=greatest(auth.uid(),p.id))
      ) then jsonb_build_object('bubble',b.text,'bubbleCreatedAt',extract(epoch from b.created_at)*1000,'bubbleExpiresAt',extract(epoch from b.expires_at)*1000)
      else '{}'::jsonb end
    ),
    'expiresAt',extract(epoch from i.expires_at)*1000
  )
  from public.profiles p join public.lands l on l.owner_id=p.id
  left join public.friend_invites i on i.owner_id=p.id
  left join public.bubbles b on b.owner_id=p.id and b.expires_at>now()
  where p.id=p_user
$$;

-- Remove only the exact historical fixture IDs from saved arrangements; real UUID users with these names are untouched.
update public.plane_arrangements a set arrangement=(
  select coalesce(jsonb_agg(item),'[]'::jsonb) from jsonb_array_elements(a.arrangement) item
  where item->>'personId' not in ('sarah','maya','wei')
) where exists(select 1 from jsonb_array_elements(a.arrangement) item where item->>'personId' in ('sarah','maya','wei'));

revoke all on function public.archive_expired_bubbles(uuid),public.bubble_state(),public.publish_bubble(text),public.clear_bubble() from public,anon,authenticated;
grant execute on function public.bubble_state(),public.publish_bubble(text),public.clear_bubble() to authenticated;

do $$ begin alter publication supabase_realtime add table public.bubbles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.bubble_archive; exception when duplicate_object then null; end $$;
