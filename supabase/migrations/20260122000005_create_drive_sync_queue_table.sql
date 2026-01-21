create table if not exists public.drive_sync_queue (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  image_id uuid references public.images(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error text,
  retry_count int default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Indexes
create index if not exists drive_sync_queue_status_idx on public.drive_sync_queue (status);
create index if not exists drive_sync_queue_user_id_idx on public.drive_sync_queue (user_id);

-- RLS
alter table public.drive_sync_queue enable row level security;

create policy "Users can view own sync queue"
  on public.drive_sync_queue for select
  using (auth.uid() = user_id);

-- System might insert? Or edge function?
-- Usually users trigger it, or system triggers it.
-- We'll allow insert for own items.
create policy "Users can insert own sync queue items"
  on public.drive_sync_queue for insert
  with check (auth.uid() = user_id);

drop trigger if exists handle_updated_at on public.drive_sync_queue;
create trigger handle_updated_at
  before update on public.drive_sync_queue
  for each row
  execute procedure public.handle_updated_at();
