begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(23);

-- Isolated fixtures. The transaction rolls back after the security assertions.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
    '10000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'security-admin@example.invalid', '', now()
);
insert into public.admin_users (user_id)
values ('10000000-0000-4000-8000-000000000001');

insert into public.content_documents (collection, id, event_id, data, is_published)
values
    ('venues', 'public-venue', 'security-test', '{"id":"public-venue","name":"Public"}', true),
    ('venues', 'draft-venue', 'security-test', '{"id":"draft-venue","name":"Draft"}', false);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
    (select count(*) from public.content_documents where event_id = 'security-test'),
    1::bigint,
    'anonymous users can read published documents only'
);
select throws_ok(
    $$select * from public.admin_users$$,
    '42501',
    'permission denied for table admin_users',
    'anonymous users cannot inspect the admin allowlist'
);
select throws_ok(
    $$select * from public.content_audit_log$$,
    '42501',
    'permission denied for table content_audit_log',
    'anonymous users cannot inspect the audit log'
);
select throws_ok(
    $$insert into public.content_documents (collection,id,event_id,data,is_published) values ('venues','anon-write','security-test','{"id":"anon-write","name":"Blocked"}',true)$$,
    '42501',
    'permission denied for table content_documents',
    'anonymous users cannot write content'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is(
    (select count(*) from public.content_documents where event_id = 'security-test'),
    1::bigint,
    'a password-only admin session cannot read draft documents'
);
select is(
    (select count(*) from public.content_audit_log),
    0::bigint,
    'a password-only admin session cannot read the audit log'
);
select is(public.valid_event_times('2026-10-01T00:00:00+08:00', '2026-11-01T00:00:00+08:00'), true, 'database accepts ordered ISO timestamps with timezone offsets');
select is(public.valid_event_times('2026-10-01', '2026-09-01'), false, 'database rejects unzoned or reversed event times');
select is(
    public.valid_scene_document('{"id":"scene","width":2,"height":2,"spawn":{"x":0,"y":0},"ground":[],"objects":[],"npcWaypoints":[]}'::jsonb),
    true,
    'database accepts a well-formed empty scene'
);
select is(
    public.valid_scene_document('{"id":"scene","width":2,"height":2,"spawn":{"x":0,"y":0},"ground":[],"objects":[{"id":"same","kind":"tree","origin":{"x":0,"y":0},"width":1,"height":1},{"id":"same","kind":"tree","origin":{"x":1,"y":0},"width":1,"height":1}],"npcWaypoints":[]}'::jsonb),
    false,
    'database rejects duplicated map object ids'
);
select is(
    public.valid_slot_bounds('{"origin":{"x":0,"y":0},"width":2,"height":2,"interactionAnchors":[{"x":1,"y":1}],"npcStopPoints":[]}'::jsonb, '{"width":2,"height":2}'::jsonb),
    true,
    'database accepts booth bounds and interaction points inside the layout'
);
select is(
    public.valid_slot_bounds('{"origin":{"x":1,"y":0},"width":2,"height":2,"interactionAnchors":[],"npcStopPoints":[]}'::jsonb, '{"width":2,"height":2}'::jsonb),
    false,
    'database rejects booth bounds outside the layout'
);
select is(
    public.valid_content_document('assignments', '{"id":"assignment","participationId":"part","slotIds":["slot-1","slot-1"]}'::jsonb),
    false,
    'database rejects duplicate booth positions'
);
select is(
    public.valid_content_document('campaigns', '{"id":"campaign","eventId":"event","title":"Campaign","participantIds":["part-1","part-1"],"requiredCount":2,"rewardRecipeId":"recipe"}'::jsonb),
    false,
    'database rejects duplicate campaign participants'
);
select is(public.is_content_admin(), false, 'password-only session is not an admin session');
select throws_ok(
    $$insert into public.content_documents (collection,id,event_id,data,is_published) values ('venues','aal1-write','security-test','{"id":"aal1-write","name":"Blocked"}',true)$$,
    '42501',
    'new row violates row-level security policy for table "content_documents"',
    'an allowlisted admin without MFA cannot write'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
select is(public.is_content_admin(), false, 'MFA alone does not grant admin access');
select is(
    (select count(*) from public.content_audit_log),
    0::bigint,
    'an MFA user outside the admin allowlist cannot read the audit log'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
select is(public.is_content_admin(), true, 'allowlisted MFA session is recognized as admin');
set constraints content_documents_references immediate;
select throws_ok(
    $$select public.import_content_documents('[{"collection":"layouts","id":"bad-import-layout","event_id":"security-test","data":{"id":"bad-import-layout","venueId":"missing-venue","version":1,"width":1,"height":1},"is_published":false}]'::jsonb)$$,
    '23503',
    '每個場地配置都必須參照同一活動的場館。',
    'bulk import rejects documents with missing references'
);
select is(
    (select count(*) from public.content_documents where id = 'bad-import-layout'),
    0::bigint,
    'failed bulk import leaves no partial documents behind'
);
set constraints content_documents_references deferred;
insert into public.content_documents (collection, id, event_id, data, is_published)
values ('venues', 'admin-write', 'security-test', '{"id":"admin-write","name":"Admin"}', false);
select is(
    (select count(*) from public.content_audit_log where actor_id = '10000000-0000-4000-8000-000000000001' and document_id = 'admin-write'),
    1::bigint,
    'admin changes are recorded with the authenticated actor'
);
select throws_ok(
    $$delete from public.content_audit_log where document_id = 'admin-write'$$,
    '42501',
    'permission denied for table content_audit_log',
    'admins cannot alter the append-only audit log'
);
reset role;

select * from finish();
rollback;
