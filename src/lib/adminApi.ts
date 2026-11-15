import { supabase } from './supabase';

export type StaffRole = 'coordinator' | 'supervisor' | 'jury';
export type ProfileRole = StaffRole | 'group';
export type GroupStatus = 'active' | 'disqualified' | 'dissolved';
export type ProposalStatus = 'not_started' | 'draft' | 'submitted' | 'revision_requested' | 'supervisor_endorsed' | 'approved';

export interface Profile {
  id: string;
  role: ProfileRole;
  username: string;
  display_name: string;
  contact_email: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  code: string;
  name: string;
  section: string | null;
  batch: string | null;
  semester: string | null;
  max_members: number;
  status: GroupStatus;
  status_reason: string | null;
  status_changed_at: string | null;
  supervisor_id: string | null;
  account_id: string | null;
  proposal_status: ProposalStatus;
  approved_proposal_id: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  group_id: string | null;
  student_id: string;
  full_name: string;
  email: string;
  is_lead: boolean;
  eligible: boolean;
  created_at: string;
}

export interface GroupJury {
  group_id: string;
  jury_id: string;
}

export interface ResetRequest {
  id: string;
  identifier: string;
  note: string | null;
  status: 'open' | 'done' | 'rejected';
  created_at: string;
  resolved_at: string | null;
}

export interface AuditEntry {
  id: number;
  actor_id: string | null;
  action: string;
  target: string | null;
  details: { old?: Record<string, unknown>; new?: Record<string, unknown> } & Record<string, unknown>;
  created_at: string;
}

const check = <T>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
};

export async function loadAdminData() {
  const [groups, members, profiles, jury, requests] = await Promise.all([
    supabase.from('groups').select('*').order('created_at', { ascending: false }),
    supabase.from('group_members').select('*').order('full_name'),
    supabase.from('profiles').select('*').order('display_name'),
    supabase.from('group_jury').select('*'),
    supabase.from('password_reset_requests').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  return {
    groups: check<Group[]>(groups),
    members: check<Member[]>(members),
    profiles: check<Profile[]>(profiles),
    jury: check<GroupJury[]>(jury),
    requests: check<ResetRequest[]>(requests),
  };
}

export async function loadAuditLog(limit = 200) {
  return check<AuditEntry[]>(
    await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit),
  );
}

// ---------- groups

export async function createGroup(input: Pick<Group, 'name' | 'section' | 'batch' | 'semester' | 'max_members'>) {
  return check<Group>(await supabase.from('groups').insert(input).select().single());
}

export async function updateGroup(id: string, patch: Partial<Pick<Group, 'name' | 'section' | 'batch' | 'semester' | 'max_members' | 'supervisor_id'>>) {
  check(await supabase.from('groups').update(patch).eq('id', id));
}

export async function setGroupStatus(id: string, status: 'active' | 'disqualified', reason: string | null) {
  check(await supabase.rpc('set_group_status', { p_group_id: id, p_status: status, p_reason: reason }));
}

export async function dissolveGroup(id: string, reason: string) {
  check(await supabase.rpc('dissolve_group', { p_group_id: id, p_reason: reason }));
}

export async function setJury(groupId: string, juryIds: string[], current: string[]) {
  const add = juryIds.filter((id) => !current.includes(id));
  const remove = current.filter((id) => !juryIds.includes(id));
  if (remove.length) check(await supabase.from('group_jury').delete().eq('group_id', groupId).in('jury_id', remove));
  if (add.length) check(await supabase.from('group_jury').insert(add.map((jury_id) => ({ group_id: groupId, jury_id }))));
}

// ---------- students

export async function addStudent(input: { student_id: string; full_name: string; email: string; group_id: string | null; eligible?: boolean }) {
  return check<Member>(
    await supabase
      .from('group_members')
      .insert({ ...input, student_id: input.student_id.trim().toUpperCase(), email: input.email.trim().toLowerCase(), full_name: input.full_name.trim() })
      .select()
      .single(),
  );
}

export async function updateStudent(id: string, patch: Partial<Pick<Member, 'student_id' | 'full_name' | 'email' | 'eligible'>>) {
  const clean = { ...patch };
  if (clean.email) clean.email = clean.email.trim().toLowerCase();
  if (clean.student_id) clean.student_id = clean.student_id.trim().toUpperCase();
  check(await supabase.from('group_members').update(clean).eq('id', id));
}

export async function moveStudent(id: string, groupId: string | null) {
  check(await supabase.from('group_members').update({ group_id: groupId, is_lead: false }).eq('id', id));
}

export async function setLead(memberId: string) {
  check(await supabase.rpc('set_group_lead', { p_member_id: memberId }));
}

export async function deleteStudent(id: string) {
  check(await supabase.from('group_members').delete().eq('id', id));
}

// ---------- password reset requests

export async function setRequestStatus(id: string, status: 'done' | 'rejected') {
  check(await supabase.from('password_reset_requests').update({ status, resolved_at: new Date().toISOString() }).eq('id', id));
}

export async function requestPasswordReset(identifier: string, note: string) {
  check(await supabase.rpc('request_password_reset', { p_identifier: identifier, p_note: note }));
}

// ---------- accounts (Edge Function, needs the service-role key on the server)

export interface AccountResult {
  ok: true;
  profile_id?: string;
  emailed?: number;
  emailConfigured?: boolean;
  emailError?: string;
}

async function accounts(body: Record<string, unknown>): Promise<AccountResult> {
  const { data, error } = await supabase.functions.invoke('admin-accounts', { body });
  if (error) {
    // Pull the real message out of the function's JSON error body when there is one.
    const ctx = (error as { context?: Response }).context;
    let detail: string | undefined;
    if (ctx && typeof ctx.json === 'function') {
      detail = await ctx.json().then((p) => p?.error as string | undefined, () => undefined);
    }
    throw new Error(detail || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as AccountResult;
}

export const createGroupLogin = (group_id: string, username: string, password: string) =>
  accounts({ action: 'create_group_login', group_id, username, password });

export const createStaffLogin = (input: { role: StaffRole; username: string; password: string; display_name: string; contact_email: string | null }) =>
  accounts({ action: 'create_staff_login', ...input });

export const resetPassword = (profile_id: string, password: string, request_id?: string) =>
  accounts({ action: 'reset_password', profile_id, password, request_id });

export const deleteLogin = (profile_id: string) => accounts({ action: 'delete_login', profile_id });

/** Readable random password, e.g. "Kite-7342-Moss". Shown to the coordinator once, never stored in the app. */
export function generatePassword(): string {
  const words = ['Kite', 'Moss', 'Reef', 'Pine', 'Dune', 'Lark', 'Opal', 'Fern', 'Hawk', 'Iris', 'Jade', 'Lynx', 'Nova', 'Onyx', 'Sage', 'Tide'];
  const r = crypto.getRandomValues(new Uint32Array(3));
  return `${words[r[0] % words.length]}-${1000 + (r[1] % 9000)}-${words[r[2] % words.length]}`;
}

// ---------- academic session settings

export type Settings = Record<string, string>

export async function loadSettings(): Promise<Settings> {
  const rows = check<{ key: string; value: string }[]>(await supabase.from('app_settings').select('key, value'))
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export async function saveSettings(values: Settings) {
  const rows = Object.entries(values).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))
  check(await supabase.from('app_settings').upsert(rows))
}

export async function changeOwnPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(error.message)
}
