-- Source: RoomieSlo-App/supabase/policies.sql and storage_policies.sql.
-- RLS is the authorization boundary; browser route guards are not sufficient.

create table if not exists public.admins (
    user_id uuid primary key references public.profiles (id) on delete cascade
);

insert into storage.buckets (id, name, public)
values ('vpisnice', 'vpisnice', false)
on conflict (id) do update set public = false;

alter table public.profiles enable row level security;
alter table public.questionnaire_answers enable row level security;
alter table public.listings enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.favorites enable row level security;
alter table public.reports enable row level security;
alter table public.admins enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
    using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists qa_select on public.questionnaire_answers;
create policy qa_select on public.questionnaire_answers for select to authenticated using (true);
drop policy if exists qa_modify on public.questionnaire_answers;
create policy qa_modify on public.questionnaire_answers for all to authenticated
    using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings for select to authenticated using (true);
drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update to authenticated
    using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists listings_delete on public.listings;
create policy listings_delete on public.listings for delete to authenticated using (auth.uid() = owner_id);

drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches for select to authenticated
    using (auth.uid() = user_id_a or auth.uid() = user_id_b);
drop policy if exists matches_insert on public.matches;
create policy matches_insert on public.matches for insert to authenticated with check (auth.uid() = user_id_a);
drop policy if exists matches_update on public.matches;
create policy matches_update on public.matches for update to authenticated
    using (auth.uid() = user_id_a or auth.uid() = user_id_b)
    with check (auth.uid() = user_id_a or auth.uid() = user_id_b);

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (exists (
    select 1 from public.matches m
    where m.id = messages.match_id
      and (auth.uid() = m.user_id_a or auth.uid() = m.user_id_b)
));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
    auth.uid() = sender_id and exists (
        select 1 from public.matches m
        where m.id = match_id and (auth.uid() = m.user_id_a or auth.uid() = m.user_id_b)
    )
);
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated using (exists (
    select 1 from public.matches m
    where m.id = messages.match_id
      and (auth.uid() = m.user_id_a or auth.uid() = m.user_id_b)
));

drop policy if exists favorites_all on public.favorites;
create policy favorites_all on public.favorites for all to authenticated
    using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists admins_self_select on public.admins;
create policy admins_self_select on public.admins for select to authenticated using (auth.uid() = user_id);
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists reports_admin_select on public.reports;
create policy reports_admin_select on public.reports for select to authenticated using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
);
drop policy if exists reports_admin_update on public.reports;
create policy reports_admin_update on public.reports for update to authenticated using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
);

drop policy if exists vpisnice_insert on storage.objects;
create policy vpisnice_insert on storage.objects for insert to authenticated with check (
    bucket_id = 'vpisnice' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists vpisnice_select on storage.objects;
create policy vpisnice_select on storage.objects for select to authenticated using (
    bucket_id = 'vpisnice' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.admins a where a.user_id = auth.uid())
    )
);
drop policy if exists vpisnice_update on storage.objects;
create policy vpisnice_update on storage.objects for update to authenticated using (
    bucket_id = 'vpisnice' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists vpisnice_delete on storage.objects;
create policy vpisnice_delete on storage.objects for delete to authenticated using (
    bucket_id = 'vpisnice' and (storage.foldername(name))[1] = auth.uid()::text
);
