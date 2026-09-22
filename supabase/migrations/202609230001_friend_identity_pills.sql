-- Accepted friends can see current identity Pills; public invite previews stay intentionally limited.
create or replace function public.friend_preview(p_user uuid) returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'userId',p.id,
    'code',coalesce(i.short_code,''),
    'person',(
      (l.person_snapshot-'bubble'-'bubbleCreatedAt'-'bubbleExpiresAt'-'owner'-'plotX'-'plotY'-'pills') ||
      jsonb_build_object(
        'id',p.id,
        'nickname',p.nickname,
        'owner',false,
        'plotX',0,
        'plotY',0,
        'pills',case when auth.uid()=p.id or exists(
          select 1 from public.friendships f
          where f.user_a=least(auth.uid(),p.id) and f.user_b=greatest(auth.uid(),p.id)
        ) then coalesce(l.person_snapshot->'pills','[]'::jsonb) else '[]'::jsonb end
      ) ||
      case when b.owner_id is not null and (
        auth.uid()=p.id or exists(
          select 1 from public.friendships f
          where f.user_a=least(auth.uid(),p.id) and f.user_b=greatest(auth.uid(),p.id)
        )
      ) then jsonb_build_object(
        'bubble',b.text,
        'bubbleCreatedAt',extract(epoch from b.created_at)*1000,
        'bubbleExpiresAt',extract(epoch from b.expires_at)*1000
      ) else '{}'::jsonb end
    ),
    'expiresAt',extract(epoch from i.expires_at)*1000
  )
  from public.profiles p
  join public.lands l on l.owner_id=p.id
  left join public.friend_invites i on i.owner_id=p.id
  left join public.bubbles b on b.owner_id=p.id and b.expires_at>now()
  where p.id=p_user
$$;

revoke all on function public.friend_preview(uuid) from public,anon,authenticated;
