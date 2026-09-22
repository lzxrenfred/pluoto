-- Non-destructive validation for the optional landObjects array stored in the
-- existing person snapshot. Legacy snapshots without the field remain valid.
create or replace function public.valid_land_object_layout(snapshot jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
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
  occupied text[] := array['2,4']; -- fixed owner sign cell
  seen_ids text[] := array[]::text[];
  model text;
  solid boolean;
begin
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
    width := case when model like 'house.%' then 2 when model = 'rock.cluster' then 2 else 1 end;
    height := case when model like 'house.%' then 2 else 1 end;
    if rotation in (90,270) and width <> height then select height,width into width,height; end if;
    if cell_x < 0 or cell_y < 0 or cell_x + width > 5 or cell_y + height > 5 then return false; end if;
    solid := model not in ('path','flowers');
    if solid then
      for dx in 0..width-1 loop for dy in 0..height-1 loop
        if (cell_x+dx)::text||','||(cell_y+dy)::text = any(occupied) then return false; end if;
        occupied := array_append(occupied,(cell_x+dx)::text||','||(cell_y+dy)::text);
      end loop; end loop;
    end if;
  end loop;
  return cardinality(occupied) < 25;
exception when others then
  return false;
end;
$$;

alter table public.lands drop constraint if exists lands_valid_land_objects;
alter table public.lands add constraint lands_valid_land_objects check (public.valid_land_object_layout(person_snapshot)) not valid;
alter table public.character_customizations drop constraint if exists character_customizations_valid_land_objects;
alter table public.character_customizations add constraint character_customizations_valid_land_objects check (public.valid_land_object_layout(person_snapshot)) not valid;
