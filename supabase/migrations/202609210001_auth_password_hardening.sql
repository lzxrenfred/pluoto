-- Password authentication is managed by Supabase Auth and requires no app-table password columns.
-- Tighten function privileges from the friend migration: PostgreSQL grants function
-- execution to PUBLIC by default, including for SECURITY DEFINER helpers.

revoke all on function public.new_friend_code() from public, anon, authenticated;
revoke all on function public.ensure_friend_invite(uuid) from public, anon, authenticated;
revoke all on function public.friend_preview(uuid) from public, anon, authenticated;
revoke all on function public.assert_friendable(uuid,uuid) from public, anon, authenticated;

revoke all on function public.preview_friend_invite(text) from public, anon, authenticated;
revoke all on function public.friend_state() from public, anon, authenticated;
revoke all on function public.send_friend_request(text) from public, anon, authenticated;
revoke all on function public.accept_friend_request(uuid) from public, anon, authenticated;
revoke all on function public.decline_friend_request(uuid) from public, anon, authenticated;
revoke all on function public.accept_personal_invite(uuid) from public, anon, authenticated;
revoke all on function public.regenerate_friend_invite() from public, anon, authenticated;
revoke all on function public.set_friend_placement(uuid,integer,integer,boolean) from public, anon, authenticated;
revoke all on function public.remove_friend(uuid) from public, anon, authenticated;
revoke all on function public.block_user(uuid) from public, anon, authenticated;

-- A valid personal token or short code may be previewed before authentication.
grant execute on function public.preview_friend_invite(text) to anon, authenticated;

-- All state and mutation RPCs require an authenticated Supabase user. Their bodies
-- additionally bind reads and writes to auth.uid().
grant execute on function public.friend_state() to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.decline_friend_request(uuid) to authenticated;
grant execute on function public.accept_personal_invite(uuid) to authenticated;
grant execute on function public.regenerate_friend_invite() to authenticated;
grant execute on function public.set_friend_placement(uuid,integer,integer,boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;

-- Explicitly keep history and block data private even if table grants are expanded later.
revoke all on table public.friend_invite_history from anon, authenticated;
revoke all on table public.user_blocks from anon;
