-- FYP360 · academic session settings shown in the app (semester, year, names).
create table public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Everyone may read (the login page shows the university name); only the coordinator writes.
create policy settings_read on public.app_settings for select to anon, authenticated using (true);
create policy settings_write on public.app_settings for all to authenticated
  using (public.is_coordinator()) with check (public.is_coordinator());

insert into public.app_settings (key, value) values
  ('university_name', 'KIET University'),
  ('department_name', 'Department of Computer Science & Software Engineering'),
  ('academic_year', '2026–2027'),
  ('current_semester', 'Fall 2026'),
  ('default_group_size', '4');
