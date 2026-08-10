-- Links a staff roster entry to the actual login account for that person,
-- once they accept their invite and finish onboarding. Until now `staff`
-- (the roster used for the schedule) and `profiles` (login identities used
-- for Task assignment) were completely disconnected — inviting "Greg" and
-- having him accept created a brand new, blank-named profiles row with no
-- relationship back to the "Greg" roster entry an admin had already set up.

alter table staff
  add column if not exists profile_id uuid references profiles(id);

create unique index if not exists staff_profile_id_key
  on staff (profile_id) where profile_id is not null;

-- Lets a newly-invited person finish their own onboarding (set their real
-- name, and — if a staff roster row was invited under their email — link
-- it to their new login) without needing a broad "users can update their
-- own profile" RLS policy, which would be awkward to restrict to just name
-- columns (Postgres RLS is row-level, not column-level) and risks someone
-- rewriting their own role/org_id if written carelessly. This function
-- only ever touches the caller's own profiles row and a staff row that
-- provably shares their invited email (checked server-side against
-- auth.users.email, not anything the client supplies), so it's safe to
-- run with elevated (security definer) privileges. No RLS policy changes
-- are needed anywhere for this feature as a result.
create or replace function public.complete_own_profile(p_first_name text, p_last_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_email text;
begin
  select org_id into v_org_id from public.profiles where id = auth.uid();
  select email into v_email from auth.users where id = auth.uid();

  update public.profiles
  set first_name = p_first_name, last_name = p_last_name
  where id = auth.uid();

  update public.staff
  set profile_id = auth.uid()
  where org_id = v_org_id
    and profile_id is null
    and email is not null
    and lower(email) = lower(v_email);
end;
$$;

grant execute on function public.complete_own_profile(text, text) to authenticated;
