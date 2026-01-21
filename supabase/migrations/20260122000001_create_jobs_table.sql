create table if not exists public.jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  feature text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'expired')),
  result_image_path text,
  error text,
  retry_count int default 0,
  next_attempt_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Indexes
create index if not exists jobs_user_id_created_at_idx on public.jobs (user_id, created_at desc);
create index if not exists jobs_status_next_attempt_at_idx on public.jobs (status, next_attempt_at);

-- RLS
alter table public.jobs enable row level security;

create policy "Users can view their own jobs"
  on public.jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own jobs"
  on public.jobs for insert
  with check (auth.uid() = user_id);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists handle_updated_at on public.jobs;
create trigger handle_updated_at
  before update on public.jobs
  for each row
  execute procedure public.handle_updated_at();
