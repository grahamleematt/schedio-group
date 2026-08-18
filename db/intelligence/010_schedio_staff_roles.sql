-- Schedio staff get internal roles so the portal can split its views:
-- internal (sg_admin / sg_pm) sees the full operational detail; client roles
-- (entity_owner / client_mgr / client_viewer) see the simplified intake
-- surfaces. Admins become sg_admin; other Schedio staff become sg_pm.

update intelligence_users
   set role = case when is_admin then 'sg_admin' else 'sg_pm' end,
       updated_at = now()
 where lower(email) like '%@schediogroup.com'
    or id in ('tim-mccarley', 'dustin-krajewski', 'aurora-zeltzin');

-- Keep per-entity grant rows consistent with the user-level role.
update intelligence_user_client_access a
   set role = u.role
  from intelligence_users u
 where u.id = a.user_id
   and u.role in ('sg_admin', 'sg_pm');
