-- User management is gated by a per-user admin flag rather than the access
-- role: every teammate is an entity_owner on their entities, but only Tim
-- administers who gets in.

alter table intelligence_users
  add column if not exists is_admin boolean not null default false;

update intelligence_users
   set is_admin = true,
       updated_at = now()
 where lower(email) = 'tmccarthy@schediogroup.com';
