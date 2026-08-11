-- The recording upload does an upsert (retrying a failed upload re-uploads to
-- the same path), which needs UPDATE-level storage permission on top of the
-- existing INSERT policy — without it, every retry fails with an RLS error.
create policy "recordings_update_member" on storage.objects for update using (
  bucket_id = 'recordings' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);
