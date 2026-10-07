-- Forward-only hardening for update policies.
-- Do not edit an applied migration to make these changes.

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
    using (exists (
        select 1 from public.matches m
        where m.id = messages.match_id
          and (auth.uid() = m.user_id_a or auth.uid() = m.user_id_b)
    ))
    with check (exists (
        select 1 from public.matches m
        where m.id = messages.match_id
          and (auth.uid() = m.user_id_a or auth.uid() = m.user_id_b)
    ));

drop policy if exists reports_admin_update on public.reports;
create policy reports_admin_update on public.reports for update to authenticated
    using (
        exists (select 1 from public.admins a where a.user_id = auth.uid())
    )
    with check (
        exists (select 1 from public.admins a where a.user_id = auth.uid())
    );

drop policy if exists vpisnice_update on storage.objects;
create policy vpisnice_update on storage.objects for update to authenticated
    using (
        bucket_id = 'vpisnice' and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
        bucket_id = 'vpisnice' and (storage.foldername(name))[1] = auth.uid()::text
    );
