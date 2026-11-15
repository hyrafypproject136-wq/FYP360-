import { Outlet } from 'react-router-dom'
import { CalendarDays, ClipboardCheck, ClipboardPen, FolderUp, GitPullRequestArrow, UsersRound } from 'lucide-react'
import { versionsOf } from '../lib/workflowApi'
import { useAuth } from '../auth/AuthProvider'
import { StaffDataProvider, useStaff } from '../staff/StaffData'
import { Spinner } from '../components/ui'
import { WindowFrame, type NavItem } from './WindowFrame'

function Shell() {
  const { user, signOut } = useAuth()
  const { data, error } = useStaff()
  const isSupervisor = user?.role === 'supervisor'
  const waiting = data?.groups.filter((g) => g.supervisor_id === user?.profileId && g.proposal_status === 'submitted').length ?? 0

  const items: NavItem[] = [{ to: '/staff', label: 'My groups', icon: UsersRound, end: true }]
  if (isSupervisor) items.push({ to: '/staff/reviews', label: 'Proposal reviews', icon: ClipboardCheck, badge: waiting })
  const supervised = data?.groups.filter((g) => g.supervisor_id === user?.profileId) ?? []
  const toReview = data ? supervised.reduce((n, g) => n + data.work.deliverables.filter((d) => versionsOf(data.work, d, g.id)[0]?.status === 'submitted').length, 0) : 0
  if (isSupervisor) items.push({ to: '/staff/meetings', label: 'Class meetings', icon: CalendarDays })
  if (isSupervisor) items.push({ to: '/staff/submissions', label: 'Submission reviews', icon: FolderUp, badge: toReview })
  const juryGroups = new Set(data?.jury.filter((j) => j.jury_id === user?.profileId).map((j) => j.group_id) ?? [])
  const changes = data?.work.changes.filter((c) => juryGroups.has(c.group_id) && c.status === 'pending_jury').length ?? 0
  if (juryGroups.size > 0 || user?.role === 'jury') {
    items.push({ to: '/staff/marks', label: 'Evaluation marks', icon: ClipboardPen })
    items.push({ to: '/staff/changes', label: 'Change requests', icon: GitPullRequestArrow, badge: changes })
  }

  const roleName = isSupervisor ? 'Supervisor' : 'Jury member'
  return (
    <WindowFrame sections={[{ title: 'Work', items }]} subtitle={`${roleName} portal`} userName={user?.displayName || roleName} userRole={roleName} onSignOut={signOut}>
      {error ? <p className="text-sm text-bad">{error}</p> : !data ? <Spinner /> : <Outlet />}
    </WindowFrame>
  )
}

export default function StaffLayout() {
  return (
    <StaffDataProvider>
      <Shell />
    </StaffDataProvider>
  )
}
