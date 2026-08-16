-- ============================================================================
-- 08 · avatar storage
--
-- Path convention: avatars/{member_id}/{filename}.webp
-- The member_id folder is what the write policies key off, so a member can only
-- ever overwrite their own avatar.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/webp','image/png','image/jpeg'])
on conflict (id) do update
  set public             = true,
      file_size_limit    = 2097152,
      allowed_mime_types = array['image/webp','image/png','image/jpeg'];

drop policy if exists avatars_public_read on storage.objects;
drop policy if exists avatars_own_insert  on storage.objects;
drop policy if exists avatars_own_update  on storage.objects;
drop policy if exists avatars_own_delete  on storage.objects;

create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatars_own_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = public.current_member_id()::text
      or public.is_admin()
    )
  );

create policy avatars_own_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = public.current_member_id()::text
      or public.is_admin()
    )
  );

create policy avatars_own_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = public.current_member_id()::text
      or public.is_admin()
    )
  );
