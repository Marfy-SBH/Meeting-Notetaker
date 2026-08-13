-- 1d: the blanket "for all" policy let any workspace member (not just the
-- owner) read plaintext access_token/refresh_token via
-- supabase.from('integrations').select('access_token'). Split it so only
-- the workspace owner can SELECT the raw row; members keep insert/update/
-- delete (connecting/disconnecting/toggling settings stays available to
-- everyone, unchanged from today's product behavior).
drop policy if exists "integrations_all_member" on integrations;

create policy "integrations_select_owner" on integrations for select using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);
create policy "integrations_insert_member" on integrations for insert with check (public.is_workspace_member(workspace_id));
create policy "integrations_update_member" on integrations for update using (public.is_workspace_member(workspace_id));
create policy "integrations_delete_member" on integrations for delete using (public.is_workspace_member(workspace_id));

-- Members still need to see connection status (connected/not connected) and
-- non-secret settings for the Integrations page, just not the raw tokens —
-- this SECURITY DEFINER function hands back only the safe columns.
create function public.get_workspace_integrations(p_workspace_id uuid)
returns table (id uuid, workspace_id uuid, provider text, status text, settings jsonb, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select i.id, i.workspace_id, i.provider, i.status, i.settings, i.created_at
  from integrations i
  where i.workspace_id = p_workspace_id
    and public.is_workspace_member(p_workspace_id);
$$;

grant execute on function public.get_workspace_integrations(uuid) to authenticated;
