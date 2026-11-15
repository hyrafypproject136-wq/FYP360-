-- FYP360 · Proposal workflow
--
--   Group writes 3 ideas ──submit──▶ Supervisor reviews ──endorse──▶ Coordinator decides ──approve──▶ Official project
--          ▲                               │ revision                       │ revision
--          └───────────────────────────────┴────────────────────────────────┘
--
-- Every change goes through the functions below, so nobody can skip a step
-- (a group cannot approve itself; a supervisor can only review their own groups).

alter table public.groups
  add column proposal_status text not null default 'not_started'
    check (proposal_status in ('not_started', 'draft', 'submitted', 'revision_requested', 'supervisor_endorsed', 'approved')),
  add column approved_proposal_id uuid;

create table public.proposals (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups (id) on delete cascade,
  slot             int  not null check (slot between 1 and 3),
  title            text not null default '',
  summary          text not null default '',
  objectives       text not null default '',
  outcomes         text not null default '',
  project_type     text not null default '',
  domain           text not null default '',
  tech_stack       text[] not null default '{}',
  supervisor_note  text,
  recommended      boolean not null default false,
  updated_at       timestamptz not null default now(),
  unique (group_id, slot)
);

alter table public.groups
  add constraint groups_approved_proposal_fk foreign key (approved_proposal_id) references public.proposals (id) on delete set null;

create table public.proposal_events (
  id         bigint generated always as identity primary key,
  group_id   uuid not null references public.groups (id) on delete cascade,
  actor_id   uuid,
  actor_role text not null,
  action     text not null,   -- saved | submitted | revision_requested | endorsed | approved
  comment    text,
  created_at timestamptz not null default now()
);
create index proposal_events_group on public.proposal_events (group_id, created_at desc);

-- ---------------------------------------------------------------- helpers

create or replace function public.proposal_complete(p public.proposals) returns boolean
language sql immutable as $$
  select length(trim(p.title)) >= 5
     and length(trim(p.summary)) >= 50
     and length(trim(p.objectives)) >= 10
     and length(trim(p.outcomes)) >= 10
     and p.project_type <> ''
     and p.domain <> ''
$$;

-- Record a step: history row, admin activity log, and a notice for the group.
create or replace function public.log_proposal_step(p_group_id uuid, p_role text, p_action text, p_comment text, p_notice text)
returns void language plpgsql security definer set search_path = public as $$
declare g record;
begin
  select code into g from groups where id = p_group_id;
  insert into proposal_events (group_id, actor_id, actor_role, action, comment)
    values (p_group_id, coalesce(my_profile_id(), auth.uid()), p_role, p_action, nullif(trim(p_comment), ''));
  insert into audit_log (actor_id, action, target, details)
    values (coalesce(my_profile_id(), auth.uid()), 'proposal.' || p_action, g.code, jsonb_build_object('comment', nullif(trim(p_comment), '')));
  if p_notice is not null then
    insert into notifications (group_id, kind, message) values (p_group_id, 'proposal_' || p_action, p_notice);
  end if;
end $$;

-- ---------------------------------------------------------------- group actions

create or replace function public.save_proposal(
  p_slot int, p_title text, p_summary text, p_objectives text, p_outcomes text,
  p_project_type text, p_domain text, p_tech_stack text[]
) returns void language plpgsql security definer set search_path = public as $$
declare gid uuid := my_group_id(); g record;
begin
  if coalesce(my_role(), '') <> 'group' or gid is null then raise exception 'Only a group can write proposals'; end if;
  select * into g from groups where id = gid;
  if g.status <> 'active' then raise exception 'Your group is %', g.status; end if;
  if g.proposal_status not in ('not_started', 'draft', 'revision_requested') then
    raise exception 'Proposals cannot be edited while they are %', replace(g.proposal_status, '_', ' ');
  end if;
  if p_slot not between 1 and 3 then raise exception 'Proposal number must be 1, 2 or 3'; end if;

  insert into proposals (group_id, slot, title, summary, objectives, outcomes, project_type, domain, tech_stack, updated_at)
  values (gid, p_slot, left(trim(p_title), 200), left(trim(p_summary), 4000), left(trim(p_objectives), 4000),
          left(trim(p_outcomes), 4000), coalesce(p_project_type, ''), left(trim(coalesce(p_domain, '')), 120),
          coalesce(p_tech_stack, '{}'), now())
  on conflict (group_id, slot) do update set
    title = excluded.title, summary = excluded.summary, objectives = excluded.objectives, outcomes = excluded.outcomes,
    project_type = excluded.project_type, domain = excluded.domain, tech_stack = excluded.tech_stack, updated_at = now();

  if g.proposal_status = 'not_started' then
    update groups set proposal_status = 'draft' where id = gid;
  end if;
end $$;

create or replace function public.submit_proposals() returns void
language plpgsql security definer set search_path = public as $$
declare gid uuid := my_group_id(); g record; n int;
begin
  if coalesce(my_role(), '') <> 'group' or gid is null then raise exception 'Only a group can submit proposals'; end if;
  select * into g from groups where id = gid for update;
  if g.status <> 'active' then raise exception 'Your group is %', g.status; end if;
  if g.proposal_status not in ('draft', 'revision_requested') then
    raise exception 'Proposals are already %', replace(g.proposal_status, '_', ' ');
  end if;
  select count(*) into n from proposals p where p.group_id = gid and proposal_complete(p);
  if n < 3 then raise exception 'Complete all three proposals first (% of 3 complete)', n; end if;
  if g.supervisor_id is null then
    raise exception 'Your supervisor has not been assigned yet. Ask the FYP coordinator.';
  end if;

  update groups set proposal_status = 'submitted' where id = gid;
  update proposals set recommended = false where group_id = gid;
  perform log_proposal_step(gid, 'group', 'submitted', null, 'Your three proposals were sent to your supervisor for review.');
end $$;

-- ---------------------------------------------------------------- supervisor action

-- p_notes: {"1": "note for idea 1", "2": "...", "3": "..."}
create or replace function public.supervisor_review_proposals(
  p_group_id uuid, p_decision text, p_recommended_slot int, p_comment text, p_notes jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare g record;
begin
  select * into g from groups where id = p_group_id for update;
  if g.id is null then raise exception 'Group not found'; end if;
  if g.supervisor_id is distinct from my_profile_id() then raise exception 'Only this group''s supervisor can review its proposals'; end if;
  if g.proposal_status <> 'submitted' then raise exception 'These proposals are not waiting for your review'; end if;
  if p_decision not in ('endorse', 'revision') then raise exception 'Decision must be endorse or revision'; end if;
  if p_decision = 'revision' and coalesce(trim(p_comment), '') = '' then
    raise exception 'Tell the group what to change';
  end if;
  if p_decision = 'endorse' and (p_recommended_slot is null or p_recommended_slot not between 1 and 3) then
    raise exception 'Choose the idea you recommend';
  end if;

  update proposals set
    supervisor_note = nullif(trim(coalesce(p_notes ->> slot::text, '')), ''),
    recommended = (p_decision = 'endorse' and slot = p_recommended_slot)
  where group_id = p_group_id;

  if p_decision = 'endorse' then
    update groups set proposal_status = 'supervisor_endorsed' where id = p_group_id;
    perform log_proposal_step(p_group_id, 'supervisor', 'endorsed', p_comment,
      format('Your supervisor recommended proposal %s and sent it to the FYP coordinator for approval.', p_recommended_slot));
  else
    update groups set proposal_status = 'revision_requested' where id = p_group_id;
    perform log_proposal_step(p_group_id, 'supervisor', 'revision_requested', p_comment,
      'Your supervisor asked for changes to your proposals: ' || trim(p_comment));
  end if;
end $$;

-- ---------------------------------------------------------------- coordinator action

create or replace function public.coordinator_decide_proposals(
  p_group_id uuid, p_decision text, p_proposal_id uuid, p_comment text
) returns void language plpgsql security definer set search_path = public as $$
declare g record; p record;
begin
  if not is_coordinator() then raise exception 'Only the FYP coordinator can approve proposals'; end if;
  select * into g from groups where id = p_group_id for update;
  if g.id is null then raise exception 'Group not found'; end if;
  if g.status <> 'active' then raise exception 'Group % is %', g.code, g.status; end if;
  if g.proposal_status not in ('supervisor_endorsed', 'submitted') then
    raise exception 'Proposals of % are % and cannot be decided now', g.code, replace(g.proposal_status, '_', ' ');
  end if;

  if p_decision = 'approve' then
    select * into p from proposals where id = p_proposal_id and group_id = p_group_id;
    if p.id is null then raise exception 'Choose one of this group''s proposals'; end if;
    update groups set proposal_status = 'approved', approved_proposal_id = p.id where id = p_group_id;
    perform log_proposal_step(p_group_id, 'coordinator', 'approved', p_comment,
      format('Proposal %s "%s" is approved. It is now your official FYP.', p.slot, p.title));
  elsif p_decision = 'revision' then
    if coalesce(trim(p_comment), '') = '' then raise exception 'Tell the group what to change'; end if;
    update groups set proposal_status = 'revision_requested' where id = p_group_id;
    update proposals set recommended = false where group_id = p_group_id;
    perform log_proposal_step(p_group_id, 'coordinator', 'revision_requested', p_comment,
      'The FYP coordinator asked for changes to your proposals: ' || trim(p_comment));
  else
    raise exception 'Decision must be approve or revision';
  end if;
end $$;

-- ---------------------------------------------------------------- read access

alter table public.proposals       enable row level security;
alter table public.proposal_events enable row level security;

create policy proposals_read on public.proposals for select to authenticated
  using (
    is_coordinator()
    or group_id = my_group_id()
    or exists (select 1 from public.groups g where g.id = proposals.group_id and g.supervisor_id = my_profile_id())
    or exists (select 1 from public.group_jury j where j.group_id = proposals.group_id and j.jury_id = my_profile_id())
  );

create policy proposal_events_read on public.proposal_events for select to authenticated
  using (
    is_coordinator()
    or group_id = my_group_id()
    or exists (select 1 from public.groups g where g.id = proposal_events.group_id and g.supervisor_id = my_profile_id())
  );
-- No insert/update/delete policies: writes happen only through the functions above.

revoke all on function public.log_proposal_step(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.save_proposal(int, text, text, text, text, text, text, text[]),
                       public.submit_proposals(),
                       public.supervisor_review_proposals(uuid, text, int, text, jsonb),
                       public.coordinator_decide_proposals(uuid, text, uuid, text) from public, anon;
grant execute on function public.save_proposal(int, text, text, text, text, text, text, text[]),
                          public.submit_proposals(),
                          public.supervisor_review_proposals(uuid, text, int, text, jsonb),
                          public.coordinator_decide_proposals(uuid, text, uuid, text) to authenticated;
