-- FYP360 · FYP-1 marks
--
--   Advisor      every class meeting: present/absent + a mark out of 100 for each student
--                advisor marks = average of class marks / 100 × 30
--   Proposal     jury, out of 10
--   Internal     jury, out of 60
--   FYP-1 score  advisor + proposal + internal          (out of 100)
--   FYP-1 final  score / 100 × 40                       (out of 40)
--
-- The weights live in app_settings so the coordinator can change them.
-- Marks are per student. Students see their marks only after the coordinator publishes results;
-- once published, nobody can change FYP-1 marks until they are unpublished.
-- Attendance: each student may miss `fyp1_absence_limit` (2) meetings. The system warns and flags,
-- but only the coordinator removes a student.

insert into public.app_settings (key, value) values
  ('fyp1_weight_advisor', '30'),
  ('fyp1_weight_proposal', '10'),
  ('fyp1_weight_internal', '60'),
  ('fyp1_total', '40'),
  ('fyp1_absent_counts_zero', 'true'),
  ('fyp1_absence_limit', '2'),
  ('fyp1_published', 'false')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- tables

create table public.class_sessions (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  phase      text not null default 'fyp1' check (phase in ('fyp1', 'fyp2')),
  held_on    date not null,
  topic      text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, phase, held_on)
);

create table public.session_attendance (
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  member_id  uuid not null references public.group_members (id) on delete cascade,
  status     text not null check (status in ('present', 'absent')),
  mark       numeric(5, 2) check (mark between 0 and 100),
  primary key (session_id, member_id),
  check (status = 'present' or mark is null)
);
create index session_attendance_member on public.session_attendance (member_id);

create table public.evaluation_marks (
  member_id  uuid not null references public.group_members (id) on delete cascade,
  component  text not null check (component in ('proposal', 'fyp1_internal')),
  marks      numeric(5, 2) check (marks >= 0),
  absent     boolean not null default false,
  entered_by uuid,
  updated_at timestamptz not null default now(),
  primary key (member_id, component),
  check (not absent or marks is null)
);

-- ---------------------------------------------------------------- helpers

create or replace function public.setting_num(p_key text, p_default numeric) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  select value into v from app_settings where key = p_key;
  return coalesce(nullif(trim(v), '')::numeric, p_default);
exception when others then
  return p_default;
end $$;

create or replace function public.fyp1_locked() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value from app_settings where key = 'fyp1_published'), 'false') = 'true'
$$;

create or replace function public.fyp1_absences(p_member_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from session_attendance a join class_sessions s on s.id = a.session_id
  where a.member_id = p_member_id and s.phase = 'fyp1' and a.status = 'absent'
$$;

-- ---------------------------------------------------------------- supervisor: class meetings

-- p_rows: [{"member_id": "...", "status": "present" | "absent", "mark": 0-100 | null}]
create or replace function public.save_class_session(
  p_group_id uuid, p_session_id uuid, p_held_on date, p_topic text, p_rows jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  g record; sid uuid; r jsonb; mid uuid; st text; mk numeric; prev text; n int; who text;
  lim int := setting_num('fyp1_absence_limit', 2)::int;
  had_present boolean := true;
  day text := to_char(p_held_on, 'DD Mon YYYY');
begin
  select * into g from groups where id = p_group_id;
  if g.id is null then raise exception 'Group not found'; end if;
  if not (is_coordinator() or g.supervisor_id = my_profile_id()) then
    raise exception 'Only this group''s supervisor can record its meetings';
  end if;
  if not is_coordinator() and g.status <> 'active' then raise exception 'Group % is %', g.code, g.status; end if;
  if fyp1_locked() then
    raise exception 'FYP-1 results are published. Ask the FYP coordinator to unpublish them before changing marks.';
  end if;
  if p_held_on is null then raise exception 'Choose the meeting date'; end if;
  if p_held_on > current_date then raise exception 'The meeting date cannot be in the future'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Mark attendance for at least one student';
  end if;
  if exists (select 1 from class_sessions where group_id = p_group_id and phase = 'fyp1'
             and held_on = p_held_on and id is distinct from p_session_id) then
    raise exception 'A meeting on % is already recorded for this group', day;
  end if;

  if p_session_id is null then
    insert into class_sessions (group_id, held_on, topic, created_by)
      values (p_group_id, p_held_on, left(trim(coalesce(p_topic, '')), 300), my_profile_id())
      returning id into sid;
  else
    select exists (select 1 from session_attendance where session_id = p_session_id and status = 'present') into had_present;
    update class_sessions set held_on = p_held_on, topic = left(trim(coalesce(p_topic, '')), 300), updated_at = now()
      where id = p_session_id and group_id = p_group_id and phase = 'fyp1'
      returning id into sid;
    if sid is null then raise exception 'Meeting not found'; end if;
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    mid := (r ->> 'member_id')::uuid;
    st  := r ->> 'status';
    mk  := nullif(r ->> 'mark', '')::numeric;
    if not exists (select 1 from group_members where id = mid and group_id = p_group_id) then
      raise exception 'A student in the list is not in this group';
    end if;
    if st is null or st not in ('present', 'absent') then raise exception 'Attendance must be present or absent'; end if;
    if st = 'absent' then mk := null; end if;
    if mk is not null and (mk < 0 or mk > 100) then raise exception 'Class marks must be between 0 and 100'; end if;

    select status into prev from session_attendance where session_id = sid and member_id = mid;
    insert into session_attendance (session_id, member_id, status, mark) values (sid, mid, st, mk)
      on conflict (session_id, member_id) do update set status = excluded.status, mark = excluded.mark;

    if st = 'absent' and prev is distinct from 'absent' then
      n := fyp1_absences(mid);
      select full_name into who from group_members where id = mid;
      if n = lim then
        insert into notifications (group_id, kind, message) values (p_group_id, 'attendance_warning',
          format('%s has missed %s meetings. One more absence means removal from the FYP.', who, n));
      elsif n > lim then
        insert into notifications (group_id, kind, message) values (p_group_id, 'attendance_over_limit',
          format('%s has missed %s meetings, more than the %s allowed. The FYP coordinator will decide what happens next.', who, n, lim));
        insert into audit_log (actor_id, action, target, details)
          values (my_profile_id(), 'attendance.over_limit', g.code, jsonb_build_object('member_id', mid, 'name', who, 'absences', n));
      end if;
    end if;
  end loop;

  -- Students left out of the list are removed from this meeting.
  delete from session_attendance
  where session_id = sid and member_id not in (select (x ->> 'member_id')::uuid from jsonb_array_elements(p_rows) x);

  if had_present and not exists (select 1 from session_attendance where session_id = sid and status = 'present') then
    insert into notifications (group_id, kind, message) values (p_group_id, 'attendance_group_absent',
      format('The whole group was absent from the meeting on %s. A group absence can lead to removal from the FYP.', day));
    insert into audit_log (actor_id, action, target, details)
      values (my_profile_id(), 'attendance.group_absent', g.code, jsonb_build_object('held_on', p_held_on));
  end if;

  insert into audit_log (actor_id, action, target, details)
    values (my_profile_id(), 'marks.session_saved', g.code, jsonb_build_object('held_on', p_held_on, 'new', p_session_id is null));
  return sid;
end $$;

create or replace function public.delete_class_session(p_session_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s record; g record;
begin
  select * into s from class_sessions where id = p_session_id;
  if s.id is null then raise exception 'Meeting not found'; end if;
  select * into g from groups where id = s.group_id;
  if not (is_coordinator() or g.supervisor_id = my_profile_id()) then
    raise exception 'Only this group''s supervisor can delete its meetings';
  end if;
  if fyp1_locked() then
    raise exception 'FYP-1 results are published. Ask the FYP coordinator to unpublish them before changing marks.';
  end if;
  delete from class_sessions where id = p_session_id;
  insert into audit_log (actor_id, action, target, details)
    values (my_profile_id(), 'marks.session_deleted', g.code, jsonb_build_object('held_on', s.held_on));
end $$;

-- ---------------------------------------------------------------- jury: proposal defence + internal evaluation

-- p_rows: [{"member_id": "...", "marks": number | null, "absent": boolean}]
create or replace function public.save_evaluation_marks(p_group_id uuid, p_component text, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare g record; r jsonb; mid uuid; mk numeric; ab boolean; mx numeric;
begin
  select * into g from groups where id = p_group_id;
  if g.id is null then raise exception 'Group not found'; end if;
  if not (is_coordinator() or is_group_jury(p_group_id)) then
    raise exception 'Only this group''s jury can enter evaluation marks';
  end if;
  if not is_coordinator() and g.status <> 'active' then raise exception 'Group % is %', g.code, g.status; end if;
  if fyp1_locked() then
    raise exception 'FYP-1 results are published. Ask the FYP coordinator to unpublish them before changing marks.';
  end if;
  if p_component not in ('proposal', 'fyp1_internal') then raise exception 'Unknown evaluation'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Nothing to save'; end if;

  mx := case p_component when 'proposal' then setting_num('fyp1_weight_proposal', 10)
                         else setting_num('fyp1_weight_internal', 60) end;

  for r in select * from jsonb_array_elements(p_rows) loop
    mid := (r ->> 'member_id')::uuid;
    mk  := nullif(r ->> 'marks', '')::numeric;
    ab  := coalesce((r ->> 'absent')::boolean, false);
    if not exists (select 1 from group_members where id = mid and group_id = p_group_id) then
      raise exception 'A student in the list is not in this group';
    end if;
    if ab then mk := null; end if;
    if mk is not null and (mk < 0 or mk > mx) then raise exception 'Marks must be between 0 and %', mx; end if;

    if mk is null and not ab then
      delete from evaluation_marks where member_id = mid and component = p_component;
    else
      insert into evaluation_marks (member_id, component, marks, absent, entered_by, updated_at)
        values (mid, p_component, mk, ab, my_profile_id(), now())
        on conflict (member_id, component) do update
          set marks = excluded.marks, absent = excluded.absent, entered_by = excluded.entered_by, updated_at = now();
    end if;
  end loop;

  insert into audit_log (actor_id, action, target, details)
    values (my_profile_id(), 'marks.evaluation_saved', g.code, jsonb_build_object('component', p_component));
end $$;

-- ---------------------------------------------------------------- coordinator: publish

create or replace function public.publish_fyp1_results(p_publish boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_coordinator() then raise exception 'Only the FYP coordinator can publish results'; end if;
  insert into app_settings (key, value, updated_at) values ('fyp1_published', case when p_publish then 'true' else 'false' end, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  if p_publish then
    insert into notifications (group_id, kind, message)
      select id, 'results_published', 'FYP-1 results are published. Open Results to see your marks.'
      from groups where status = 'active';
  end if;
  insert into audit_log (actor_id, action, target, details)
    values (my_profile_id(), case when p_publish then 'marks.published' else 'marks.unpublished' end, 'FYP-1', null);
end $$;

-- ---------------------------------------------------------------- group: own record

-- Attendance is always visible; marks only after results are published.
create or replace function public.my_fyp1_record() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare gid uuid := my_group_id(); pub boolean := fyp1_locked();
begin
  if coalesce(my_role(), '') <> 'group' or gid is null then raise exception 'Only a group can open its record'; end if;
  return jsonb_build_object(
    'published', pub,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'group_id', s.group_id, 'phase', s.phase, 'held_on', s.held_on,
                                          'topic', s.topic, 'created_at', s.created_at, 'updated_at', s.updated_at)
                       order by s.held_on)
      from class_sessions s
      where s.phase = 'fyp1' and s.id in (
        select a.session_id from session_attendance a join group_members m on m.id = a.member_id where m.group_id = gid)
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('session_id', a.session_id, 'member_id', a.member_id, 'status', a.status,
                                          'mark', case when pub then a.mark end))
      from session_attendance a join group_members m on m.id = a.member_id where m.group_id = gid
    ), '[]'::jsonb),
    'marks', case when pub then coalesce((
      select jsonb_agg(jsonb_build_object('member_id', e.member_id, 'component', e.component, 'marks', e.marks,
                                          'absent', e.absent, 'updated_at', e.updated_at))
      from evaluation_marks e join group_members m on m.id = e.member_id where m.group_id = gid
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end $$;

-- ---------------------------------------------------------------- read access

alter table public.class_sessions     enable row level security;
alter table public.session_attendance enable row level security;
alter table public.evaluation_marks   enable row level security;

create policy sessions_read on public.class_sessions for select to authenticated
  using (is_coordinator() or is_group_supervisor(group_id));
create policy attendance_read on public.session_attendance for select to authenticated
  using (is_coordinator() or exists (select 1 from public.class_sessions s where s.id = session_id and is_group_supervisor(s.group_id)));
create policy evaluation_read on public.evaluation_marks for select to authenticated
  using (is_coordinator() or exists (select 1 from public.group_members m where m.id = member_id and is_group_jury(m.group_id)));
-- No write policies: every change goes through the functions above. Groups read through my_fyp1_record().

revoke all on function public.save_class_session(uuid, uuid, date, text, jsonb),
                       public.delete_class_session(uuid),
                       public.save_evaluation_marks(uuid, text, jsonb),
                       public.publish_fyp1_results(boolean),
                       public.my_fyp1_record(),
                       public.fyp1_absences(uuid) from public, anon;
grant execute on function public.save_class_session(uuid, uuid, date, text, jsonb),
                          public.delete_class_session(uuid),
                          public.save_evaluation_marks(uuid, text, jsonb),
                          public.publish_fyp1_results(boolean),
                          public.my_fyp1_record() to authenticated;
