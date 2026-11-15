import { Outlet } from 'react-router-dom'
import { Calculator, CalendarDays, FileText, FolderUp, GitPullRequestArrow, Megaphone, UsersRound } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { StudentDataProvider, useStudent } from '../student/StudentData'
import { Spinner } from '../components/ui'
import { WindowFrame } from './WindowFrame'
import { deliverableState } from '../lib/workflowApi'

function Shell() {
  const { user, signOut } = useAuth()
  const { data, error } = useStudent()
  const unread = data?.notices.filter((n) => !n.read_at).length ?? 0
  const toUpload = data ? data.work.deliverables.filter((d) => d.phase === (data.settings.current_phase === 'fyp2' ? 'fyp2' : 'fyp1') && ['open', 'changes_requested'].includes(deliverableState(data.work, d, data.group.id))).length : 0
  const needsAction = data && ['not_started', 'draft', 'revision_requested'].includes(data.group.proposal_status) ? 1 : 0

  return (
    <WindowFrame
      sections={[
        {
          title: 'Your group',
          items: [
            { to: '/student', label: 'Overview', icon: UsersRound, end: true },
            { to: '/student/proposals', label: 'Proposals', icon: FileText, badge: needsAction },
            { to: '/student/submissions', label: 'Submissions', icon: FolderUp, badge: toUpload },
            { to: '/student/meetings', label: 'Meetings', icon: CalendarDays },
            { to: '/student/changes', label: 'Change requests', icon: GitPullRequestArrow },
            { to: '/student/results', label: 'Results', icon: Calculator },
            { to: '/student/announcements', label: 'Announcements', icon: Megaphone, badge: unread },
          ],
        },
      ]}
      subtitle="Student portal"
      userName={user?.displayName || 'Group'}
      userRole={data ? `${data.group.code}` : 'Group'}
      onSignOut={signOut}
    >
      {error ? <p className="text-sm text-bad">Could not load your group: {error}</p> : !data ? <Spinner /> : <Outlet />}
    </WindowFrame>
  )
}

export default function StudentLayout() {
  return (
    <StudentDataProvider>
      <Shell />
    </StudentDataProvider>
  )
}
