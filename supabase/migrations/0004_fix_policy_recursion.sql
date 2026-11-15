-- FYP360 · fix "infinite recursion detected in policy for relation groups".
-- The groups policy looked at group_jury, whose policy looked back at groups.
-- These helpers read the tables directly (security definer), so policies no longer call each other.

create or replace function public.is_group_supervisor(p_group_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups where id = p_group_id and supervisor_id = my_profile_id())
$$;

create or replace function public.is_group_jury(p_group_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_jury where group_id = p_group_id and jury_id = my_profile_id())
$$;

-- Coordinator, the group itself, its supervisor or its jury.
create or replace function public.can_see_group(p_group_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_group_id is not null and (
    is_coordinator() or p_group_id = my_group_id() or is_group_supervisor(p_group_id) or is_group_jury(p_group_id)
  )
$$;

drop policy groups_read on public.groups;
create policy groups_read on public.groups for select to authenticated
  using (can_see_group(id));

drop policy members_read on public.group_members;
create policy members_read on public.group_members for select to authenticated
  using (is_coordinator() or can_see_group(group_id));

drop policy jury_read on public.group_jury;
create policy jury_read on public.group_jury for select to authenticated
  using (can_see_group(group_id));

drop policy proposals_read on public.proposals;
create policy proposals_read on public.proposals for select to authenticated
  using (can_see_group(group_id));

drop policy proposal_events_read on public.proposal_events;
create policy proposal_events_read on public.proposal_events for select to authenticated
  using (is_coordinator() or group_id = my_group_id() or is_group_supervisor(group_id));
