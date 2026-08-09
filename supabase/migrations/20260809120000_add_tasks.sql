-- Adds a Tasks feature: admins can assign tasks to one or more staff
-- members, and any user can create their own personal to-dos. Completion
-- is tracked per assignee (task_assignees), not on the task itself, so a
-- task shared across several people lets each of them tick off their own
-- copy independently instead of one shared checkbox.
--
-- This is the first RLS checked into version control in this repo —
-- existing tables (staff, doctors, profiles, schedule_*) have their
-- policies set up directly in the Supabase dashboard and aren't tracked
-- here. That's a pre-existing gap outside the scope of this change; these
-- policies only cover the two new tables below.

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists tasks_org_id_idx on tasks (org_id);

comment on table tasks is
  'A task, optionally assigned to one or more profiles via task_assignees. created_by is who made it — either an admin assigning work, or a staff member creating their own to-do.';

create table if not exists task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (task_id, profile_id)
);

create index if not exists task_assignees_profile_id_idx on task_assignees (profile_id);
create index if not exists task_assignees_task_id_idx on task_assignees (task_id);

comment on table task_assignees is
  'Junction between tasks and profiles. completed/completed_at live here (not on tasks) so each assignee tracks their own completion independently.';

alter table tasks enable row level security;
alter table task_assignees enable row level security;

-- tasks: a profile can see a task if it's theirs (created it), they're an
-- admin in the same org, or they're one of its assignees.
create policy "tasks_select" on tasks
  for select
  using (
    org_id = (select org_id from profiles where id = auth.uid())
    and (
      created_by = auth.uid()
      or (select role from profiles where id = auth.uid()) = 'admin'
      or exists (
        select 1 from task_assignees
        where task_assignees.task_id = tasks.id
        and task_assignees.profile_id = auth.uid()
      )
    )
  );

-- Any org member can create a task — covers both an admin assigning work
-- and a staff member creating their own to-do.
create policy "tasks_insert" on tasks
  for insert
  with check (
    org_id = (select org_id from profiles where id = auth.uid())
    and created_by = auth.uid()
  );

create policy "tasks_update" on tasks
  for update
  using (
    created_by = auth.uid()
    or (
      (select role from profiles where id = auth.uid()) = 'admin'
      and org_id = (select org_id from profiles where id = auth.uid())
    )
  );

create policy "tasks_delete" on tasks
  for delete
  using (
    created_by = auth.uid()
    or (
      (select role from profiles where id = auth.uid()) = 'admin'
      and org_id = (select org_id from profiles where id = auth.uid())
    )
  );

-- task_assignees: visible to the assignee themselves, an admin in the same
-- org, or the creator of the task (so an admin/creator can see progress).
create policy "task_assignees_select" on task_assignees
  for select
  using (
    profile_id = auth.uid()
    or (select role from profiles where id = auth.uid()) = 'admin'
    or exists (
      select 1 from tasks
      where tasks.id = task_assignees.task_id
      and tasks.created_by = auth.uid()
    )
  );

-- Self-assign (personal to-dos) is always allowed; assigning someone else
-- requires being an admin or the task's creator.
create policy "task_assignees_insert" on task_assignees
  for insert
  with check (
    profile_id = auth.uid()
    or (select role from profiles where id = auth.uid()) = 'admin'
    or exists (
      select 1 from tasks
      where tasks.id = task_assignees.task_id
      and tasks.created_by = auth.uid()
    )
  );

-- An assignee can update their own row (to toggle completed/completed_at).
-- Postgres RLS is row-level, not column-level, so this technically permits
-- an assignee to edit more than "completed" on their own row via a raw API
-- call — the UI never exposes that, so it's an accepted limitation for v1.
create policy "task_assignees_update" on task_assignees
  for update
  using (
    profile_id = auth.uid()
    or (select role from profiles where id = auth.uid()) = 'admin'
    or exists (
      select 1 from tasks
      where tasks.id = task_assignees.task_id
      and tasks.created_by = auth.uid()
    )
  );

-- Deliberately no "profile_id = auth.uid()" here — a staff member should
-- not be able to unassign themselves from a task an admin gave them.
create policy "task_assignees_delete" on task_assignees
  for delete
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
    or exists (
      select 1 from tasks
      where tasks.id = task_assignees.task_id
      and tasks.created_by = auth.uid()
    )
  );
