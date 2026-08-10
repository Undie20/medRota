-- Admins could never actually see, promote, or remove other members of
-- their own organisation: `profiles` has had exactly one RLS policy since
-- day one ("Users can view own profile"), so every query for the org's
-- member list silently came back with just the caller's own row. This
-- broke Team Access (always showed just "you"), staff role management
-- (handleRoleChange/handleRemoveMember in Staff.jsx), and the Tasks
-- "Assign To" picker (only ever offered "You", no matter how many staff
-- had already accepted invites and had real profiles rows).
--
-- A naive `org_id = (select org_id from profiles where id = auth.uid())`
-- policy on profiles itself is self-referential — Postgres can get stuck
-- or behave unpredictably applying a table's own policy while evaluating
-- that same table inside it. Supabase's own docs recommend wrapping the
-- check in a small security definer helper for exactly this case, since
-- the function's internal query bypasses RLS entirely rather than
-- re-triggering it.

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and org_id = target_org and role = 'admin'
  );
$$;

grant execute on function public.is_org_admin(uuid) to authenticated;

create policy "Admins can view org profiles" on profiles
  for select using (public.is_org_admin(org_id));

create policy "Admins can update org profiles" on profiles
  for update using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));
