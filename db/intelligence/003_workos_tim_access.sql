create table if not exists intelligence_users (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  workos_user_id text unique,
  email text not null unique,
  name text not null,
  role text not null default 'entity_owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intelligence_users_org_idx
  on intelligence_users (organization_id, email);

create table if not exists intelligence_user_client_access (
  organization_id text not null references intelligence_organizations(id),
  user_id text not null references intelligence_users(id) on delete cascade,
  client_id text not null references intelligence_clients(id) on delete cascade,
  role text not null default 'entity_owner',
  granted_by text,
  granted_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

create index if not exists intelligence_user_client_access_client_idx
  on intelligence_user_client_access (organization_id, client_id);

insert into intelligence_users (
  id,
  organization_id,
  workos_user_id,
  email,
  name,
  role
)
values (
  'tim-mccarley',
  'schedio',
  null,
  'tim.mccarley@schedio.example',
  'Tim McCarley',
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
    'tim-mccarley',
    'dawson-trails-md1',
    'entity_owner',
    'seed:tim-review'
  ),
  (
    'schedio',
    'tim-mccarley',
    'dawson-trails-md1-developer',
    'entity_owner',
    'seed:tim-review'
  )
on conflict (user_id, client_id) do update set
  organization_id = excluded.organization_id,
  role = excluded.role,
  granted_by = excluded.granted_by,
  granted_at = now();
