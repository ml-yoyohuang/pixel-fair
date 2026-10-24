-- Pixel Fair content store and least-privilege admin boundary.
-- Apply this migration to a Supabase project after creating the project.

create or replace function public.valid_event_times(p_start text, p_end text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
    start_time timestamptz;
    end_time timestamptz;
    iso_zoned_timestamp constant text := '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$';
begin
    if p_start is null or p_end is null
       or p_start !~* iso_zoned_timestamp or p_end !~* iso_zoned_timestamp then
        return false;
    end if;
    start_time := p_start::timestamptz;
    end_time := p_end::timestamptz;
    return end_time > start_time;
exception when others then
    return false;
end;
$$;
revoke all on function public.valid_event_times(text, text) from public;
grant execute on function public.valid_event_times(text, text) to authenticated;

create or replace function public.valid_scene_point(p_point jsonb, p_width numeric, p_height numeric)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
    x numeric;
    y numeric;
begin
    if jsonb_typeof(p_point) is distinct from 'object'
       or jsonb_typeof(p_point->'x') is distinct from 'number'
       or jsonb_typeof(p_point->'y') is distinct from 'number' then
        return false;
    end if;
    x := (p_point->>'x')::numeric;
    y := (p_point->>'y')::numeric;
    return x >= 0 and y >= 0 and x < p_width and y < p_height;
exception when others then
    return false;
end;
$$;

create or replace function public.valid_scene_document(p_data jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
    scene_width numeric;
    scene_height numeric;
    item jsonb;
    x numeric;
    y numeric;
    item_width numeric;
    item_height numeric;
    item_id text;
    seen_ids text[] := array[]::text[];
begin
    if jsonb_typeof(p_data) is distinct from 'object'
       or jsonb_typeof(p_data->'width') is distinct from 'number'
       or jsonb_typeof(p_data->'height') is distinct from 'number'
       or jsonb_typeof(p_data->'ground') is distinct from 'array'
       or jsonb_typeof(p_data->'objects') is distinct from 'array'
       or jsonb_typeof(p_data->'npcWaypoints') is distinct from 'array' then
        return false;
    end if;
    scene_width := (p_data->>'width')::numeric;
    scene_height := (p_data->>'height')::numeric;
    if scene_width < 1 or scene_width > 128 or scene_width <> trunc(scene_width)
       or scene_height < 1 or scene_height > 128 or scene_height <> trunc(scene_height)
       or not public.valid_scene_point(p_data->'spawn', scene_width, scene_height) then
        return false;
    end if;
    if p_data ? 'rewardViewPoint'
       and not public.valid_scene_point(p_data->'rewardViewPoint', scene_width, scene_height) then
        return false;
    end if;

    for item in select value from jsonb_array_elements(p_data->'npcWaypoints') loop
        if not public.valid_scene_point(item, scene_width, scene_height) then return false; end if;
    end loop;

    for item in select value from jsonb_array_elements(p_data->'ground') loop
        if jsonb_typeof(item) is distinct from 'object'
           or jsonb_typeof(item->'x') is distinct from 'number'
           or jsonb_typeof(item->'y') is distinct from 'number'
           or jsonb_typeof(item->'width') is distinct from 'number'
           or jsonb_typeof(item->'height') is distinct from 'number'
           or item->>'kind' is null or item->>'kind' not in ('street','plaza','alley')
           or (item ? 'label' and jsonb_typeof(item->'label') is distinct from 'string') then
            return false;
        end if;
        x := (item->>'x')::numeric;
        y := (item->>'y')::numeric;
        item_width := (item->>'width')::numeric;
        item_height := (item->>'height')::numeric;
        if x < 0 or y < 0 or x <> trunc(x) or y <> trunc(y)
           or item_width < 1 or item_height < 1
           or item_width <> trunc(item_width) or item_height <> trunc(item_height)
           or x + item_width > scene_width or y + item_height > scene_height then
            return false;
        end if;
    end loop;

    for item in select value from jsonb_array_elements(p_data->'objects') loop
        if jsonb_typeof(item) is distinct from 'object'
           or jsonb_typeof(item->'id') is distinct from 'string'
           or nullif(btrim(item->>'id'), '') is null
           or item->>'kind' is null or item->>'kind' not in ('building','tree','bench','poster','board','plant','lamp','bike','vending','gate','stringLights')
           or jsonb_typeof(item->'width') is distinct from 'number'
           or jsonb_typeof(item->'height') is distinct from 'number'
           or (item ? 'label' and jsonb_typeof(item->'label') is distinct from 'string')
           or (item ? 'color' and (item->>'color' is null or item->>'color' not in ('blue','sage','coral','mustard')))
           or (item ? 'collidable' and jsonb_typeof(item->'collidable') is distinct from 'boolean')
           or (item ? 'anchor' and not public.valid_scene_point(item->'anchor', scene_width, scene_height))
           or (item ? 'interaction' and (item->>'interaction' is null or item->>'interaction' not in ('service','bookshop','coffee','print','board','poster','reader','seat'))) then
            return false;
        end if;
        item_id := item->>'id';
        if item_id = any(seen_ids) then return false; end if;
        seen_ids := array_append(seen_ids, item_id);
        item_width := (item->>'width')::numeric;
        item_height := (item->>'height')::numeric;
        if item_width < 1 or item_height < 1
           or item_width <> trunc(item_width) or item_height <> trunc(item_height)
           or not public.valid_scene_point(item->'origin', scene_width, scene_height) then
            return false;
        end if;
        x := (item->'origin'->>'x')::numeric;
        y := (item->'origin'->>'y')::numeric;
        if x + item_width > scene_width or y + item_height > scene_height then return false; end if;
    end loop;
    return true;
exception when others then
    return false;
end;
$$;
create or replace function public.valid_slot_bounds(p_slot jsonb, p_layout jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
    map_width numeric;
    map_height numeric;
    x numeric;
    y numeric;
    slot_width numeric;
    slot_height numeric;
    point jsonb;
begin
    if jsonb_typeof(p_slot->'origin') is distinct from 'object'
       or jsonb_typeof(p_slot->'origin'->'x') is distinct from 'number'
       or jsonb_typeof(p_slot->'origin'->'y') is distinct from 'number'
       or jsonb_typeof(p_slot->'width') is distinct from 'number'
       or jsonb_typeof(p_slot->'height') is distinct from 'number'
       or jsonb_typeof(p_layout->'width') is distinct from 'number'
       or jsonb_typeof(p_layout->'height') is distinct from 'number'
       or jsonb_typeof(p_slot->'interactionAnchors') is distinct from 'array'
       or jsonb_typeof(p_slot->'npcStopPoints') is distinct from 'array' then
        return false;
    end if;
    map_width := (p_layout->>'width')::numeric;
    map_height := (p_layout->>'height')::numeric;
    x := (p_slot->'origin'->>'x')::numeric;
    y := (p_slot->'origin'->>'y')::numeric;
    slot_width := (p_slot->>'width')::numeric;
    slot_height := (p_slot->>'height')::numeric;
    if map_width < 1 or map_height < 1 or slot_width < 1 or slot_height < 1
       or x < 0 or y < 0 or x <> trunc(x) or y <> trunc(y)
       or slot_width <> trunc(slot_width) or slot_height <> trunc(slot_height)
       or x >= map_width or y >= map_height
       or x + slot_width > map_width or y + slot_height > map_height then
        return false;
    end if;
    for point in select value from jsonb_array_elements(p_slot->'interactionAnchors' || p_slot->'npcStopPoints') loop
        if not public.valid_scene_point(point, map_width, map_height) then return false; end if;
    end loop;
    return true;
exception when others then
    return false;
end;
$$;
revoke all on function public.valid_scene_point(jsonb, numeric, numeric) from public;
revoke all on function public.valid_scene_document(jsonb) from public;
revoke all on function public.valid_slot_bounds(jsonb, jsonb) from public;
grant execute on function public.valid_scene_point(jsonb, numeric, numeric) to authenticated;
grant execute on function public.valid_scene_document(jsonb) to authenticated;
grant execute on function public.valid_slot_bounds(jsonb, jsonb) to authenticated;

create table if not exists public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create or replace function public.valid_content_document(p_collection text, p_data jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select coalesce(
        jsonb_typeof(p_data) = 'object'
        and nullif(btrim(p_data->>'id'), '') is not null
        and case p_collection
            when 'venues' then jsonb_typeof(p_data->'name') = 'string'
                and nullif(btrim(p_data->>'name'), '') is not null
            when 'layouts' then p_data ?& array['venueId','version','width','height']
                and nullif(btrim(p_data->>'venueId'), '') is not null
                and jsonb_typeof(p_data->'version') = 'number'
                and jsonb_typeof(p_data->'width') = 'number'
                and jsonb_typeof(p_data->'height') = 'number'
                and (p_data->>'version')::numeric > 0
                and (p_data->>'version')::numeric = trunc((p_data->>'version')::numeric)
                and (p_data->>'width')::numeric > 0
                and (p_data->>'width')::numeric <= 128
                and (p_data->>'width')::numeric = trunc((p_data->>'width')::numeric)
                and (p_data->>'height')::numeric > 0
                and (p_data->>'height')::numeric <= 128
                and (p_data->>'height')::numeric = trunc((p_data->>'height')::numeric)
            when 'events' then p_data ?& array['name','tagline','layoutId','venueId','sceneId','startsAt','endsAt','timezone','announcements']
                and nullif(btrim(p_data->>'name'), '') is not null
                and nullif(btrim(p_data->>'layoutId'), '') is not null
                and nullif(btrim(p_data->>'venueId'), '') is not null
                and nullif(btrim(p_data->>'sceneId'), '') is not null
                and jsonb_typeof(p_data->'tagline') = 'string'
                and jsonb_typeof(p_data->'startsAt') = 'string'
                and jsonb_typeof(p_data->'endsAt') = 'string'
                and jsonb_typeof(p_data->'timezone') = 'string'
                and jsonb_typeof(p_data->'announcements') = 'array'
                and public.valid_event_times(p_data->>'startsAt', p_data->>'endsAt')
            when 'scenes' then p_data ?& array['width','height','spawn','objects','ground','npcWaypoints']
                and jsonb_typeof(p_data->'width') = 'number'
                and jsonb_typeof(p_data->'height') = 'number'
                and (p_data->>'width')::numeric > 0
                and (p_data->>'width')::numeric <= 128
                and (p_data->>'width')::numeric = trunc((p_data->>'width')::numeric)
                and (p_data->>'height')::numeric > 0
                and (p_data->>'height')::numeric <= 128
                and (p_data->>'height')::numeric = trunc((p_data->>'height')::numeric)
                and jsonb_typeof(p_data->'spawn') = 'object'
                and jsonb_typeof(p_data->'spawn'->'x') = 'number'
                and jsonb_typeof(p_data->'spawn'->'y') = 'number'
                and (p_data->'spawn'->>'x')::numeric >= 0
                and (p_data->'spawn'->>'x')::numeric < (p_data->>'width')::numeric
                and (p_data->'spawn'->>'y')::numeric >= 0
                and (p_data->'spawn'->>'y')::numeric < (p_data->>'height')::numeric
                and jsonb_typeof(p_data->'objects') = 'array'
                and jsonb_typeof(p_data->'ground') = 'array'
                and jsonb_typeof(p_data->'npcWaypoints') = 'array'
                and public.valid_scene_document(p_data)
            when 'slots' then p_data ?& array['layoutId','code','zoneId','origin','width','height','facing','interactionAnchors','npcStopPoints']
                and nullif(btrim(p_data->>'layoutId'), '') is not null
                and nullif(btrim(p_data->>'code'), '') is not null
                and nullif(btrim(p_data->>'zoneId'), '') is not null
                and jsonb_typeof(p_data->'width') = 'number'
                and jsonb_typeof(p_data->'height') = 'number'
                and (p_data->>'width')::numeric > 0
                and (p_data->>'width')::numeric <= 128
                and (p_data->>'width')::numeric = trunc((p_data->>'width')::numeric)
                and (p_data->>'height')::numeric > 0
                and (p_data->>'height')::numeric <= 128
                and (p_data->>'height')::numeric = trunc((p_data->>'height')::numeric)
                and jsonb_typeof(p_data->'origin') = 'object'
                and jsonb_typeof(p_data->'origin'->'x') = 'number'
                and jsonb_typeof(p_data->'origin'->'y') = 'number'
                and p_data->>'facing' in ('up','down','left','right')
                and jsonb_typeof(p_data->'interactionAnchors') = 'array'
                and jsonb_typeof(p_data->'npcStopPoints') = 'array'
            when 'circles' then jsonb_typeof(p_data->'name') = 'string'
                and jsonb_typeof(p_data->'author') = 'string'
                and nullif(btrim(p_data->>'name'), '') is not null
                and nullif(btrim(p_data->>'author'), '') is not null
            when 'participations' then p_data ?& array['eventId','circleId','intro','greeting','attendantAvatarId','decoration','status']
                and nullif(btrim(p_data->>'circleId'), '') is not null
                and nullif(btrim(p_data->>'intro'), '') is not null
                and nullif(btrim(p_data->>'greeting'), '') is not null
                and nullif(btrim(p_data->>'attendantAvatarId'), '') is not null
                and jsonb_typeof(p_data->'decoration') = 'object'
                and p_data->>'status' = 'published'
            when 'assignments' then nullif(btrim(p_data->>'participationId'), '') is not null
                and jsonb_typeof(p_data->'slotIds') = 'array'
                and coalesce((select bool_and(jsonb_typeof(e.value) = 'string' and nullif(btrim(e.value #>> '{}'), '') is not null) from jsonb_array_elements(p_data->'slotIds') as e(value)), true)
                and (select count(*) = count(distinct e.value #>> '{}') from jsonb_array_elements(p_data->'slotIds') as e(value))
            when 'works' then p_data ?& array['circleId','title','medium','coverAssetId','description','preview']
                and nullif(btrim(p_data->>'circleId'), '') is not null
                and nullif(btrim(p_data->>'title'), '') is not null
                and nullif(btrim(p_data->>'coverAssetId'), '') is not null
                and jsonb_typeof(p_data->'description') = 'string'
                and p_data->>'medium' in ('comic','novel','illustration','goods')
                and jsonb_typeof(p_data->'preview') = 'object'
                and case p_data->'preview'->>'kind'
                    when 'none' then true
                    when 'images' then jsonb_typeof(p_data->'preview'->'assetIds') = 'array'
                        and coalesce((select bool_and(jsonb_typeof(e.value) = 'string') from jsonb_array_elements(p_data->'preview'->'assetIds') as e(value)), true)
                    when 'text' then jsonb_typeof(p_data->'preview'->'paragraphs') = 'array'
                        and coalesce((select bool_and(jsonb_typeof(e.value) = 'string') from jsonb_array_elements(p_data->'preview'->'paragraphs') as e(value)), true)
                    else false
                end
            when 'exhibits' then p_data ?& array['participationId','workId','release','availability','demoOnly']
                and nullif(btrim(p_data->>'participationId'), '') is not null
                and nullif(btrim(p_data->>'workId'), '') is not null
                and p_data->>'release' in ('new','existing')
                and p_data->>'availability' in ('sale','free','display')
                and jsonb_typeof(p_data->'demoOnly') = 'boolean'
                and (not (p_data ? 'url') or p_data->>'url' = '' or p_data->>'url' ~* '^https?://')
            when 'campaigns' then p_data ?& array['eventId','title','participantIds','requiredCount','rewardRecipeId']
                and nullif(btrim(p_data->>'title'), '') is not null
                and nullif(btrim(p_data->>'rewardRecipeId'), '') is not null
                and jsonb_typeof(p_data->'participantIds') = 'array'
                and jsonb_typeof(p_data->'requiredCount') = 'number'
                and (p_data->>'requiredCount')::numeric > 0
                and (p_data->>'requiredCount')::numeric = trunc((p_data->>'requiredCount')::numeric)
                and (p_data->>'requiredCount')::numeric <= jsonb_array_length(p_data->'participantIds')
                and coalesce((select bool_and(jsonb_typeof(e.value) = 'string' and nullif(btrim(e.value #>> '{}'), '') is not null) from jsonb_array_elements(p_data->'participantIds') as e(value)), true)
                and (select count(*) = count(distinct e.value #>> '{}') from jsonb_array_elements(p_data->'participantIds') as e(value))
            else false
        end,
        false
    );
$$;
revoke all on function public.valid_content_document(text, jsonb) from public;
grant execute on function public.valid_content_document(text, jsonb) to authenticated;

create table if not exists public.content_documents (
    collection text not null check (collection in (
        'venues', 'layouts', 'events', 'scenes', 'slots', 'circles',
        'participations', 'assignments', 'works', 'exhibits', 'campaigns'
    )),
    id text not null check (length(id) between 1 and 120 and btrim(id) <> ''),
    event_id text not null check (length(event_id) between 1 and 120 and btrim(event_id) <> ''),
    data jsonb not null check (
        data->>'id' = id
        and public.valid_content_document(collection, data)
        and octet_length(data::text) <= 1048576
        and (collection not in ('participations','campaigns') or data->>'eventId' = event_id)
        and (collection <> 'events' or id = event_id)
    ),
    is_published boolean not null default false,
    revision integer not null default 1 check (revision > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (event_id, collection, id)
);

create index if not exists content_documents_event_collection_idx
    on public.content_documents (event_id, collection, id);
create index if not exists content_documents_reference_check_idx
    on public.content_documents (collection, id, event_id, is_published);
create index if not exists content_documents_published_idx
    on public.content_documents (event_id, collection, id)
    where is_published = true;

create table if not exists public.content_audit_log (
    id bigint generated always as identity primary key,
    actor_id uuid,
    action text not null check (action in ('INSERT','UPDATE','DELETE')),
    event_id text not null,
    collection text not null,
    document_id text not null,
    old_document jsonb,
    new_document jsonb,
    occurred_at timestamptz not null default now()
);
create index if not exists content_audit_log_event_time_idx
    on public.content_audit_log (event_id, occurred_at desc);

-- Enforce document references at transaction commit. This allows a full event
-- import to arrive as one transaction while preventing dangling references in
-- ordinary single-document edits and deletes.
create or replace function public.check_content_document_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- Validate the whole database once per transaction. A normal BEFORE trigger
    -- clears this marker before later writes in the same transaction.
    if current_setting('pixel_fair.references_checked', true) = 'on' then
        return null;
    end if;
    perform pg_catalog.set_config('pixel_fair.references_checked', 'on', true);

    if exists (
        select 1 from public.content_documents d
        where d.collection = 'layouts' and not exists (
            select 1 from public.content_documents v
            where v.collection = 'venues' and v.id = d.data->>'venueId' and v.event_id = d.event_id
              and (not d.is_published or v.is_published)
        )
    ) then raise exception '每個場地配置都必須參照同一活動的場館。' using errcode = '23503'; end if;

    if exists (
        select 1 from public.content_documents d
        where d.collection = 'events' and (
            not exists (select 1 from public.content_documents x where x.collection = 'layouts' and x.id = d.data->>'layoutId' and x.event_id = d.event_id and (not d.is_published or x.is_published))
            or not exists (select 1 from public.content_documents x where x.collection = 'venues' and x.id = d.data->>'venueId' and x.event_id = d.event_id and (not d.is_published or x.is_published))
            or not exists (select 1 from public.content_documents x where x.collection = 'scenes' and x.id = d.data->>'sceneId' and x.event_id = d.event_id and (not d.is_published or x.is_published))
        )
    ) then raise exception '每個活動都必須參照同一活動的場館、配置與場景。' using errcode = '23503'; end if;

    if exists (
        select 1 from public.content_documents d
        where d.collection = 'slots' and not exists (
            select 1 from public.content_documents x
            where x.collection = 'layouts' and x.id = d.data->>'layoutId' and x.event_id = d.event_id
              and (not d.is_published or x.is_published)
              and public.valid_slot_bounds(d.data, x.data)
        )
    ) then raise exception '每個攤位位置都必須參照同一活動中已發布且邊界有效的場地配置。' using errcode = '23503'; end if;

    if exists (
        select 1 from public.content_documents d
        where d.collection = 'participations' and not exists (
            select 1 from public.content_documents x where x.collection = 'circles' and x.id = d.data->>'circleId' and x.event_id = d.event_id and (not d.is_published or x.is_published)
        )
    ) then raise exception '每筆參展資料都必須參照同一活動的創作團體。' using errcode = '23503'; end if;

    if exists (
        select 1 from public.content_documents d
        where d.collection = 'assignments' and (
            not exists (select 1 from public.content_documents x where x.collection = 'participations' and x.id = d.data->>'participationId' and x.event_id = d.event_id and (not d.is_published or x.is_published))
            or exists (
                select 1 from jsonb_array_elements_text(d.data->'slotIds') sid(id)
                where not exists (select 1 from public.content_documents x where x.collection = 'slots' and x.id = sid.id and x.event_id = d.event_id and (not d.is_published or x.is_published))
            )
        )
    ) then raise exception '每個位置分配都必須參照存在的參展資料與攤位位置。' using errcode = '23503'; end if;

    if exists (
        select 1 from public.content_documents d
        where d.collection = 'works' and not exists (
            select 1 from public.content_documents x where x.collection = 'circles' and x.id = d.data->>'circleId' and x.event_id = d.event_id and (not d.is_published or x.is_published)
        )
    ) then raise exception '每份作品都必須參照同一活動的創作團體。' using errcode = '23503'; end if;

    if exists (
        select 1 from public.content_documents d
        where d.collection = 'exhibits' and (
            not exists (select 1 from public.content_documents x where x.collection = 'participations' and x.id = d.data->>'participationId' and x.event_id = d.event_id and (not d.is_published or x.is_published))
            or not exists (select 1 from public.content_documents x where x.collection = 'works' and x.id = d.data->>'workId' and x.event_id = d.event_id and (not d.is_published or x.is_published))
        )
    ) then raise exception '每筆出展作品都必須參照同一活動的參展資料與作品。' using errcode = '23503'; end if;

    if exists (
        select 1 from public.content_documents d
        cross join lateral jsonb_array_elements_text(d.data->'participantIds') p(id)
        where d.collection = 'campaigns' and not exists (
            select 1 from public.content_documents x where x.collection = 'participations' and x.id = p.id and x.event_id = d.event_id and (not d.is_published or x.is_published)
        )
    ) then raise exception '集章活動只能包含同一活動中已存在的參展資料。' using errcode = '23503'; end if;

    if exists (
        select 1 from public.content_documents e
        where e.collection = 'events' and e.is_published
          and not exists (select 1 from public.content_documents c where c.collection = 'campaigns' and c.event_id = e.event_id and c.is_published)
    ) then raise exception '發布活動前，至少要有一個已發布的集章活動。' using errcode = '23503'; end if;

    return null;
end;
$$;
revoke all on function public.check_content_document_references() from public, anon, authenticated;

create or replace function public.reset_content_reference_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    perform pg_catalog.set_config('pixel_fair.references_checked', 'off', true);
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;
revoke all on function public.reset_content_reference_check() from public, anon, authenticated;

drop trigger if exists content_documents_reference_reset on public.content_documents;
create trigger content_documents_reference_reset
before insert or update or delete on public.content_documents
for each row execute function public.reset_content_reference_check();

drop trigger if exists content_documents_references on public.content_documents;
create constraint trigger content_documents_references
after insert or update or delete on public.content_documents
deferrable initially deferred
for each row execute function public.check_content_document_references();

-- RLS and transactional import both use this MFA-bound allowlist check.
create or replace function public.is_content_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(
        auth.jwt()->>'aal' = 'aal2'
        and exists (
            select 1 from public.admin_users a
            where a.user_id = auth.uid()
        ),
        false
    );
$$;
revoke all on function public.is_content_admin() from public, anon;
grant execute on function public.is_content_admin() to authenticated;

-- Bulk import is one transaction, so public readers never observe a half-loaded
-- set of event documents. RLS still checks the caller for every inserted row.
drop function if exists public.import_content_documents(text, jsonb);
create or replace function public.import_content_documents(p_documents jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
    imported integer;
    expected integer;
begin
    if not public.is_content_admin() then
        raise exception '需要完成 MFA 的管理者權限。' using errcode = '42501';
    end if;
    if jsonb_typeof(p_documents) is distinct from 'array' then
        raise exception '匯入內容必須是 JSON 陣列。' using errcode = '22023';
    end if;
    expected := jsonb_array_length(p_documents);
    if expected > 5000 or octet_length(p_documents::text) > 8388608 then
        raise exception '匯入內容不可超過 5,000 筆或 8 MB。' using errcode = '22023';
    end if;

    insert into public.content_documents (collection, id, event_id, data, is_published)
    select x.collection, x.id, x.event_id, x.data, x.is_published
    from jsonb_to_recordset(p_documents) as x(collection text, id text, event_id text, data jsonb, is_published boolean)
    on conflict (event_id, collection, id) do update
       set event_id = excluded.event_id,
           data = excluded.data,
           is_published = excluded.is_published;

    get diagnostics imported = row_count;
    if imported <> expected then
        raise exception '匯入資料格式不完整。' using errcode = '22023';
    end if;
    return imported;
end;
$$;
revoke all on function public.import_content_documents(jsonb) from public, anon;
grant execute on function public.import_content_documents(jsonb) to authenticated;

create or replace function public.touch_content_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    new.revision = old.revision + 1;
    return new;
end;
$$;
revoke all on function public.touch_content_document() from public, anon, authenticated;

drop trigger if exists content_documents_touch on public.content_documents;
create trigger content_documents_touch
before update on public.content_documents
for each row execute function public.touch_content_document();

create or replace function public.audit_content_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.content_audit_log (actor_id, action, event_id, collection, document_id, old_document, new_document)
    values (
        auth.uid(), tg_op,
        coalesce(new.event_id, old.event_id),
        coalesce(new.collection, old.collection),
        coalesce(new.id, old.id),
        case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
        case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    );
    return null;
end;
$$;
revoke all on function public.audit_content_document() from public, anon, authenticated;

drop trigger if exists content_documents_audit on public.content_documents;
create trigger content_documents_audit
after insert or update or delete on public.content_documents
for each row execute function public.audit_content_document();

alter table public.admin_users enable row level security;
alter table public.content_documents enable row level security;
alter table public.content_audit_log enable row level security;

revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.content_documents from anon, authenticated;
revoke all on table public.content_audit_log from anon, authenticated;
grant select on table public.content_documents to anon, authenticated;
grant insert, update, delete on table public.content_documents to authenticated;
grant select on table public.content_audit_log to authenticated;

drop policy if exists content_audit_admin_read on public.content_audit_log;
create policy content_audit_admin_read
on public.content_audit_log for select to authenticated
using (public.is_content_admin());

drop policy if exists content_documents_public_read on public.content_documents;
create policy content_documents_public_read
on public.content_documents for select to anon, authenticated
using (is_published = true);

drop policy if exists content_documents_admin_read on public.content_documents;
create policy content_documents_admin_read
on public.content_documents for select to authenticated
using (public.is_content_admin());

drop policy if exists content_documents_admin_insert on public.content_documents;
create policy content_documents_admin_insert
on public.content_documents for insert to authenticated
with check (public.is_content_admin());

drop policy if exists content_documents_admin_update on public.content_documents;
create policy content_documents_admin_update
on public.content_documents for update to authenticated
using (public.is_content_admin())
with check (public.is_content_admin());

drop policy if exists content_documents_admin_delete on public.content_documents;
create policy content_documents_admin_delete
on public.content_documents for delete to authenticated
using (public.is_content_admin());

-- No client role can add or promote admins. Bootstrap an administrator using
-- the trusted SQL editor after creating that user in Supabase Auth:
-- insert into public.admin_users (user_id) values ('AUTH_USER_UUID');
