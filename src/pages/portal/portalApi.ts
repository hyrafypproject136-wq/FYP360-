import { supabase } from '../../lib/supabase'
import type { Group, GroupJury, Member, Profile } from '../../lib/adminApi'

export interface Notice {
  id: string
  kind: string
  message: string
  read_at: string | null
  created_at: string
}

const check = <T,>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/** Everything a group sees. Security rules only return the signed-in group's rows. */
export async function loadMyGroup(groupId: string) {
  const [group, members, jury, staff, notices] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single(),
    supabase.from('group_members').select('*').eq('group_id', groupId).order('is_lead', { ascending: false }).order('full_name'),
    supabase.from('group_jury').select('*').eq('group_id', groupId),
    supabase.from('profiles').select('*').neq('role', 'group'),
    supabase.from('notifications').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(20),
  ])
  return {
    group: check<Group>(group),
    members: check<Member[]>(members),
    jury: check<GroupJury[]>(jury),
    staff: check<Profile[]>(staff),
    notices: check<Notice[]>(notices),
  }
}

/** Groups a supervisor or jury member is assigned to (filtered by the security rules). */
export async function loadAssignedGroups() {
  const [groups, members, jury, staff] = await Promise.all([
    supabase.from('groups').select('*').eq('status', 'active').order('code'),
    supabase.from('group_members').select('*').order('full_name'),
    supabase.from('group_jury').select('*'),
    supabase.from('profiles').select('*').neq('role', 'group'),
  ])
  return {
    groups: check<Group[]>(groups),
    members: check<Member[]>(members),
    jury: check<GroupJury[]>(jury),
    staff: check<Profile[]>(staff),
  }
}

export async function markNoticesRead(ids: string[]) {
  if (ids.length) check(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids))
}
