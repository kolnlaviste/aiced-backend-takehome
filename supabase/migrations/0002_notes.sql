-- ===========================================================================
-- Notes feature: tenant-scoped, RLS-enforced.
--
-- A user may read or create notes only for groups they belong to.
-- Tenant isolation is enforced entirely in the RLS policies below —
-- no application-level filtering is needed or used.
-- ===========================================================================

create table notes (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id) on delete cascade,
  author_id  uuid not null references users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert on notes to authenticated;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table notes enable row level security;

-- A user can see a note only if they are a member of the note's group.
create policy "notes are visible to group members"
  on notes for select
  to authenticated
  using (
    exists (
      select 1 from memberships
      where memberships.user_id  = auth.uid()
      and   memberships.group_id = notes.group_id
    )
  );

-- A user can create a note only for a group they belong to.
create policy "group members can create notes"
  on notes for insert
  to authenticated
  with check (
    exists (
      select 1 from memberships
      where memberships.user_id  = auth.uid()
      and   memberships.group_id = notes.group_id
    )
  );
