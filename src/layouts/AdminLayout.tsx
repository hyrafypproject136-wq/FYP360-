import { Outlet } from 'react-router-dom'
import { BriefcaseBusiness, Calculator, FileCheck2, FolderUp, GitPullRequestArrow, Megaphone, GraduationCap, History, KeyRound, LayoutDashboard, Settings, UsersRound, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { AdminDataProvider, useAdmin } from '../admin/AdminData'
import { Button, Spinner } from '../components/ui'
import { WindowFrame, type NavSection } from './WindowFrame'

function AdminShell() {
  const { user, signOut } = useAuth()
  const { data, loading, loadError, reload, actionError, clearActionError } = useAdmin()

  const openRequests = data?.requests.filter((r) => r.status === 'open').length ?? 0
  const noGroup = data?.members.filter((m) => !m.group_id).length ?? 0
  const changes = data?.work.changes.filter((c) => c.status === 'pending_coordinator').length ?? 0
  const toApprove = data?.groups.filter((g) => g.status === 'active' && g.proposal_status === 'supervisor_endorsed').length ?? 0

  const sections: NavSection[] = [
    { title: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    {
      title: 'Manage',
      items: [
        { to: '/admin/groups', label: 'Groups', icon: UsersRound },
        { to: '/admin/students', label: 'Students', icon: GraduationCap, badge: noGroup },
        { to: '/admin/staff', label: 'Staff accounts', icon: BriefcaseBusiness },
      ],
    },
    {
      title: 'Workflow',
      items: [
        { to: '/admin/proposals', label: 'Proposals', icon: FileCheck2, badge: toApprove },
        { to: '/admin/submissions', label: 'Submissions', icon: FolderUp },
        { to: '/admin/results', label: 'Results', icon: Calculator },
      ],
    },
    {
      title: 'Inbox',
      items: [
        { to: '/admin/changes', label: 'Change requests', icon: GitPullRequestArrow, badge: changes },
        { to: '/admin/requests', label: 'Password requests', icon: KeyRound, badge: openRequests },
        { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
      ],
    },
    {
      title: 'System',
      items: [
        { to: '/admin/activity', label: 'Activity log', icon: History },
        { to: '/admin/settings', label: 'Settings', icon: Settings },
      ],
    },
  ]

  const subtitle = data?.settings.current_semester ? `Admin · ${data.settings.current_semester}` : 'Admin'

  return (
    <WindowFrame sections={sections} subtitle={subtitle} userName={user?.displayName || 'Coordinator'} userRole="FYP Coordinator" onSignOut={signOut}>
      {actionError && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl bg-bad-soft text-bad px-4 py-3 text-[13px]">
          <span className="flex-1">{actionError}</span>
          <button type="button" aria-label="Dismiss" onClick={clearActionError} className="cursor-pointer"><X size={16} /></button>
        </div>
      )}
      {loading ? (
        <Spinner />
      ) : loadError || !data ? (
        <div className="py-16 text-center">
          <p className="text-sm text-bad mb-4">Could not load data: {loadError}</p>
          <Button variant="secondary" onClick={reload}>Try again</Button>
        </div>
      ) : (
        <Outlet />
      )}
    </WindowFrame>
  )
}

export default function AdminLayout() {
  return (
    <AdminDataProvider>
      <AdminShell />
    </AdminDataProvider>
  )
}
