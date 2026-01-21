create table if not exists public.drive_tokens (
  user_id uuid references auth.users(id) on delete cascade primary key,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  folder_id text,
  scopes text[],
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.drive_tokens enable row level security;

create policy "Users can manage their own drive tokens"
  on public.drive_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists handle_updated_at on public.drive_tokens;
create trigger handle_updated_at
  before update on public.drive_tokens
  for each row
  execute procedure public.handle_updated_at();
