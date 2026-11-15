import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, ClipboardPen, FolderUp, type LucideIcon } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useStaffData } from '../../staff/StaffData'
import { absencesIn, isSigned, juryComponents, marksConfig, phaseLabel } from '../../lib/marksApi'
import { versionsOf } from '../../lib/workflowApi'
import { Badge, EmptyState, Panel } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { LockedNote } from '../../marks/shared'

export type StaffMode = 'meetings' | 'jury' | 'submissions'

const info: Record<StaffMode, { title: string; base: string; icon: LucideIcon; empty: string }> = {
  meetings: { title: 'Class meetings', base: '/staff/meetings', icon: CalendarDays, empty: 'You do not supervise any group yet' },
  submissions: { title: 'Submission reviews', base: '/staff/submissions', icon: FolderUp, empty: 'You do not supervise any group yet' },
  jury: { title: 'Evaluation marks', base: '/staff/marks', icon: ClipboardPen, empty: 'You are not on any jury yet' },
}

/** Supervisor: groups to record meetings / review work for. Jury: groups to mark. */
export default function StaffMarksListPage({ mode }: { mode: StaffMode }) {
  const { user } = useAuth()
  const { data } = useStaffData()
  const me = user?.profileId
  const cfg = marksConfig(data.settings)
  const phase = cfg.currentPhase
  const groups = data.groups.filter((g) => (mode === 'jury' ? data.jury.some((j) => j.group_id === g.id && j.jury_id === me) : g.supervisor_id === me))
  const { title, base, icon, empty } = info[mode]
  const comps = juryComponents[phase]

  const subtitle = {
    meetings: `After each ${phaseLabel[phase]} meeting, record attendance and give each student a mark out of 100. The average becomes the advisor marks (out of ${cfg[phase].advisor}). Sign the declaration in the last meeting.`,
    submissions: 'Open each upload, then approve it or ask for changes. A group can re-upload only after you ask for changes.',
    jury: `Enter ${phaseLabel[phase]} evaluation marks for each student of the groups you judge.`,
  }[mode]

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      {mode !== 'submissions' && cfg.published[phase] && <LockedNote phase={phase} />}
      <Panel padded={false}>
        {groups.length === 0 ? (
          <EmptyState icon={icon} title={empty} />
        ) : (
          <ul className="divide-y divide-black/5">
            {groups.map((g) => {
              const members = data.members.filter((m) => m.group_id === g.id)
              let line = ''
              let badge: React.ReactNode = null
              if (mode === 'meetings') {
                const meetings = data.marks.sessions.filter((s) => s.group_id === g.id && s.phase === phase).length
                const over = members.filter((m) => absencesIn(data.marks, m.id, phase) > cfg.absenceLimit).length
                line = `${meetings} ${phaseLabel[phase]} meeting${meetings === 1 ? '' : 's'} · declaration ${isSigned(data.marks, g.id, phase) ? 'signed' : 'not signed'}`
                if (over) badge = <Badge tone="red">{over} over absence limit</Badge>
              } else if (mode === 'submissions') {
                const waiting = data.work.deliverables.filter((d) => versionsOf(data.work, d, g.id)[0]?.status === 'submitted').length
                const approved = data.work.deliverables.filter((d) => versionsOf(data.work, d, g.id)[0]?.status === 'approved').length
                line = `${approved} of ${data.work.deliverables.length} approved`
                if (waiting) badge = <Badge tone="blue">{waiting} to review</Badge>
              } else {
                const done = (c: string) => members.filter((m) => data.marks.marks.some((x) => x.member_id === m.id && x.component === c)).length
                line = comps.map((c) => `${c === 'proposal' ? 'Proposal' : 'Internal'} ${done(c)}/${members.length}`).join(' · ')
                if (members.length && comps.every((c) => done(c) === members.length)) badge = <Badge tone="green">Done</Badge>
                if (!isSigned(data.marks, g.id, phase)) badge = <>{badge}<Badge tone="amber">Declaration not signed</Badge></>
              }
              return (
                <li key={g.id}>
                  <Link to={`${base}/${g.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-black/[0.025]">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{g.name} <span className="font-mono text-[11px] text-ink-3 font-normal">{g.code}</span></div>
                      <div className="text-xs text-ink-3 truncate">{members.length} students · {line}</div>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">{badge}</div>
                    <ChevronRight size={16} className="text-ink-3 shrink-0" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </>
  )
}
