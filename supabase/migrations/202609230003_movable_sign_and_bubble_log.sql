alter table public.lands drop constraint if exists lands_ground_check;
alter table public.lands add constraint lands_ground_check check (ground in ('grass','sand','stone','earth','meadow','clay'));
alter table public.lands drop constraint if exists lands_house_color_check;
alter table public.lands add constraint lands_house_color_check check (house_color in ('coral','sage','blue','honey','rose','mint'));
alter table public.lands drop constraint if exists lands_decoration_preset_check;
alter table public.lands add constraint lands_decoration_preset_check check (decoration_preset in ('garden','calm','social','bare','custom'));

create or replace function public.valid_land_object_layout(snapshot jsonb)
returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  objects jsonb := snapshot -> 'landObjects';
  item jsonb;
  cell_x integer;
  cell_y integer;
  dx integer;
  dy integer;
  width integer;
  height integer;
  rotation integer;
  sign_x integer := coalesce((snapshot #>> '{signPosition,tileX}')::integer, 4);
  sign_y integer := coalesce((snapshot #>> '{signPosition,tileY}')::integer, 4);
  occupied text[];
  seen_ids text[] := array[]::text[];
  model text;
  homes integer := 0;
begin
  if sign_x not between 0 and 4 or sign_y not between 0 and 4 then return false; end if;
  occupied := array[sign_x::text || ',' || sign_y::text];
  if objects is null then return true; end if;
  if jsonb_typeof(objects) <> 'array' or jsonb_array_length(objects) > 25 then return false; end if;
  for item in select value from jsonb_array_elements(objects) loop
    model := item ->> 'modelId';
    rotation := (item ->> 'rotation')::integer;
    cell_x := (item ->> 'tileX')::integer;
    cell_y := (item ->> 'tileY')::integer;
    if coalesce(item ->> 'id','') = '' or item ->> 'id' = any(seen_ids) then return false; end if;
    seen_ids := array_append(seen_ids,item ->> 'id');
    if model not in ('house.cottage','house.studio','house.cabin','house.tent','house.kiosk','tree.round','tree.tall','tree.blossom','bush','flowers','path','bench','lamp','table','mailbox','rock.cluster') then return false; end if;
    if rotation not in (0,90,180,270) then return false; end if;
    if model like 'house.%' then homes := homes + 1; end if;
    if homes > 1 then return false; end if;
    width := case when model like 'house.%' then 2 when model = 'rock.cluster' then 2 else 1 end;
    height := case when model like 'house.%' then 2 else 1 end;
    if rotation in (90,270) and width <> height then select height,width into width,height; end if;
    if cell_x < 0 or cell_y < 0 or cell_x + width > 5 or cell_y + height > 5 then return false; end if;
    if model not in ('path','flowers') then
      for dx in 0..width-1 loop for dy in 0..height-1 loop
        if (cell_x+dx)::text||','||(cell_y+dy)::text = any(occupied) then return false; end if;
        occupied := array_append(occupied,(cell_x+dx)::text||','||(cell_y+dy)::text);
      end loop; end loop;
    end if;
  end loop;
  return cardinality(occupied) < 25;
exception when others then return false;
end;
$$;

create or replace function public.delete_bubble_log(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.bubble_archive where id=p_id and owner_id=auth.uid();
  return public.bubble_state();
end $$;

revoke all on function public.delete_bubble_log(uuid) from public,anon,authenticated;
grant execute on function public.delete_bubble_log(uuid) to authenticated;
