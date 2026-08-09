-- Lets "Add Staff" double as "grant app access" — an admin can now enter an
-- email when adding/editing a staff roster entry, and the app sends that
-- person a login invite in the same step (reusing the existing inviteuser
-- edge function), instead of requiring a second trip through Team Access.
-- Storing the email on the row lets the UI show whether access has been
-- granted and avoid re-sending an invite email on every unrelated edit.

alter table staff
  add column if not exists email text;

comment on column staff.email is
  'Optional — when set, this staff member has been invited to log in (see the inviteuser edge function). Not necessarily the same as their profiles row until they accept.';
