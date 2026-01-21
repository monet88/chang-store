create table if not exists public.images (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  feature text not null,
  storage_path text not null,
  mime_type text,
  width int,
  height int,
  status text default 'active',
  created_at timestamptz default now() not null,
  meta jsonb default '{}'::jsonb
);

create index if not exists images_user_id_created_at_idx on public.images (user_id, created_at desc);

alter table public.images enable row level security;

create policy "Users can view their own images"
  on public.images for select
  using (auth.uid() = user_id);

create policy "Users can insert their own images"
  on public.images for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own images"
  on public.images for delete
  using (auth.uid() = user_id);
