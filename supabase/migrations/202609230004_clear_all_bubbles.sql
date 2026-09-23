create or replace function public.clear_all_bubbles() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.bubble_archive where owner_id=auth.uid();
  return public.bubble_state();
end $$;

revoke all on function public.clear_all_bubbles() from public,anon,authenticated;
grant execute on function public.clear_all_bubbles() to authenticated;
