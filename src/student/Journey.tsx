import { Link } from 'react-router-dom'
import { CalendarClock, Check } from 'lucide-react'
import type { StudentData } from './StudentData'
import { isSigned, marksConfig, phaseLabel, type Phase } from '../lib/marksApi'
import { deliverableState, dueFor, type DeliverableState } from '../lib/workflowApi'
import { Badge, Panel, cx } from '../components/ui'
import { StateBadge, timeLeft } from '../workflow/shared'

type StepState = 'done' | 'now' | 'later'

/** The whole FYP as six steps, and the next deadlines. */
export function Journey({ data }: { data: StudentData }) {
  const cfg = marksConfig(data.settings)
  const { group, work, record } = data
  const delivs = (p: Phase) => work.deliverables.filter((d) => d.phase === p)
  const allApproved = (p: Phase) => delivs(p).length > 0 && delivs(p).every((d) => deliverableState(work, d, group.id) === 'approved')

  const raw: { title: string; detail: string; done: boolean; to: string }[] = [
    { title: 'Proposal defence', detail: group.proposal_status === 'approved' ? 'Official project approved' : 'Three ideas → supervisor → coordinator', done: group.proposal_status === 'approved', to: '/student/proposals' },
    { title: 'FYP-1 work', detail: `${delivs('fyp1').filter((d) => deliverableState(work, d, group.id) === 'approved').length} of ${delivs('fyp1').length} submissions approved`, done: allApproved('fyp1'), to: '/student/submissions' },
    { title: 'FYP-1 declaration & evaluation', detail: record.published.fyp1 ? 'Results published' : isSigned(record, group.id, 'fyp1') ? 'Declaration signed' : 'Supervisor signs in the last meeting', done: record.published.fyp1, to: '/student/results' },
    { title: 'FYP-2 work', detail: `${delivs('fyp2').filter((d) => deliverableState(work, d, group.id) === 'approved').length} of ${delivs('fyp2').length} submissions approved`, done: allApproved('fyp2'), to: '/student/submissions' },
    { title: 'FYP-2 declaration & internal', detail: isSigned(record, group.id, 'fyp2') ? 'Declaration signed' : 'Demo video, poster, report', done: isSigned(record, group.id, 'fyp2'), to: '/student/meetings' },
    { title: 'External evaluation', detail: record.published.fyp2 ? 'Final results published' : 'In front of industry experts', done: record.published.fyp2, to: '/student/results' },
  ]
  const firstOpen = raw.findIndex((s) => !s.done)
  const steps = raw.map((s, i) => ({ ...s, state: (s.done ? 'done' : i === firstOpen ? 'now' : 'later') as StepState }))

  const upcoming = work.deliverables
    .map((d) => ({ d, due: dueFor(work, d, group.id), state: deliverableState(work, d, group.id) as DeliverableState }))
    .filter((x) => x.state === 'open' || x.state === 'changes_requested')
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 4)

  return (
    <div className="grid xl:grid-cols-[1.4fr_1fr] gap-5 mb-5 items-start">
      <Panel title="Your FYP journey" action={<Badge tone="blue">Now: {phaseLabel[cfg.currentPhase]}</Badge>}>
        <ol className="grid sm:grid-cols-2 gap-2">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Link to={s.to} className={cx('flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-black/[0.035]', s.state === 'now' && 'bg-accent-soft hover:bg-accent-soft')}>
                <span className={cx('w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold shrink-0', s.state === 'done' ? 'bg-good text-white' : s.state === 'now' ? 'bg-accent text-white' : 'bg-black/[0.06] text-ink-2')}>
                  {s.state === 'done' ? <Check size={13} strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cx('block text-[13px] font-medium', s.state === 'later' && 'text-ink-2')}>{s.title}</span>
                  <span className="block text-xs text-ink-3">{s.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title={<span className="flex items-center gap-2"><CalendarClock size={16} className="text-ink-3" />Next deadlines</span>}>
        {upcoming.length === 0 ? (
          <p className="text-[13px] text-ink-3">Nothing due right now.</p>
        ) : (
          <ul className="space-y-2.5">
            {upcoming.map(({ d, due, state }) => (
              <li key={d.id}>
                <Link to="/student/submissions" className="flex items-center gap-3 rounded-lg -mx-2 px-2 py-1.5 hover:bg-black/[0.035]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium truncate">{d.title}</span>
                    <span className="block text-xs text-ink-3">{state === 'changes_requested' ? 'Upload a new version' : timeLeft(due)}</span>
                  </span>
                  <StateBadge state={state} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
