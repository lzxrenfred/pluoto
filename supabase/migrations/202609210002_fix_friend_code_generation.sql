-- Supabase installs pgcrypto in the extensions schema. Qualify the function so
-- the deliberately narrow SECURITY DEFINER search_path remains intact.
create or replace function public.new_friend_code() returns text
language plpgsql
volatile
security definer
set search_path=public
as $$
declare raw text; formatted text;
begin
  for attempt in 1..64 loop
    raw:=upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,8));
    formatted:=substr(raw,1,4)||'-'||substr(raw,5,4);
    if not exists(select 1 from public.friend_invites where short_code=formatted)
       and not exists(select 1 from public.friend_invite_history where short_code=formatted)
    then
      return formatted;
    end if;
  end loop;
  raise exception 'Unable to allocate friend code';
end
$$;

revoke all on function public.new_friend_code() from public, anon, authenticated;
