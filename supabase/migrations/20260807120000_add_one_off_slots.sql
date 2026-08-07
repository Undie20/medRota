-- Adds support for genuine single-occurrence clinic slots.
--
-- Until now, every schedule_slots row represented a repeating pattern
-- (day_of_week + week_number), which recurs forever as the rotation
-- cycles. There was no way to add a slot that only ever happens once
-- on a specific calendar date — e.g. "Dr Greg has a clinic this week
-- Thursday only" would previously create a slot that quietly comes
-- back every time the rotation reaches that week number again.
--
-- one_off_date, when set, means: this slot exists on this exact date
-- and no other. It is ignored by the normal day_of_week/week_number
-- pattern matching entirely.

alter table schedule_slots
  add column if not exists one_off_date date;

comment on column schedule_slots.one_off_date is
  'When set, this slot is a single occurrence on this exact date only — it is never matched by the weekly day_of_week/week_number rotation pattern, only by this specific date.';

-- Helps the calendar quickly find one-off slots for a given org+date
create index if not exists schedule_slots_one_off_date_idx
  on schedule_slots (org_id, one_off_date)
  where one_off_date is not null;
