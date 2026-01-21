-- Create bucket if not exists
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', false)
on conflict (id) do nothing;

-- Policy for objects
-- Allow users to read/write/delete their own folder {user_id}/*

create policy "Users can select own gallery images"
  on storage.objects for select
  using ( bucket_id = 'gallery' and auth.uid()::text = (storage.foldername(name))[1] );

create policy "Users can insert own gallery images"
  on storage.objects for insert
  with check ( bucket_id = 'gallery' and auth.uid()::text = (storage.foldername(name))[1] );

create policy "Users can delete own gallery images"
  on storage.objects for delete
  using ( bucket_id = 'gallery' and auth.uid()::text = (storage.foldername(name))[1] );
