-- Every invite now creates a placeholder staff roster row (name = their
-- email, see ensureStaffRow in Staff.jsx) so Staff is the single place to
-- see everyone regardless of which invite path was used. This updates
-- complete_own_profile so that when it links profile_id on that row (see
-- 20260809140000_link_staff_to_profiles.sql for why this runs as
-- security definer rather than a broad RLS policy), it also overwrites
-- the placeholder with their real name.

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
  set profile_id = auth.uid(),
      name = trim(p_first_name || ' ' || p_last_name)
  where org_id = v_org_id
    and profile_id is null
    and email is not null
    and lower(email) = lower(v_email);
end;
$$;

grant execute on function public.complete_own_profile(text, text) to authenticated;
