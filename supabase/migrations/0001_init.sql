-- AI Meeting Note Taker — initial schema
-- Note: spec's "users" table maps to `profiles`, extending Supabase's built-in auth.users.

create extension if not exists "pgcrypto";

-- ============ profiles (spec: users) ============
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ============ workspaces ============
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ============ meetings ============
create table meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  created_by uuid not null references profiles (id) on delete cascade,
  title text not null,
  platform text not null default 'in_app' check (platform in ('in_app', 'zoom', 'google_meet', 'other')),
  meeting_link text,
  status text not null default 'idle' check (
    status in ('idle', 'scheduled', 'recording', 'paused', 'uploading', 'processing', 'completed', 'failed', 'cancelled')
  ),
  scheduled_date date,
  scheduled_start_time time,
  scheduled_end_time time,
  timezone text not null default 'UTC',
  reminder_minutes int default 15,
  started_at timestamptz,
  ended_at timestamptz,
  duration int, -- seconds
  recording_url text,
  processing_step text check (
    processing_step in ('saved', 'transcribing', 'summarizing', 'minutes', 'action_items', 'decisions', 'moments', 'done', 'failed')
  ),
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meetings_workspace_idx on meetings (workspace_id, scheduled_date, started_at);

-- ============ participants ============
create table participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  name text not null,
  email text,
  user_id uuid references profiles (id)
);

-- ============ transcript_segments ============
create table transcript_segments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  speaker text not null default 'Speaker 1',
  start_time numeric not null,
  end_time numeric not null,
  text text not null
);

create index transcript_segments_meeting_idx on transcript_segments (meeting_id, start_time);

-- ============ summaries ============
create table summaries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null unique references meetings (id) on delete cascade,
  summary text not null,
  key_points jsonb not null default '[]',
  decisions jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ============ meeting_minutes ============
create table meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null unique references meetings (id) on delete cascade,
  content jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============ action_items ============
create table action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  task text not null,
  assignee text,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  created_at timestamptz not null default now()
);

-- ============ decisions ============
create table decisions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  text text not null,
  timestamp numeric,
  created_at timestamptz not null default now()
);

-- ============ important_moments ============
create table important_moments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  timestamp numeric not null,
  title text not null,
  description text
);

-- ============ calendar_events ============
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  provider text not null default 'google',
  external_event_id text,
  calendar_id text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  timezone text not null default 'UTC',
  sync_status text not null default 'pending' check (sync_status in ('synced', 'pending', 'error'))
);

-- ============ integrations ============
create table integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  provider text not null check (provider in ('google_calendar', 'zoom', 'slack')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  access_token text,
  refresh_token text,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

-- ============ notifications ============
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  meeting_id uuid references meetings (id) on delete cascade,
  type text not null check (
    type in ('meeting_reminder', 'summary_ready', 'action_items_detected', 'calendar_sync', 'processing_failed')
  ),
  title text not null,
  message text not null,
  read boolean not null default false,
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, created_at desc);

-- ============ profile + default workspace auto-create trigger ============
create function public.handle_new_user()
returns trigger as $$
declare
  new_workspace_id uuid;
  display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  insert into public.profiles (id, name, email)
  values (new.id, display_name, new.email);

  insert into public.workspaces (name, owner_id)
  values (display_name || '''s Workspace', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
