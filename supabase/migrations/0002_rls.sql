-- Row Level Security: workspace-scoped access, no cross-user leakage.

alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table meetings enable row level security;
alter table participants enable row level security;
alter table transcript_segments enable row level security;
alter table summaries enable row level security;
alter table meeting_minutes enable row level security;
alter table action_items enable row level security;
alter table decisions enable row level security;
alter table important_moments enable row level security;
alter table calendar_events enable row level security;
alter table integrations enable row level security;
alter table notifications enable row level security;

-- Helper: is the current user a member of this workspace?
create function public.is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- profiles: read own, update own
create policy "profiles_select_own" on profiles for select using (id = auth.uid());
create policy "profiles_update_own" on profiles for update using (id = auth.uid());

-- workspaces: members can read; owner can update/delete
create policy "workspaces_select_member" on workspaces for select using (public.is_workspace_member(id));
create policy "workspaces_update_owner" on workspaces for update using (owner_id = auth.uid());
create policy "workspaces_insert_self" on workspaces for insert with check (owner_id = auth.uid());

-- workspace_members
create policy "members_select_same_workspace" on workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "members_insert_owner" on workspace_members for insert with check (
  exists (select 1 from workspaces where id = workspace_id and owner_id = auth.uid())
);

-- meetings
create policy "meetings_select_member" on meetings for select using (public.is_workspace_member(workspace_id));
create policy "meetings_insert_member" on meetings for insert with check (public.is_workspace_member(workspace_id));
create policy "meetings_update_member" on meetings for update using (public.is_workspace_member(workspace_id));
create policy "meetings_delete_member" on meetings for delete using (public.is_workspace_member(workspace_id));

-- child tables: scoped through meetings.workspace_id
create policy "participants_all_member" on participants for all using (
  exists (select 1 from meetings m where m.id = meeting_id and public.is_workspace_member(m.workspace_id))
);

create policy "transcript_segments_all_member" on transcript_segments for all using (
  exists (select 1 from meetings m where m.id = meeting_id and public.is_workspace_member(m.workspace_id))
);

create policy "summaries_all_member" on summaries for all using (
  exists (select 1 from meetings m where m.id = meeting_id and public.is_workspace_member(m.workspace_id))
);

create policy "minutes_all_member" on meeting_minutes for all using (
  exists (select 1 from meetings m where m.id = meeting_id and public.is_workspace_member(m.workspace_id))
);

create policy "action_items_all_member" on action_items for all using (
  exists (select 1 from meetings m where m.id = meeting_id and public.is_workspace_member(m.workspace_id))
);

create policy "decisions_all_member" on decisions for all using (
  exists (select 1 from meetings m where m.id = meeting_id and public.is_workspace_member(m.workspace_id))
);

create policy "moments_all_member" on important_moments for all using (
  exists (select 1 from meetings m where m.id = meeting_id and public.is_workspace_member(m.workspace_id))
);

create policy "calendar_events_all_member" on calendar_events for all using (public.is_workspace_member(workspace_id));

create policy "integrations_all_member" on integrations for all using (public.is_workspace_member(workspace_id));

-- notifications: strictly per-user
create policy "notifications_select_own" on notifications for select using (user_id = auth.uid());
create policy "notifications_update_own" on notifications for update using (user_id = auth.uid());
create policy "notifications_insert_own" on notifications for insert with check (user_id = auth.uid());

-- Storage: private "recordings" bucket, folder-per-workspace, members only.
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

create policy "recordings_select_member" on storage.objects for select using (
  bucket_id = 'recordings' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

create policy "recordings_insert_member" on storage.objects for insert with check (
  bucket_id = 'recordings' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

create policy "recordings_delete_member" on storage.objects for delete using (
  bucket_id = 'recordings' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);
