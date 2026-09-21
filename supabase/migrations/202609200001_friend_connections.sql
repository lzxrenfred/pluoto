-- Canonical friend requests, mutual friendships, private per-user placement and blocks.
create extension if not exists pgcrypto;
alter table public.invitation_contexts add column if not exists friend_invite_token text;

create table if not exists public.friend_invites (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  short_code text not null unique,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default (now()+interval '90 days'),
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.friend_invite_history (
  token uuid primary key,
  short_code text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check(reason in('expired','revoked')),
  recorded_at timestamptz not null default now()
);
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check(sender_id<>recipient_id)
);
create unique index if not exists friend_requests_one_pending_pair on public.friend_requests(least(sender_id,recipient_id),greatest(sender_id,recipient_id)) where status='pending';
create table if not exists public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_a,user_b),
  check(user_a<user_b)
);
create table if not exists public.plane_land_placements (
  plane_owner_id uuid not null references public.profiles(id) on delete cascade,
  land_owner_id uuid not null references public.profiles(id) on delete cascade,
  plot_x integer not null,
  plot_y integer not null,
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(plane_owner_id,land_owner_id),
  check(plane_owner_id<>land_owner_id)
);
create unique index if not exists plane_land_placements_open_slot on public.plane_land_placements(plane_owner_id,plot_x,plot_y) where hidden=false;
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id<>blocked_id)
);

alter table public.friend_invites enable row level security;
alter table public.friend_invite_history enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.plane_land_placements enable row level security;
alter table public.user_blocks enable row level security;

create policy "owner reads own invite" on public.friend_invites for select to authenticated using(owner_id=auth.uid());
create policy "parties read requests" on public.friend_requests for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid());
create policy "parties read friendship" on public.friendships for select to authenticated using(user_a=auth.uid() or user_b=auth.uid());
create policy "owner reads own placement" on public.plane_land_placements for select to authenticated using(plane_owner_id=auth.uid());
create policy "blocker reads own blocks" on public.user_blocks for select to authenticated using(blocker_id=auth.uid());
create policy "friends read current land" on public.lands for select to authenticated using(owner_id=auth.uid() or exists(select 1 from public.friendships f where (f.user_a=auth.uid() and f.user_b=lands.owner_id) or (f.user_b=auth.uid() and f.user_a=lands.owner_id)));

revoke insert,update,delete on public.friend_invites,public.friend_requests,public.friendships,public.plane_land_placements,public.user_blocks from authenticated;
grant select on public.friend_invites,public.friend_requests,public.friendships,public.plane_land_placements,public.user_blocks to authenticated;

create or replace function public.new_friend_code() returns text language plpgsql volatile security definer set search_path=public as $$
declare raw text; formatted text;
begin
  for attempt in 1..64 loop
    raw:=upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
    formatted:=substr(raw,1,4)||'-'||substr(raw,5,4);
    if not exists(select 1 from public.friend_invites where short_code=formatted) and not exists(select 1 from public.friend_invite_history where short_code=formatted) then return formatted; end if;
  end loop;
  raise exception 'Unable to allocate friend code';
end $$;

create or replace function public.ensure_friend_invite(p_owner uuid) returns public.friend_invites language plpgsql security definer set search_path=public as $$
declare result public.friend_invites;
begin
  select * into result from public.friend_invites where owner_id=p_owner and revoked_at is null and expires_at>now();
  if result.owner_id is null then
    insert into public.friend_invite_history(token,short_code,owner_id,reason) select token,short_code,owner_id,case when revoked_at is null then 'expired' else 'revoked' end from public.friend_invites where owner_id=p_owner on conflict(token) do nothing;
    insert into public.friend_invites(owner_id,short_code) values(p_owner,public.new_friend_code())
    on conflict(owner_id) do update set short_code=public.new_friend_code(),token=gen_random_uuid(),expires_at=now()+interval '90 days',revoked_at=null,updated_at=now()
    returning * into result;
  end if;
  return result;
end $$;

create or replace function public.friend_preview(p_user uuid) returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('userId',p.id,'code',coalesce(i.short_code,''),'person',((l.person_snapshot-'bubble'-'bubbleCreatedAt'-'owner'-'plotX'-'plotY'-'pills')||jsonb_build_object('id',p.id,'nickname',p.nickname,'owner',false,'plotX',0,'plotY',0,'pills','[]'::jsonb)),'expiresAt',extract(epoch from i.expires_at)*1000)
  from public.profiles p join public.lands l on l.owner_id=p.id left join public.friend_invites i on i.owner_id=p.id where p.id=p_user
$$;

create or replace function public.preview_friend_invite(p_value text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare invite public.friend_invites; old_reason text; normalized text:=upper(regexp_replace(trim(p_value),'[^A-Z0-9]','','g'));
begin
  select * into invite from public.friend_invites where token::text=p_value or replace(short_code,'-','')=normalized;
  if invite.owner_id is null then select reason into old_reason from public.friend_invite_history where token::text=p_value or replace(short_code,'-','')=normalized order by recorded_at desc limit 1;if old_reason='revoked' then raise exception 'REVOKED';elsif old_reason='expired' then raise exception 'EXPIRED';else raise exception 'INVALID_CODE';end if;end if;
  if invite.revoked_at is not null then raise exception 'REVOKED'; end if;
  if invite.expires_at<=now() then raise exception 'EXPIRED'; end if;
  return public.friend_preview(invite.owner_id);
end $$;

create or replace function public.assert_friendable(p_a uuid,p_b uuid) returns void language plpgsql stable security definer set search_path=public as $$
begin
  if p_a=p_b then raise exception 'SELF_INVITE'; end if;
  if exists(select 1 from public.user_blocks where (blocker_id=p_a and blocked_id=p_b) or (blocker_id=p_b and blocked_id=p_a)) then raise exception 'BLOCKED'; end if;
end $$;

create or replace function public.send_friend_request(p_code text) returns uuid language plpgsql security definer set search_path=public as $$
declare target uuid; result uuid; normalized text:=upper(regexp_replace(trim(p_code),'[^A-Z0-9]','','g'));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select owner_id into target from public.friend_invites where replace(short_code,'-','')=normalized and revoked_at is null and expires_at>now();
  if target is null then raise exception 'INVALID_CODE'; end if;
  perform public.assert_friendable(auth.uid(),target);
  if exists(select 1 from public.friendships where user_a=least(auth.uid(),target) and user_b=greatest(auth.uid(),target)) then raise exception 'ALREADY_FRIENDS'; end if;
  if exists(select 1 from public.friend_requests where status='pending' and least(sender_id,recipient_id)=least(auth.uid(),target) and greatest(sender_id,recipient_id)=greatest(auth.uid(),target)) then raise exception 'PENDING'; end if;
  insert into public.friend_requests(sender_id,recipient_id) values(auth.uid(),target) returning id into result;return result;
end $$;

create or replace function public.accept_friend_request(p_request_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare request public.friend_requests;
begin
  select * into request from public.friend_requests where id=p_request_id for update;
  if request.id is null or request.recipient_id<>auth.uid() then raise exception 'NOT_FOUND'; end if;
  perform public.assert_friendable(request.sender_id,request.recipient_id);
  insert into public.friendships(user_a,user_b) values(least(request.sender_id,request.recipient_id),greatest(request.sender_id,request.recipient_id)) on conflict do nothing;
  update public.friend_requests set status='accepted',responded_at=now() where id=p_request_id and status='pending';
end $$;
create or replace function public.decline_friend_request(p_request_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin update public.friend_requests set status='declined',responded_at=now() where id=p_request_id and recipient_id=auth.uid() and status='pending';if not found then raise exception 'NOT_FOUND';end if;end $$;

create or replace function public.accept_personal_invite(p_token uuid) returns void language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
  select owner_id into target from public.friend_invites where token=p_token and revoked_at is null and expires_at>now();if target is null then raise exception 'INVALID_INVITE';end if;
  perform public.assert_friendable(auth.uid(),target);
  insert into public.friendships(user_a,user_b) values(least(auth.uid(),target),greatest(auth.uid(),target)) on conflict do nothing;
  update public.friend_requests set status='accepted',responded_at=now() where status='pending' and least(sender_id,recipient_id)=least(auth.uid(),target) and greatest(sender_id,recipient_id)=greatest(auth.uid(),target);
end $$;

create or replace function public.regenerate_friend_invite() returns jsonb language plpgsql security definer set search_path=public as $$
declare invite public.friend_invites;
begin
  insert into public.friend_invite_history(token,short_code,owner_id,reason) select token,short_code,owner_id,'revoked' from public.friend_invites where owner_id=auth.uid() on conflict(token) do nothing;
  update public.friend_invites set short_code=public.new_friend_code(),token=gen_random_uuid(),expires_at=now()+interval '90 days',revoked_at=null,updated_at=now() where owner_id=auth.uid() returning * into invite;
  if invite.owner_id is null then insert into public.friend_invites(owner_id,short_code) values(auth.uid(),public.new_friend_code()) returning * into invite;end if;
  return jsonb_build_object('code',invite.short_code,'token',invite.token);
end $$;

create or replace function public.set_friend_placement(p_friend_id uuid,p_plot_x integer,p_plot_y integer,p_hidden boolean default false) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.friendships where user_a=least(auth.uid(),p_friend_id) and user_b=greatest(auth.uid(),p_friend_id)) then raise exception 'NOT_FRIENDS';end if;
  if p_plot_x is null or p_plot_y is null then delete from public.plane_land_placements where plane_owner_id=auth.uid() and land_owner_id=p_friend_id;
  else
    if not p_hidden and exists(select 1 from public.plane_arrangements a cross join lateral jsonb_array_elements(a.arrangement) item where a.owner_id=auth.uid() and item->>'personId'<>p_friend_id::text and (item->>'plotX')::integer=p_plot_x and (item->>'plotY')::integer=p_plot_y) then raise exception 'OCCUPIED';end if;
    begin
      insert into public.plane_land_placements(plane_owner_id,land_owner_id,plot_x,plot_y,hidden) values(auth.uid(),p_friend_id,p_plot_x,p_plot_y,p_hidden) on conflict(plane_owner_id,land_owner_id) do update set plot_x=excluded.plot_x,plot_y=excluded.plot_y,hidden=excluded.hidden,updated_at=now();
    exception when unique_violation then raise exception 'OCCUPIED';end;
  end if;
end $$;
create or replace function public.remove_friend(p_friend_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin delete from public.friendships where user_a=least(auth.uid(),p_friend_id) and user_b=greatest(auth.uid(),p_friend_id);delete from public.plane_land_placements where (plane_owner_id=auth.uid() and land_owner_id=p_friend_id) or (plane_owner_id=p_friend_id and land_owner_id=auth.uid());end $$;
create or replace function public.block_user(p_user_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin if p_user_id=auth.uid() then raise exception 'SELF_BLOCK';end if;insert into public.user_blocks(blocker_id,blocked_id) values(auth.uid(),p_user_id) on conflict do nothing;perform public.remove_friend(p_user_id);delete from public.friend_requests where least(sender_id,recipient_id)=least(auth.uid(),p_user_id) and greatest(sender_id,recipient_id)=greatest(auth.uid(),p_user_id);end $$;

create or replace function public.friend_state() returns jsonb language plpgsql security definer set search_path=public as $$
declare invite public.friend_invites;incoming jsonb;outgoing jsonb;friends jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;invite:=public.ensure_friend_invite(auth.uid());
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'from',public.friend_preview(r.sender_id),'to',public.friend_preview(r.recipient_id),'status',r.status,'createdAt',extract(epoch from r.created_at)*1000)),'[]') into incoming from public.friend_requests r where r.recipient_id=auth.uid() and r.status='pending';
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'from',public.friend_preview(r.sender_id),'to',public.friend_preview(r.recipient_id),'status',r.status,'createdAt',extract(epoch from r.created_at)*1000)),'[]') into outgoing from public.friend_requests r where r.sender_id=auth.uid() and r.status='pending';
  select coalesce(jsonb_agg(jsonb_build_object('preview',public.friend_preview(case when f.user_a=auth.uid() then f.user_b else f.user_a end),'placement',case when p.land_owner_id is null then null else jsonb_build_object('plotX',p.plot_x,'plotY',p.plot_y,'hidden',p.hidden) end)),'[]') into friends from public.friendships f left join public.plane_land_placements p on p.plane_owner_id=auth.uid() and p.land_owner_id=case when f.user_a=auth.uid() then f.user_b else f.user_a end where f.user_a=auth.uid() or f.user_b=auth.uid();
  return jsonb_build_object('invite',jsonb_build_object('code',invite.short_code,'token',invite.token),'incoming',incoming,'outgoing',outgoing,'friends',friends);
end $$;

revoke all on function public.preview_friend_invite(text) from public;
grant execute on function public.preview_friend_invite(text) to anon,authenticated;
grant execute on function public.friend_state(),public.send_friend_request(text),public.accept_friend_request(uuid),public.decline_friend_request(uuid),public.accept_personal_invite(uuid),public.regenerate_friend_invite(),public.set_friend_placement(uuid,integer,integer,boolean),public.remove_friend(uuid),public.block_user(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.friend_requests;
exception when duplicate_object then null;end $$;
do $$ begin alter publication supabase_realtime add table public.friendships;exception when duplicate_object then null;end $$;
do $$ begin alter publication supabase_realtime add table public.plane_land_placements;exception when duplicate_object then null;end $$;
do $$ begin alter publication supabase_realtime add table public.user_blocks;exception when duplicate_object then null;end $$;
