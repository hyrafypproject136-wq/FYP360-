import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, GraduationCap, History, KeyRound, TriangleAlert, UserX, UsersRound, type LucideIcon } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { groupGaps, membersOf, useAdminData } from '../../admin/AdminData'
import { describeAudit } from '../../admin/describeAudit'
import { loadAuditLog, type AuditEntry } from '../../lib/adminApi'
import { calcPhase, marksConfig, phaseLabel } from '../../lib/marksApi'
import { Badge, EmptyState, Panel, cx, timeAgo } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function Stat({ icon: Icon, label, value, to, tone }: { icon: LucideIcon; label: string; value: number; to: string; tone: string }) {
  return (
    <Link to={to} className="group rounded-2xl bg-white/75 border border-white/70 p-4 flex items-center gap-3.5 hover:bg-white transition shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <span className={cx('w-11 h-11 rounded-xl grid place-items-center text-white shrink-0', tone)}>
        <Icon size={20} />
      </span>
      <span className="min-w-0">
        <span className="block text-[26px] font-bold leading-none tracking-tight">{value}</span>
        <span className="block text-[13px] text-ink-2 mt-1 truncate">{label}</span>
      </span>
    </Link>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { data } = useAdminData()
  const [activity, setActivity] = useState<AuditEntry[] | null>(null)

  useEffect(() => {
    loadAuditLog(8).then(setActivity, () => setActivity([]))
  }, [data])

  const active = data.groups.filter((g) => g.status === 'active')
  const supervisors = data.profiles.filter((p) => p.role === 'supervisor').length
  const juryCount = data.profiles.filter((p) => p.role === 'jury').length
  const noGroup = data.members.filter((m) => !m.group_id).length
  const openRequests = data.requests.filter((r) => r.status === 'open').length
  const count = (fn: (g: (typeof active)[number]) => boolean) => active.filter(fn).length
  const cfg = marksConfig(data.settings)
  const placed = data.members.filter((m) => active.some((g) => g.id === m.group_id))
  const complete = (p: 'fyp1' | 'fyp2') => placed.filter((m) => calcPhase(m.id, data.marks, cfg, p).final !== null).length
  const deliverables = data.work.deliverables.length
  const pendingChanges = data.work.changes.filter((c) => c.status === 'pending_coordinator').length

  // The coordinator's workflow, in order.
  const steps = [
    { title: 'Create staff accounts', desc: 'Supervisor and jury logins.', done: supervisors > 0 && juryCount > 0, progress: `${supervisors} supervisor${supervisors === 1 ? '' : 's'} · ${juryCount} jury`, to: '/admin/staff' },
    { title: 'Add students', desc: 'Names, student IDs and e-mails sent to the department.', done: data.members.length > 0, progress: `${data.members.length} students`, to: '/admin/students' },
    { title: 'Create groups and add members', desc: 'Friend groups as sent; place single students yourself.', done: active.length > 0 && count((g) => membersOf(data, g.id).length > 0) === active.length, progress: `${count((g) => membersOf(data, g.id).length > 0)} of ${active.length} groups`, to: '/admin/groups' },
    { title: 'Choose a lead for each group', desc: 'The lead receives the group login.', done: active.length > 0 && count((g) => membersOf(data, g.id).some((m) => m.is_lead)) === active.length, progress: `${count((g) => membersOf(data, g.id).some((m) => m.is_lead))} of ${active.length}`, to: '/admin/groups' },
    { title: 'Assign supervisor and jury', desc: 'Students never choose these.', done: active.length > 0 && count((g) => !!g.supervisor_id && data.jury.some((j) => j.group_id === g.id)) === active.length, progress: `${count((g) => !!g.supervisor_id && data.jury.some((j) => j.group_id === g.id))} of ${active.length}`, to: '/admin/groups' },
    { title: 'Create group logins', desc: 'Give the username and password to each lead.', done: active.length > 0 && count((g) => !!g.account_id) === active.length, progress: `${count((g) => !!g.account_id)} of ${active.length}`, to: '/admin/groups' },
    { title: 'Place students without a group', desc: 'Includes students from dissolved groups.', done: data.members.length > 0 && noGroup === 0, progress: `${noGroup} waiting`, to: '/admin/students?filter=none' },
    { title: 'Approve proposals', desc: 'After the supervisor recommends one of the three ideas.', done: active.length > 0 && count((g) => g.proposal_status === 'approved') === active.length, progress: `${count((g) => g.proposal_status === 'approved')} of ${active.length} approved`, to: '/admin/proposals' },
    { title: 'Set deliverables and deadlines', desc: 'Reports, demo video and poster for FYP-1 and FYP-2.', done: data.work.deliverables.some((d) => d.phase === 'fyp1') && data.work.deliverables.some((d) => d.phase === 'fyp2'), progress: `${deliverables} set`, to: '/admin/submissions' },
    { title: 'Publish FYP-1 results', desc: 'Advisor, proposal and internal marks for every student.', done: cfg.published.fyp1, progress: `${complete('fyp1')} of ${placed.length} complete`, to: '/admin/results' },
    { title: 'Start FYP-2', desc: 'Switch the phase in Settings.', done: cfg.currentPhase === 'fyp2', progress: `Now ${phaseLabel[cfg.currentPhase]}`, to: '/admin/settings' },
    { title: 'Publish FYP-2 and final results', desc: 'Advisor, internal and external marks.', done: cfg.published.fyp2, progress: `${complete('fyp2')} of ${placed.length} complete`, to: '/admin/results' },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const attention = active.map((g) => ({ g, gaps: groupGaps(data, g) })).filter((x) => x.gaps.length > 0)

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.displayName?.split(' ').slice(0, 2).join(' ') || 'Coordinator'}`}
        subtitle={[data.settings.current_semester, data.settings.academic_year && `Academic year ${data.settings.academic_year}`].filter(Boolean).join(' · ')}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <Stat icon={UsersRound} label="Active groups" value={active.length} to="/admin/groups" tone="bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6]" />
        <Stat icon={GraduationCap} label="Students" value={data.members.length} to="/admin/students" tone="bg-gradient-to-br from-[#30d158] to-[#0b9a6d]" />
        <Stat icon={UserX} label="Not in a group" value={noGroup} to="/admin/students?filter=none" tone="bg-gradient-to-br from-[#ff9f0a] to-[#ff6b00]" />
        <Stat icon={KeyRound} label={pendingChanges ? 'Change requests' : 'Password requests'} value={pendingChanges || openRequests} to={pendingChanges ? '/admin/changes' : '/admin/requests'} tone="bg-gradient-to-br from-[#ff375f] to-[#bf5af2]" />
      </div>

      <div className="grid xl:grid-cols-[1.25fr_1fr] gap-5">
        <Panel title="Setup steps" action={<span className="text-[13px] text-ink-3">{doneCount} of {steps.length} done</span>}>
          <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden mb-4">
            <div className="h-full bg-good rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ol className="space-y-1">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Link to={s.to} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-black/[0.035] group">
                  <span className={cx('w-7 h-7 rounded-full grid place-items-center text-xs font-semibold shrink-0', s.done ? 'bg-good text-white' : 'bg-black/[0.06] text-ink-2')}>
                    {s.done ? <Check size={15} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={cx('block text-sm font-medium', s.done && 'text-ink-2')}>{s.title}</span>
                    <span className="block text-xs text-ink-3 truncate">{s.desc}</span>
                  </span>
                  <span className="text-xs text-ink-3 whitespace-nowrap hidden sm:block">{s.progress}</span>
                  <ArrowRight size={15} className="text-ink-3 opacity-0 group-hover:opacity-100 transition" />
                </Link>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title="Needs attention" padded={attention.length > 0}>
            {attention.length === 0 ? (
              <EmptyState icon={Check} title="Every active group is complete" />
            ) : (
              <ul className="divide-y divide-black/5 -mx-2">
                {attention.slice(0, 6).map(({ g, gaps }) => (
                  <li key={g.id}>
                    <Link to={`/admin/groups/${g.id}`} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-black/[0.035]">
                      <TriangleAlert size={16} className="text-warn shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{g.name}</span>
                        <span className="block text-[11px] font-mono text-ink-3">{g.code}</span>
                      </span>
                      <span className="flex gap-1 flex-wrap justify-end">
                        {gaps.slice(0, 2).map((x) => <Badge key={x} tone="amber">{x}</Badge>)}
                        {gaps.length > 2 && <Badge tone="grey">+{gaps.length - 2}</Badge>}
                      </span>
                    </Link>
                  </li>
                ))}
                {attention.length > 6 && (
                  <li className="px-2 pt-2.5"><Link to="/admin/groups" className="text-[13px] text-accent font-medium">See all {attention.length} groups</Link></li>
                )}
              </ul>
            )}
          </Panel>

          <Panel title="Recent activity" action={<Link to="/admin/activity" className="text-[13px] text-accent font-medium">See all</Link>} padded={!!activity?.length}>
            {!activity ? (
              <div className="px-5 pb-5 text-[13px] text-ink-3">Loading…</div>
            ) : activity.length === 0 ? (
              <EmptyState icon={History} title="Nothing yet" />
            ) : (
              <ul className="space-y-3">
                {activity.map((e) => (
                  <li key={e.id} className="flex gap-3 text-[13px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                    <span className="flex-1 min-w-0 text-ink">{describeAudit(data, e)}</span>
                    <span className="text-ink-3 whitespace-nowrap">{timeAgo(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
