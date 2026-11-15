-- FYP360 · Admin panel: groups, students, accounts
-- Run once in Supabase → SQL Editor (or `supabase db push`).
--
-- Login model
--   * Every login is a Supabase Auth user. Username logins use a hidden e-mail
--     "<username>@login.fyp360.app" so the user only ever types a username.
--   * One shared login per GROUP (role 'group'), created by the coordinator.
--   * Staff logins (coordinator / supervisor / jury) work the same way.
--   * "Sign in with Google": the Google e-mail is matched against
--     group_members.email (students) or profiles.contact_email (staff).
--     Only Google-verified sessions are matched by e-mail, so nobody can
--     sign up with someone else's address and get in.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          text not null check (role in ('coordinator', 'supervisor', 'jury', 'group')),
  username      text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  display_name  text not null,
  contact_email text unique,
  created_at    timestamptz not null default now()
);

create sequence public.group_code_seq;

create table public.groups (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique
                    default 'FYP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.group_code_seq')::text, 3, '0'),
  name              text not null,
  section           text,
  batch             text,
  semester          text,
  max_members       int  not null default 4 check (max_members between 1 and 8),
  status            text not null default 'active' check (status in ('active', 'disqualified', 'dissolved')),
  status_reason     text,
  status_changed_at timestamptz,
  supervisor_id     uuid references public.profiles (id) on delete set null,
  account_id        uuid unique references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);

create table public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid references public.groups (id) on delete set null,   -- null = not in a group yet
  student_id text not null unique,
  full_name  text not null,
  email      text not null unique check (email = lower(email)),
  is_lead    boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index group_members_one_lead on public.group_members (group_id) where is_lead;
create index group_members_group on public.group_members (group_id);

create table public.group_jury (
  group_id uuid not null references public.groups (id) on delete cascade,
  jury_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (group_id, jury_id)
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  kind       text not null,
  message    text not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create table public.password_reset_requests (
  id          uuid primary key default gen_random_uuid(),
  identifier  text not null,          -- username, student ID or e-mail the student typed
  note        text,
  status      text not null default 'open' check (status in ('open', 'done', 'rejected')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  target     text,
  details    jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- identity helpers

-- True only for sessions where Google (not a self-typed sign-up) verified the e-mail.
create or replace function public.session_google_email() returns text
language sql stable as $$
  select case when auth.jwt() -> 'app_metadata' ->> 'provider' = 'google'
              then lower(auth.jwt() ->> 'email') end
$$;

-- Profile of the signed-in user: by auth id, or (staff + Google) by contact e-mail.
create or replace function public.my_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles
  where id = auth.uid()
     or (role <> 'group' and contact_email is not null and contact_email = session_google_email())
  order by (id = auth.uid()) desc
  limit 1
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from profiles where id = my_profile_id()),
    (select 'group' from group_members where email = session_google_email() and group_id is not null)
  )
$$;

create or replace function public.is_coordinator() returns boolean
language sql stable as $$ select coalesce(public.my_role() = 'coordinator', false) $$;

-- Group of the signed-in student: the shared group login, or a member's Google e-mail.
create or replace function public.my_group_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select g.id from groups g where g.account_id = auth.uid()),
    (select m.group_id from group_members m where m.email = session_google_email())
  )
$$;

-- Everything the app needs right after sign-in. Returns no row for an unknown account.
create or replace function public.whoami()
returns table (role text, profile_id uuid, display_name text, group_id uuid, group_status text, group_status_reason text)
language sql stable security definer set search_path = public as $$
  select r.role,
         p.id,
         coalesce(p.display_name, m.full_name, g.name),
         g.id,
         g.status,
         g.status_reason
  from (select my_role() as role) r
  left join profiles p      on p.id = my_profile_id() and p.role <> 'group'
  left join groups g        on g.id = my_group_id() and r.role = 'group'
  left join group_members m on m.email = session_google_email()
  where r.role is not null
$$;

-- ---------------------------------------------------------------- rules (triggers)

-- Group size limit and "only active groups take members".
create or replace function public.check_group_capacity() returns trigger
language plpgsql as $$
declare g record; n int;
begin
  if new.group_id is null then
    new.is_lead := false;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.group_id is not distinct from old.group_id then
    return new;
  end if;
  select * into g from public.groups where id = new.group_id for update;
  if g.status <> 'active' then
    raise exception 'Group % is %, members cannot be added', g.code, g.status;
  end if;
  select count(*) into n from public.group_members where group_id = new.group_id;
  if n >= g.max_members then
    raise exception 'Group % is full (% of % members). Raise its member limit first.', g.code, n, g.max_members;
  end if;
  return new;
end $$;
create trigger group_members_capacity before insert or update of group_id on public.group_members
  for each row execute function public.check_group_capacity();

create or replace function public.check_max_members() returns trigger
language plpgsql as $$
declare n int;
begin
  select count(*) into n from public.group_members where group_id = new.id;
  if new.max_members < n then
    raise exception 'Group % already has % members; the limit cannot be lower than that.', new.code, n;
  end if;
  return new;
end $$;
create trigger groups_max_members before update of max_members on public.groups
  for each row execute function public.check_max_members();

-- Staff roles must match where they are used, and the supervisor cannot also be jury.
create or replace function public.check_staff_roles() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'groups' then
    if new.supervisor_id is not null and (select role from public.profiles where id = new.supervisor_id) <> 'supervisor' then
      raise exception 'Selected supervisor is not a supervisor account';
    end if;
    if new.account_id is not null and (select role from public.profiles where id = new.account_id) <> 'group' then
      raise exception 'Group login must be a group account';
    end if;
    if new.supervisor_id is not null and exists (select 1 from public.group_jury where group_id = new.id and jury_id = new.supervisor_id) then
      raise exception 'The supervisor of a group cannot also sit on its jury';
    end if;
  else
    if (select role from public.profiles where id = new.jury_id) not in ('jury', 'supervisor') then
      raise exception 'Selected jury member is not a jury or supervisor account';
    end if;
    if exists (select 1 from public.groups where id = new.group_id and supervisor_id = new.jury_id) then
      raise exception 'The supervisor of a group cannot also sit on its jury';
    end if;
  end if;
  return new;
end $$;
create trigger groups_staff_roles before insert or update of supervisor_id, account_id on public.groups
  for each row execute function public.check_staff_roles();
create trigger group_jury_staff_roles before insert or update on public.group_jury
  for each row execute function public.check_staff_roles();

-- Audit trail for every admin change to groups, members and jury.
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (actor_id, action, target, details)
  values (
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'code',
             (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'student_id',
             (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'group_id'),
    jsonb_build_object('old', case when tg_op <> 'INSERT' then to_jsonb(old) end,
                       'new', case when tg_op <> 'DELETE' then to_jsonb(new) end)
  );
  return coalesce(new, old);
end $$;
create trigger audit_groups        after insert or update or delete on public.groups        for each row execute function public.audit_row();
create trigger audit_group_members after insert or update or delete on public.group_members for each row execute function public.audit_row();
create trigger audit_group_jury    after insert or update or delete on public.group_jury    for each row execute function public.audit_row();

-- ---------------------------------------------------------------- admin actions (RPC)

create or replace function public.set_group_lead(p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if not is_coordinator() then raise exception 'Only the coordinator can change the group lead'; end if;
  select group_id into gid from group_members where id = p_member_id;
  if gid is null then raise exception 'Student is not in a group'; end if;
  update group_members set is_lead = false where group_id = gid and is_lead;
  update group_members set is_lead = true where id = p_member_id;
end $$;

-- Dissolve: members go back to the "no group" list so the coordinator can place each one.
create or replace function public.dissolve_group(p_group_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_coordinator() then raise exception 'Only the coordinator can dissolve a group'; end if;
  update group_members set group_id = null, is_lead = false where group_id = p_group_id;
  update groups set status = 'dissolved', status_reason = p_reason, status_changed_at = now() where id = p_group_id;
end $$;

create or replace function public.set_group_status(p_group_id uuid, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_coordinator() then raise exception 'Only the coordinator can change a group status'; end if;
  if p_status not in ('active', 'disqualified') then raise exception 'Use dissolve_group to dissolve a group'; end if;
  if p_status = 'disqualified' and coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required to disqualify a group';
  end if;
  update groups set status = p_status, status_reason = p_reason, status_changed_at = now() where id = p_group_id;
end $$;

-- Anyone (even signed out) can ask the coordinator for a new password.
create or replace function public.request_password_reset(p_identifier text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_identifier, ''))) < 3 then raise exception 'Enter your username, student ID or e-mail'; end if;
  if (select count(*) from password_reset_requests
      where lower(identifier) = lower(trim(p_identifier)) and status = 'open') >= 1 then
    return;  -- already waiting; do not pile up duplicates
  end if;
  insert into password_reset_requests (identifier, note) values (trim(p_identifier), left(p_note, 500));
end $$;

-- ---------------------------------------------------------------- row level security

alter table public.profiles                enable row level security;
alter table public.groups                  enable row level security;
alter table public.group_members           enable row level security;
alter table public.group_jury              enable row level security;
alter table public.notifications           enable row level security;
alter table public.password_reset_requests enable row level security;
alter table public.audit_log               enable row level security;

-- profiles: coordinator manages; everyone signed in can see staff names; you can see yourself.
create policy profiles_read on public.profiles for select to authenticated
  using (is_coordinator() or id = my_profile_id() or role <> 'group');
create policy profiles_admin_update on public.profiles for update to authenticated
  using (is_coordinator()) with check (is_coordinator());

-- groups: coordinator all; students their own; supervisor/jury the groups they are assigned to.
create policy groups_read on public.groups for select to authenticated
  using (
    is_coordinator()
    or id = my_group_id()
    or supervisor_id = my_profile_id()
    or exists (select 1 from public.group_jury j where j.group_id = groups.id and j.jury_id = my_profile_id())
  );
create policy groups_admin_write on public.groups for all to authenticated
  using (is_coordinator()) with check (is_coordinator());

create policy members_read on public.group_members for select to authenticated
  using (
    is_coordinator()
    or (group_id is not null and group_id = my_group_id())
    or exists (select 1 from public.groups g where g.id = group_members.group_id and g.supervisor_id = my_profile_id())
    or exists (select 1 from public.group_jury j where j.group_id = group_members.group_id and j.jury_id = my_profile_id())
  );
create policy members_admin_write on public.group_members for all to authenticated
  using (is_coordinator()) with check (is_coordinator());

create policy jury_read on public.group_jury for select to authenticated
  using (is_coordinator() or group_id = my_group_id() or jury_id = my_profile_id()
         or exists (select 1 from public.groups g where g.id = group_jury.group_id and g.supervisor_id = my_profile_id()));
create policy jury_admin_write on public.group_jury for all to authenticated
  using (is_coordinator()) with check (is_coordinator());

create policy notifications_read on public.notifications for select to authenticated
  using (is_coordinator() or group_id = my_group_id());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (group_id = my_group_id()) with check (group_id = my_group_id());

create policy reset_requests_admin on public.password_reset_requests for all to authenticated
  using (is_coordinator()) with check (is_coordinator());

create policy audit_admin_read on public.audit_log for select to authenticated
  using (is_coordinator());

-- Signed-out visitors may only call request_password_reset.
revoke all on function public.set_group_lead(uuid), public.dissolve_group(uuid, text),
                       public.set_group_status(uuid, text, text) from anon, public;
grant execute on function public.set_group_lead(uuid), public.dissolve_group(uuid, text),
                          public.set_group_status(uuid, text, text), public.whoami() to authenticated;
grant execute on function public.request_password_reset(text, text) to anon, authenticated;
