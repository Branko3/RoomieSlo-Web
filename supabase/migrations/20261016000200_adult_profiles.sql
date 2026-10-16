-- RoomieSlo is for university students aged 18 or older (owner decision
-- 2026-10-16). Registration asks every new user to confirm it (stored as
-- `adult_student_confirmed` in the Auth user metadata), and the web profile
-- form accepts ages from 18. This constraint stops any client, Android
-- included, from saving a younger age.
--
-- NOT VALID: existing rows are not re-checked, because the shared project may
-- already hold a profile with an age of 16 or 17, and this migration must not
-- fail or change data silently. New and updated rows are checked. To find
-- older rows, and to validate once none are left:
--   select id, age from public.profiles where age < 18;
--   alter table public.profiles validate constraint profiles_age_adult;
alter table public.profiles drop constraint if exists profiles_age_adult;
alter table public.profiles
    add constraint profiles_age_adult check (age is null or age >= 18) not valid;
