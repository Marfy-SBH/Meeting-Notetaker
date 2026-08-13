-- 1e: is_workspace_member() is SECURITY DEFINER but had no pinned
-- search_path, unlike handle_new_user() in 0001_init.sql which does set one.
-- Every RLS policy in this project (11 tables + 4 storage.objects policies)
-- depends on this single function, so pin it per the Supabase linter's
-- function_search_path_mutable recommendation.
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer stable set search_path = public;
