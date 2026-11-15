import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Ban, Settings2, UsersRound } from 'lucide-react'
import { AuthProvider, homeFor, useAuth, type Role } from './auth/AuthProvider'
import { ToastProvider } from './components/Toast'
import { NoticeScreen } from './components/NoticeScreen'
import { Wallpaper } from './components/Brand'
import { Spinner } from './components/ui'
import { isSupabaseConfigured } from './lib/supabase'
import LoginPage from './pages/auth/LoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'

const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const GroupsPage = lazy(() => import('./pages/admin/GroupsPage'))
const GroupDetailPage = lazy(() => import('./pages/admin/GroupDetailPage'))
const StudentsPage = lazy(() => import('./pages/admin/StudentsPage'))
const StaffPage = lazy(() => import('./pages/admin/StaffPage'))
const RequestsPage = lazy(() => import('./pages/admin/RequestsPage'))
const ActivityPage = lazy(() => import('./pages/admin/ActivityPage'))
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'))
const ProposalsPage = lazy(() => import('./pages/admin/ProposalsPage'))
const ProposalDecisionPage = lazy(() => import('./pages/admin/ProposalDecisionPage'))
const StudentLayout = lazy(() => import('./layouts/StudentLayout'))
const StudentHomePage = lazy(() => import('./pages/portal/StudentHomePage'))
const StudentProposalsPage = lazy(() => import('./pages/portal/StudentProposalsPage'))
const ProposalEditorPage = lazy(() => import('./pages/portal/ProposalEditorPage'))
const StaffLayout = lazy(() => import('./layouts/StaffLayout'))
const StaffHomePage = lazy(() => import('./pages/portal/StaffHomePage'))
const ReviewsPage = lazy(() => import('./pages/portal/ReviewsPage'))
const ReviewPage = lazy(() => import('./pages/portal/ReviewPage'))
const StaffMarksListPage = lazy(() => import('./pages/portal/StaffMarksListPage'))
const StaffMarksPage = lazy(() => import('./pages/portal/StaffMarksPage'))
const ResultsPage = lazy(() => import('./pages/admin/ResultsPage'))
const ResultsGroupPage = lazy(() => import('./pages/admin/ResultsGroupPage'))
const StudentMeetingsPage = lazy(() => import('./pages/portal/StudentMeetingsPage'))
const StudentResultsPage = lazy(() => import('./pages/portal/StudentResultsPage'))
const StudentSubmissionsPage = lazy(() => import('./pages/portal/StudentSubmissionsPage'))
const StudentChangesPage = lazy(() => import('./pages/portal/StudentChangesPage'))
const StudentAnnouncementsPage = lazy(() => import('./pages/portal/StudentAnnouncementsPage'))
const StaffSubmissionsPage = lazy(() => import('./pages/portal/StaffSubmissionsPage'))
const StaffChangesPage = lazy(() => import('./pages/portal/StaffChangesPage'))
const DeliverablesPage = lazy(() => import('./pages/admin/DeliverablesPage'))
const ChangesPage = lazy(() => import('./pages/admin/ChangesPage'))
const AnnouncementsPage = lazy(() => import('./pages/admin/AnnouncementsPage'))

const Loading = () => (
  <div className="min-h-full grid place-items-center">
    <Wallpaper blur />
    <div className="glass rounded-2xl px-6"><Spinner /></div>
  </div>
)

/** Only signed-in users with one of `roles` may open the page; others go to their own home or to login. */
function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { loading, user, signOut } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />

  if (user.role === 'student' && user.groupStatus === 'disqualified') {
    return (
      <NoticeScreen icon={Ban} title="Your group has been disqualified" onSignOut={signOut}>
        {user.groupStatusReason || 'Contact the FYP coordinator for details.'}
      </NoticeScreen>
    )
  }
  if (user.role === 'student' && (user.groupStatus === 'dissolved' || !user.groupId)) {
    return (
      <NoticeScreen icon={UsersRound} title="This group is no longer active" onSignOut={signOut}>
        The FYP coordinator has dissolved this group. You will be placed in a new group and its lead will get the new login.
      </NoticeScreen>
    )
  }
  return <>{children}</>
}

/** Login pages: signed-in users skip straight to their portal. */
function PublicOnly({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()
  if (loading) return <Loading />
  if (user) return <Navigate to={homeFor(user.role)} replace />
  return <>{children}</>
}

function HomeRedirect() {
  const { loading, user } = useAuth()
  if (loading) return <Loading />
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <NoticeScreen icon={Settings2} title="FYP360 is not connected" tone="neutral">
        Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then restart the app.
      </NoticeScreen>
    )
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
              <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />

              <Route path="/admin" element={<RequireRole roles={['coordinator']}><AdminLayout /></RequireRole>}>
                <Route index element={<DashboardPage />} />
                <Route path="groups" element={<GroupsPage />} />
                <Route path="groups/:id" element={<GroupDetailPage />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="staff" element={<StaffPage />} />
                <Route path="proposals" element={<ProposalsPage />} />
                <Route path="proposals/:groupId" element={<ProposalDecisionPage />} />
                <Route path="results" element={<ResultsPage />} />
                <Route path="results/:groupId" element={<ResultsGroupPage />} />
                <Route path="submissions" element={<DeliverablesPage />} />
                <Route path="changes" element={<ChangesPage />} />
                <Route path="announcements" element={<AnnouncementsPage />} />
                <Route path="requests" element={<RequestsPage />} />
                <Route path="activity" element={<ActivityPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="/student" element={<RequireRole roles={['student']}><StudentLayout /></RequireRole>}>
                <Route index element={<StudentHomePage />} />
                <Route path="proposals" element={<StudentProposalsPage />} />
                <Route path="proposals/:slot" element={<ProposalEditorPage />} />
                <Route path="meetings" element={<StudentMeetingsPage />} />
                <Route path="results" element={<StudentResultsPage />} />
                <Route path="submissions" element={<StudentSubmissionsPage />} />
                <Route path="changes" element={<StudentChangesPage />} />
                <Route path="announcements" element={<StudentAnnouncementsPage />} />
              </Route>
              <Route path="/staff" element={<RequireRole roles={['supervisor', 'jury']}><StaffLayout /></RequireRole>}>
                <Route index element={<StaffHomePage />} />
                <Route path="reviews" element={<ReviewsPage />} />
                <Route path="reviews/:groupId" element={<ReviewPage />} />
                <Route path="meetings" element={<StaffMarksListPage key="meetings" mode="meetings" />} />
                <Route path="meetings/:groupId" element={<StaffMarksPage key="meetings" mode="meetings" />} />
                <Route path="marks" element={<StaffMarksListPage key="jury" mode="jury" />} />
                <Route path="marks/:groupId" element={<StaffMarksPage key="jury" mode="jury" />} />
                <Route path="submissions" element={<StaffMarksListPage key="subs" mode="submissions" />} />
                <Route path="submissions/:groupId" element={<StaffSubmissionsPage />} />
                <Route path="changes" element={<StaffChangesPage />} />
              </Route>

              <Route path="*" element={<HomeRedirect />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
