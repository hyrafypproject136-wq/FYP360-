-- FYP360 · the rest of the FYP journey
--
--   Proposal defence ─▶ FYP-1 (meetings, submissions, declaration, internal eval) ─▶ publish FYP-1
--   ─▶ FYP-2 (meetings, submissions, declaration, internal eval, external eval) ─▶ publish FYP-2 ─▶ final result
--
--   FYP-2 /60 = advisor (FYP-2 class average ÷ 100 × 10) + internal /30 + external /20
--   Final /100 = FYP-1 /40 + FYP-2 /60.  Pass = final ≥ 60 and FYP-2 ≥ 60 % of its marks.
--
-- Also: deliverables with deadlines and file uploads (late uploads are blocked; a supervisor's
-- "changes requested" or a coordinator extension reopens them), change requests (group → jury →
-- coordinator), announcements, supervisor declarations, and the 89-credit-hour eligibility flag.

insert into public.app_settings (key, value) values
  ('current_phase', 'fyp1'),
  ('fyp2_weight_advisor', '10'),
  ('fyp2_weight_internal', '30'),
  ('fyp2_weight_external', '20'),
  ('fyp2_total', '60'),
  ('fyp2_published', 'false'),
  ('pass_mark', '60'),
  ('eligibility_credit_hours', '89')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- phase helpers

create or replace function public.current_phase() returns text
language sql stable security definer set search_path = public as $$
  select case when (select value from app_settings where key = 'current_phase') = 'fyp2' then 'fyp2' else 'fyp1' end
$$;

create or replace function public.phase_locked(p_phase text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value from app_settings where key = p_phase || '_published'), 'false') = 'true'
$$;

create or replace function public.component_phase(p_component text) returns text
language sql immutable as $$
  select case when p_component in ('proposal', 'fyp1_internal') then 'fyp1' else 'fyp2' end
$$;

create or replace function public.phase_absences(p_member_id uuid, p_phase text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from session_attendance a join class_sessions s on s.id = a.session_id
  where a.member_id = p_member_id and s.phase = p_phase and a.status = 'absent'
$$;

create or replace function public.locked_message(p_phase text) returns text
language sql immutable as $$
  select upper(replace(p_phase, 'fyp', 'FYP-')) || ' results are published. Ask the FYP coordinator to unpublish them before changing marks.'
$$;

-- ---------------------------------------------------------------- meetings now follow the current phase

create or replace function public.save_class_session(
  p_group_id uuid, p_session_id uuid, p_held_on date, p_topic text, p_rows jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  g record; sid uuid; r jsonb; mid uuid; st text; mk numeric; prev text; n int; who text;
  ph text;
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

  if p_session_id is null then
    ph := current_phase();
  else
    select phase into ph from class_sessions where id = p_session_id and group_id = p_group_id;
    if ph is null then raise exception 'Meeting not found'; end if;
  end if;
  if phase_locked(ph) then raise exception '%', locked_message(ph); end if;
  if p_held_on is null then raise exception 'Choose the meeting date'; end if;
  if p_held_on > current_date then raise exception 'The meeting date cannot be in the future'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Mark attendance for at least one student';
  end if;
  if exists (select 1 from class_sessions where group_id = p_group_id and phase = ph
             and held_on = p_held_on and id is distinct from p_session_id) then
    raise exception 'A meeting on % is already recorded for this group', day;
  end if;

  if p_session_id is null then
    insert into class_sessions (group_id, phase, held_on, topic, created_by)
      values (p_group_id, ph, p_held_on, left(trim(coalesce(p_topic, '')), 300), my_profile_id())
      returning id into sid;
  else
    select exists (select 1 from session_attendance where session_id = p_session_id and status = 'present') into had_present;
    update class_sessions set held_on = p_held_on, topic = left(trim(coalesce(p_topic, '')), 300), updated_at = now()
      where id = p_session_id returning id into sid;
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
      n := phase_absences(mid, ph);
      select full_name into who from group_members where id = mid;
      if n = lim then
        insert into notifications (group_id, kind, message) values (p_group_id, 'attendance_warning',
          format('%s has missed %s meetings this semester. One more absence means removal from the FYP.', who, n));
      elsif n > lim then
        insert into notifications (group_id, kind, message) values (p_group_id, 'attendance_over_limit',
          format('%s has missed %s meetings, more than the %s allowed. The FYP coordinator will decide what happens next.', who, n, lim));
        insert into audit_log (actor_id, action, target, details)
          values (my_profile_id(), 'attendance.over_limit', g.code, jsonb_build_object('member_id', mid, 'name', who, 'absences', n));
      end if;
    end if;
  end loop;

  delete from session_attendance
  where session_id = sid and member_id not in (select (x ->> 'member_id')::uuid from jsonb_array_elements(p_rows) x);

  if had_present and not exists (select 1 from session_attendance where session_id = sid and status = 'present') then
    insert into notifications (group_id, kind, message) values (p_group_id, 'attendance_group_absent',
      format('The whole group was absent from the meeting on %s. A group absence can lead to removal from the FYP.', day));
    insert into audit_log (actor_id, action, target, details)
      values (my_profile_id(), 'attendance.group_absent', g.code, jsonb_build_object('held_on', p_held_on));
  end if;

  insert into audit_log (actor_id, action, target, details)
    values (my_profile_id(), 'marks.session_saved', g.code, jsonb_build_object('held_on', p_held_on, 'new', p_session_id is null, 'phase', ph));
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
  if phase_locked(s.phase) then raise exception '%', locked_message(s.phase); end if;
  delete from class_sessions where id = p_session_id;
  insert into audit_log (actor_id, action, target, details)
    values (my_profile_id(), 'marks.session_deleted', g.code, jsonb_build_object('held_on', s.held_on, 'phase', s.phase));
end $$;

-- ---------------------------------------------------------------- evaluation marks for both phases

alter table public.evaluation_marks drop constraint evaluation_marks_component_check;
alter table public.evaluation_marks add constraint evaluation_marks_component_check
  check (component in ('proposal', 'fyp1_internal', 'fyp2_internal', 'external'));

-- Jury: proposal, FYP-1 internal, FYP-2 internal. External (industry experts) is entered by the coordinator.
create or replace function public.save_evaluation_marks(p_group_id uuid, p_component text, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare g record; r jsonb; mid uuid; mk numeric; ab boolean; mx numeric; ph text := component_phase(p_component);
begin
  select * into g from groups where id = p_group_id;
  if g.id is null then raise exception 'Group not found'; end if;
  if p_component not in ('proposal', 'fyp1_internal', 'fyp2_internal', 'external') then raise exception 'Unknown evaluation'; end if;
  if p_component = 'external' and not is_coordinator() then
    raise exception 'Only the FYP coordinator enters external evaluation marks';
  end if;
  if not (is_coordinator() or is_group_jury(p_group_id)) then
    raise exception 'Only this group''s jury can enter evaluation marks';
  end if;
  if not is_coordinator() and g.status <> 'active' then raise exception 'Group % is %', g.code, g.status; end if;
  if phase_locked(ph) then raise exception '%', locked_message(ph); end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Nothing to save'; end if;

  mx := case p_component
          when 'proposal'      then setting_num('fyp1_weight_proposal', 10)
          when 'fyp1_internal' then setting_num('fyp1_weight_internal', 60)
          when 'fyp2_internal' then setting_num('fyp2_weight_internal', 30)
          else                      setting_num('fyp2_weight_external', 20) end;

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

drop function public.publish_fyp1_results(boolean);
create or replace function public.publish_results(p_phase text, p_publish boolean) returns void
language plpgsql security definer set search_path = public as $$
declare label text;
begin
  if not is_coordinator() then raise exception 'Only the FYP coordinator can publish results'; end if;
  if p_phase not in ('fyp1', 'fyp2') then raise exception 'Unknown phase'; end if;
  label := upper(replace(p_phase, 'fyp', 'FYP-'));
  insert into app_settings (key, value, updated_at) values (p_phase || '_published', case when p_publish then 'true' else 'false' end, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  if p_publish then
    insert into notifications (group_id, kind, message)
      select id, 'results_published', label || ' results are published. Open Results to see your marks.'
      from groups where status = 'active';
  end if;
  insert into audit_log (actor_id, action, target, details)
    values (my_profile_id(), case when p_publish then 'marks.published' else 'marks.unpublished' end, label, jsonb_build_object('phase', p_phase));
end $$;

-- ---------------------------------------------------------------- supervisor declarations

create table public.group_declarations (
  group_id  uuid not null references public.groups (id) on delete cascade,
  phase     text not null check (phase in ('fyp1', 'fyp2')),
  signed_by uuid,
  signed_at timestamptz not null default now(),
  primary key (group_id, phase)
);

create or replace function public.set_declaration(p_group_id uuid, p_phase text, p_signed boolean) returns void
language plpgsql security definer set search_path = public as $$
declare g record; label text := upper(replace(p_phase, 'fyp', 'FYP-'));
begin
  select * into g from groups where id = p_group_id;
  if g.id is null then raise exception 'Group not found'; end if;
  if not (is_coordinator() or g.supervisor_id = my_profile_id()) then
    raise exception 'Only this group''s supervisor can sign its declaration';
  end if;
  if p_phase not in ('fyp1', 'fyp2') then raise exception 'Unknown phase'; end if;
  if phase_locked(p_phase) then raise exception '%', locked_message(p_phase); end if;
  if p_signed then
    insert into group_declarations (group_id, phase, signed_by) values (p_group_id, p_phase, my_profile_id())
      on conflict (group_id, phase) do update set signed_by = excluded.signed_by, signed_at = now();
    insert into notifications (group_id, kind, message) values (p_group_id, 'declaration_signed',
      format('Your supervisor signed the %s declaration.', label));
  else
    delete from group_declarations where group_id = p_group_id and phase = p_phase;
    insert into notifications (group_id, kind, message) values (p_group_id, 'declaration_withdrawn',
      format('Your supervisor withdrew the %s declaration.', label));
  end if;
  insert into audit_log (actor_id, action, target, details)
    values (my_profile_id(), case when p_signed then 'declaration.signed' else 'declaration.withdrawn' end, g.code, jsonb_build_object('phase', p_phase));
end $$;

-- ---------------------------------------------------------------- deliverables and submissions

create table public.deliverables (
  id          uuid primary key default gen_random_uuid(),
  phase       text not null check (phase in ('fyp1', 'fyp2')),
  title       text not null check (length(trim(title)) between 3 and 120),
  description text not null default '',
  kind        text not null default 'document' check (kind in ('document', 'video')),
  due_at      timestamptz not null,
  created_at  timestamptz not null default now()
);

create table public.deliverable_extensions (
  deliverable_id uuid not null references public.deliverables (id) on delete cascade,
  group_id       uuid not null references public.groups (id) on delete cascade,
  due_at         timestamptz not null,
  primary key (deliverable_id, group_id)
);

create table public.submissions (
  id             uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables (id) on delete restrict,
  group_id       uuid not null references public.groups (id) on delete cascade,
  version        int  not null,
  file_path      text not null unique,
  file_name      text not null,
  file_size      bigint not null,
  mime_type      text not null,
  submitted_at   timestamptz not null default now(),
  status         text not null default 'submitted' check (status in ('submitted', 'approved', 'changes_requested')),
  feedback       text,
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  unique (deliverable_id, group_id, version)
);
create index submissions_group on public.submissions (group_id, deliverable_id, version desc);

create trigger audit_deliverables after insert or update or delete on public.deliverables for each row execute function public.audit_row();
create trigger audit_deliverable_extensions after insert or update or delete on public.deliverable_extensions for each row execute function public.audit_row();

-- When the signed-in group may upload to a deliverable. Returns null when allowed, otherwise the reason.
create or replace function public.upload_blocked_reason(p_deliverable_id uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare gid uuid := my_group_id(); g record; d record; due timestamptz; last record;
begin
  if coalesce(my_role(), '') <> 'group' or gid is null then return 'Only a group can upload'; end if;
  select * into g from groups where id = gid;
  if g.status <> 'active' then return format('Your group is %s', g.status); end if;
  select * into d from deliverables where id = p_deliverable_id;
  if d.id is null then return 'Deliverable not found'; end if;
  select coalesce((select e.due_at from deliverable_extensions e where e.deliverable_id = d.id and e.group_id = gid), d.due_at) into due;
  select * into last from submissions where deliverable_id = d.id and group_id = gid order by version desc limit 1;
  if last.status = 'approved' then return 'Your supervisor already approved this work'; end if;
  if last.status = 'submitted' then return 'Your last upload is waiting for your supervisor'; end if;
  if last.status = 'changes_requested' then return null; end if;   -- changes requested: re-upload is always allowed
  if now() > due then return 'The deadline has passed. Ask the FYP coordinator for an extension.'; end if;
  return null;
end $$;

create or replace function public.can_upload(p_deliverable_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select upload_blocked_reason(p_deliverable_id) is null
$$;

-- Called after the file is in storage: checks it and records a new version.
create or replace function public.record_submission(p_deliverable_id uuid, p_path text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  gid uuid := my_group_id(); g record; d record; o record; why text; v int; sid uuid;
  sz bigint; mt text;
  doc_types text[] := array['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip',
    'application/x-zip-compressed', 'image/png', 'image/jpeg'];
  video_types text[] := array['video/mp4', 'video/quicktime'];
begin
  why := upload_blocked_reason(p_deliverable_id);
  if why is not null then raise exception '%', why; end if;
  select * into g from groups where id = gid;
  select * into d from deliverables where id = p_deliverable_id;
  if p_path not like gid::text || '/' || d.id::text || '/%' then raise exception 'Wrong upload location'; end if;
  select * into o from storage.objects where bucket_id = 'submissions' and name = p_path;
  if o.id is null then raise exception 'The file did not finish uploading. Try again.'; end if;
  sz := coalesce((o.metadata ->> 'size')::bigint, 0);
  mt := coalesce(o.metadata ->> 'mimetype', '');
  if d.kind = 'video' then
    if not mt = any (video_types) then raise exception 'Upload an MP4 or MOV video'; end if;
    if sz > 50 * 1024 * 1024 then raise exception 'Videos can be at most 50 MB'; end if;
  else
    if not mt = any (doc_types) then raise exception 'Upload a PDF, Word, PowerPoint, ZIP, PNG or JPG file'; end if;
    if sz > 20 * 1024 * 1024 then raise exception 'Files can be at most 20 MB'; end if;
  end if;

  select coalesce(max(version), 0) + 1 into v from submissions where deliverable_id = d.id and group_id = gid;
  insert into submissions (deliverable_id, group_id, version, file_path, file_name, file_size, mime_type)
    values (d.id, gid, v, p_path, left(coalesce(nullif(trim(p_name), ''), 'file'), 200), sz, mt)
    returning id into sid;
  insert into notifications (group_id, kind, message) values (gid, 'submission_uploaded',
    format('"%s" was uploaded (version %s). Your supervisor will review it.', d.title, v));
  insert into audit_log (actor_id, action, target, details)
    values (auth.uid(), 'submission.uploaded', g.code, jsonb_build_object('title', d.title, 'version', v));
  return sid;
end $$;

create or replace function public.review_submission(p_submission_id uuid, p_decision text, p_feedback text) returns void
language plpgsql security definer set search_path = public as $$
declare s record; g record; d record; latest int;
begin
  select * into s from submissions where id = p_submission_id for update;
  if s.id is null then raise exception 'Submission not found'; end if;
  select * into g from groups where id = s.group_id;
  select * into d from deliverables where id = s.deliverable_id;
  if not (is_coordinator() or g.supervisor_id = my_profile_id()) then
    raise exception 'Only this group''s supervisor can review its work';
  end if;
  select max(version) into latest from submissions where deliverable_id = s.deliverable_id and group_id = s.group_id;
  if s.version <> latest then raise exception 'A newer version exists. Review the latest one.'; end if;
  if s.status <> 'submitted' then raise exception 'This version was already reviewed'; end if;
  if p_decision not in ('approve', 'changes') then raise exception 'Decision must be approve or changes'; end if;
  if p_decision = 'changes' and coalesce(trim(p_feedback), '') = '' then raise exception 'Tell the group what to change'; end if;

  update submissions set status = case when p_decision = 'approve' then 'approved' else 'changes_requested' end,
    feedback = nullif(trim(p_feedback), ''), reviewed_by = my_profile_id(), reviewed_at = now()
  where id = s.id;
  insert into notifications (group_id, kind, message) values (s.group_id,
    case when p_decision = 'approve' then 'submission_approved' else 'submission_changes' end,
    case when p_decision = 'approve' then format('Your supervisor approved "%s".', d.title)
         else format('Your supervisor asked for changes to "%s": %s', d.title, trim(p_feedback)) end);
  insert into audit_log (actor_id, action, target, details)
    values (my_profile_id(), case when p_decision = 'approve' then 'submission.approved' else 'submission.changes' end, g.code,
            jsonb_build_object('title', d.title, 'version', s.version));
end $$;

-- Storage: private bucket, files under <group id>/<deliverable id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 52428800, array[
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-zip-compressed', 'image/png', 'image/jpeg', 'video/mp4', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_group_id(p_name text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create or replace function public.storage_deliverable_id(p_name text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 2)::uuid;
exception when others then
  return null;
end $$;

create policy submissions_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions'
              and public.storage_group_id(name) = public.my_group_id()
              and public.can_upload(public.storage_deliverable_id(name)));
create policy submissions_read on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and public.can_see_group(public.storage_group_id(name)));

-- ---------------------------------------------------------------- change requests

create table public.change_requests (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  title         text not null,
  details       text not null,
  status        text not null default 'pending_jury'
                check (status in ('pending_jury', 'pending_coordinator', 'approved', 'rejected')),
  jury_by       uuid,
  jury_comment  text,
  jury_at       timestamptz,
  coord_by      uuid,
  coord_comment text,
  coord_at      timestamptz,
  created_at    timestamptz not null default now()
);
create index change_requests_group on public.change_requests (group_id, created_at desc);

create or replace function public.create_change_request(p_title text, p_details text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid := my_group_id(); g record; cid uuid;
begin
  if coalesce(my_role(), '') <> 'group' or gid is null then raise exception 'Only a group can ask for a change'; end if;
  select * into g from groups where id = gid;
  if g.status <> 'active' then raise exception 'Your group is %', g.status; end if;
  if length(trim(coalesce(p_title, ''))) < 5 then raise exception 'Give the change a short title (at least 5 characters)'; end if;
  if length(trim(coalesce(p_details, ''))) < 30 then raise exception 'Explain the change and why you need it (at least 30 characters)'; end if;
  if not exists (select 1 from group_jury where group_id = gid) then
    raise exception 'Your jury has not been assigned yet. Ask the FYP coordinator.';
  end if;
  if exists (select 1 from change_requests where group_id = gid and status in ('pending_jury', 'pending_coordinator')) then
    raise exception 'You already have a change request waiting for a decision';
  end if;
  insert into change_requests (group_id, title, details) values (gid, left(trim(p_title), 150), left(trim(p_details), 4000))
    returning id into cid;
  insert into notifications (group_id, kind, message) values (gid, 'change_requested',
    format('Your change request "%s" was sent to your jury.', trim(p_title)));
  insert into audit_log (actor_id, action, target, details)
    values (auth.uid(), 'change.requested', g.code, jsonb_build_object('title', trim(p_title)));
  return cid;
end $$;

-- Written approval: the comment is required either way.
create or replace function public.decide_change_request(p_id uuid, p_approve boolean, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare c record; g record;
begin
  select * into c from change_requests where id = p_id for update;
  if c.id is null then raise exception 'Change request not found'; end if;
  select * into g from groups where id = c.group_id;
  if coalesce(trim(p_comment), '') = '' then raise exception 'Write your decision in the comment box'; end if;

  if c.status = 'pending_jury' then
    if not (is_group_jury(c.group_id) or is_coordinator()) then raise exception 'Only this group''s jury can decide now'; end if;
    update change_requests set status = case when p_approve then 'pending_coordinator' else 'rejected' end,
      jury_by = my_profile_id(), jury_comment = trim(p_comment), jury_at = now() where id = p_id;
    insert into notifications (group_id, kind, message) values (c.group_id,
      case when p_approve then 'change_jury_approved' else 'change_rejected' end,
      case when p_approve then format('The jury approved your change request "%s". It now goes to the FYP coordinator.', c.title)
           else format('The jury rejected your change request "%s": %s', c.title, trim(p_comment)) end);
    insert into audit_log (actor_id, action, target, details)
      values (my_profile_id(), case when p_approve then 'change.jury_approved' else 'change.rejected' end, g.code, jsonb_build_object('title', c.title));
  elsif c.status = 'pending_coordinator' then
    if not is_coordinator() then raise exception 'Only the FYP coordinator can decide now'; end if;
    update change_requests set status = case when p_approve then 'approved' else 'rejected' end,
      coord_by = my_profile_id(), coord_comment = trim(p_comment), coord_at = now() where id = p_id;
    insert into notifications (group_id, kind, message) values (c.group_id,
      case when p_approve then 'change_approved' else 'change_rejected' end,
      case when p_approve then format('Your change request "%s" is approved.', c.title)
           else format('The FYP coordinator rejected your change request "%s": %s', c.title, trim(p_comment)) end);
    insert into audit_log (actor_id, action, target, details)
      values (my_profile_id(), case when p_approve then 'change.approved' else 'change.rejected' end, g.code, jsonb_build_object('title', c.title));
  else
    raise exception 'This change request is already decided';
  end if;
end $$;

-- ---------------------------------------------------------------- announcements

create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(trim(title)) between 3 and 150),
  body       text not null check (length(trim(body)) between 1 and 5000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function public.announce_to_groups() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (group_id, kind, message)
    select id, 'announcement', 'Announcement: ' || new.title from groups where status = 'active';
  insert into audit_log (actor_id, action, target, details)
    values (auth.uid(), 'announcement.posted', left(new.title, 150), null);
  return new;
end $$;
create trigger announcements_notify after insert on public.announcements for each row execute function public.announce_to_groups();

-- ---------------------------------------------------------------- eligibility, proposal abstract and APIs

alter table public.group_members add column eligible boolean not null default true;
alter table public.proposals add column apis text not null default '';

create or replace function public.word_count(t text) returns int
language sql immutable as $$
  select case when trim(coalesce(t, '')) = '' then 0 else array_length(regexp_split_to_array(trim(t), '\s+'), 1) end
$$;

create or replace function public.proposal_complete(p public.proposals) returns boolean
language sql immutable as $$
  select length(trim(p.title)) >= 5
     and word_count(p.summary) between 200 and 250
     and length(trim(p.objectives)) >= 10
     and length(trim(p.outcomes)) >= 10
     and length(trim(p.apis)) >= 2
     and p.project_type <> ''
     and p.domain <> ''
$$;

drop function public.save_proposal(int, text, text, text, text, text, text, text[]);
create or replace function public.save_proposal(
  p_slot int, p_title text, p_summary text, p_objectives text, p_outcomes text,
  p_project_type text, p_domain text, p_tech_stack text[], p_apis text
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

  insert into proposals (group_id, slot, title, summary, objectives, outcomes, project_type, domain, tech_stack, apis, updated_at)
  values (gid, p_slot, left(trim(p_title), 200), left(trim(p_summary), 4000), left(trim(p_objectives), 4000),
          left(trim(p_outcomes), 4000), coalesce(p_project_type, ''), left(trim(coalesce(p_domain, '')), 120),
          coalesce(p_tech_stack, '{}'), left(trim(coalesce(p_apis, '')), 1000), now())
  on conflict (group_id, slot) do update set
    title = excluded.title, summary = excluded.summary, objectives = excluded.objectives, outcomes = excluded.outcomes,
    project_type = excluded.project_type, domain = excluded.domain, tech_stack = excluded.tech_stack, apis = excluded.apis,
    updated_at = now();

  if g.proposal_status = 'not_started' then
    update groups set proposal_status = 'draft' where id = gid;
  end if;
end $$;

-- ---------------------------------------------------------------- group: own record (replaces my_fyp1_record)

drop function public.my_fyp1_record();
create or replace function public.my_marks_record() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare gid uuid := my_group_id(); p1 boolean := phase_locked('fyp1'); p2 boolean := phase_locked('fyp2');
begin
  if coalesce(my_role(), '') <> 'group' or gid is null then raise exception 'Only a group can open its record'; end if;
  return jsonb_build_object(
    'published', jsonb_build_object('fyp1', p1, 'fyp2', p2),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'group_id', s.group_id, 'phase', s.phase, 'held_on', s.held_on,
                                          'topic', s.topic, 'created_at', s.created_at, 'updated_at', s.updated_at)
                       order by s.held_on)
      from class_sessions s
      where s.id in (select a.session_id from session_attendance a join group_members m on m.id = a.member_id where m.group_id = gid)
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('session_id', a.session_id, 'member_id', a.member_id, 'status', a.status,
                                          'mark', case when phase_locked(s.phase) then a.mark end))
      from session_attendance a join group_members m on m.id = a.member_id join class_sessions s on s.id = a.session_id
      where m.group_id = gid
    ), '[]'::jsonb),
    'marks', coalesce((
      select jsonb_agg(jsonb_build_object('member_id', e.member_id, 'component', e.component, 'marks', e.marks,
                                          'absent', e.absent, 'updated_at', e.updated_at))
      from evaluation_marks e join group_members m on m.id = e.member_id
      where m.group_id = gid and phase_locked(component_phase(e.component))
    ), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------- read access

alter table public.group_declarations     enable row level security;
alter table public.deliverables           enable row level security;
alter table public.deliverable_extensions enable row level security;
alter table public.submissions            enable row level security;
alter table public.change_requests        enable row level security;
alter table public.announcements          enable row level security;

create policy declarations_read on public.group_declarations for select to authenticated using (can_see_group(group_id));

create policy deliverables_read on public.deliverables for select to authenticated using (true);
create policy deliverables_admin on public.deliverables for all to authenticated
  using (is_coordinator()) with check (is_coordinator());

create policy extensions_read on public.deliverable_extensions for select to authenticated using (can_see_group(group_id));
create policy extensions_admin on public.deliverable_extensions for all to authenticated
  using (is_coordinator()) with check (is_coordinator());

create policy submissions_read on public.submissions for select to authenticated using (can_see_group(group_id));
create policy change_requests_read on public.change_requests for select to authenticated using (can_see_group(group_id));

create policy announcements_read on public.announcements for select to authenticated using (true);
create policy announcements_admin on public.announcements for all to authenticated
  using (is_coordinator()) with check (is_coordinator());
-- submissions, change requests and declarations change only through the functions above.

revoke all on function public.save_proposal(int, text, text, text, text, text, text, text[], text),
                       public.publish_results(text, boolean),
                       public.set_declaration(uuid, text, boolean),
                       public.record_submission(uuid, text, text),
                       public.review_submission(uuid, text, text),
                       public.create_change_request(text, text),
                       public.decide_change_request(uuid, boolean, text),
                       public.my_marks_record(),
                       public.upload_blocked_reason(uuid) from public, anon;
grant execute on function public.save_proposal(int, text, text, text, text, text, text, text[], text),
                          public.publish_results(text, boolean),
                          public.set_declaration(uuid, text, boolean),
                          public.record_submission(uuid, text, text),
                          public.review_submission(uuid, text, text),
                          public.create_change_request(text, text),
                          public.decide_change_request(uuid, boolean, text),
                          public.my_marks_record(),
                          public.upload_blocked_reason(uuid),
                          public.can_upload(uuid) to authenticated;
