-- Saving a task failed with "infinite recursion detected in policy for
-- relation tasks": tasks_select checks task_assignees (to see if the
-- caller is an assignee), and task_assignees' policies check tasks right
-- back (to see if the caller created the task) — evaluating either
-- table's RLS re-triggers the other's, forever. Same root cause as the
-- profiles self-reference fixed in the previous migration, just spread
-- across two tables instead of one. Fix: route every cross-table check
-- through a security definer helper, whose internal queries bypass RLS
-- entirely instead of re-triggering it.

create or replace function public.is_task_creator(p_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from tasks where id = p_task_id and created_by = auth.uid());
$$;

create or replace function public.is_admin_of_task(p_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from tasks t where t.id = p_task_id and public.is_org_admin(t.org_id)
  );
$$;

create or replace function public.is_task_assignee(p_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from task_assignees where task_id = p_task_id and profile_id = auth.uid()
  );
$$;

grant execute on function public.is_task_creator(uuid) to authenticated;
grant execute on function public.is_admin_of_task(uuid) to authenticated;
grant execute on function public.is_task_assignee(uuid) to authenticated;

drop policy if exists "tasks_select" on tasks;
create policy "tasks_select" on tasks
  for select
  using (
    org_id = (select org_id from profiles where id = auth.uid())
    and (
      created_by = auth.uid()
      or public.is_org_admin(org_id)
      or public.is_task_assignee(id)
    )
  );

drop policy if exists "task_assignees_select" on task_assignees;
create policy "task_assignees_select" on task_assignees
  for select
  using (
    profile_id = auth.uid()
    or public.is_admin_of_task(task_id)
    or public.is_task_creator(task_id)
  );

drop policy if exists "task_assignees_insert" on task_assignees;
create policy "task_assignees_insert" on task_assignees
  for insert
  with check (
    profile_id = auth.uid()
    or public.is_admin_of_task(task_id)
    or public.is_task_creator(task_id)
  );

drop policy if exists "task_assignees_update" on task_assignees;
create policy "task_assignees_update" on task_assignees
  for update
  using (
    profile_id = auth.uid()
    or public.is_admin_of_task(task_id)
    or public.is_task_creator(task_id)
  );

drop policy if exists "task_assignees_delete" on task_assignees;
create policy "task_assignees_delete" on task_assignees
  for delete
  using (
    public.is_admin_of_task(task_id)
    or public.is_task_creator(task_id)
  );
