-- Schedio Group staff access: Dustin and Aurora get new entity-owner grants
-- on both Dawson Trails entities. WorkOS user IDs stay null until each
-- person accepts their invitation — authz falls back to email matching.
--
-- Tim already exists as the seeded 'tim-mccarley' row (the mockup persona
-- for Tim McCarthy), whose WorkOS identity was bound via preflight
-- --bind-tim. Migration 003 resets his email to the placeholder on every
-- run, so this later migration re-applies his real email and name rather
-- than inserting a duplicate user for the same person.

-- Clean up the short-lived duplicate row for Tim, if present (cascades to
-- its access grants).
delete from intelligence_users where id = 'tim-mccarthy';

update intelligence_users
   set email = 'tmccarthy@schediogroup.com',
       name = 'Tim McCarthy',
       updated_at = now()
 where id = 'tim-mccarley';

insert into intelligence_users (
  id,
  organization_id,
  workos_user_id,
  email,
  name,
  role
)
values
  (
    'dustin-krajewski',
    'schedio',
    null,
    'dkrajewski@schediogroup.com',
    'Dustin Krajewski',
    'entity_owner'
  ),
  (
    'aurora-zeltzin',
    'schedio',
    null,
    'azeltzin@schediogroup.com',
    'Aurora Zeltzin',
    'entity_owner'
  )
on conflict (id) do update set
  organization_id = excluded.organization_id,
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  updated_at = now();

insert into intelligence_user_client_access (
  organization_id,
  user_id,
  client_id,
  role,
  granted_by
)
values
  (
    'schedio',
    'dustin-krajewski',
    'dawson-trails-md1',
    'entity_owner',
    'seed:schedio-team'
  ),
  (
    'schedio',
    'dustin-krajewski',
    'dawson-trails-md1-developer',
    'entity_owner',
    'seed:schedio-team'
  ),
  (
    'schedio',
    'aurora-zeltzin',
    'dawson-trails-md1',
    'entity_owner',
    'seed:schedio-team'
  ),
  (
    'schedio',
    'aurora-zeltzin',
    'dawson-trails-md1-developer',
    'entity_owner',
    'seed:schedio-team'
  )
on conflict (user_id, client_id) do update set
  organization_id = excluded.organization_id,
  role = excluded.role,
  granted_by = excluded.granted_by,
  granted_at = now();
