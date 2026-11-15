/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import { Check, CircleAlert, MessageSquareText, Star, Trophy } from 'lucide-react'
import type { ProposalStatus } from '../lib/adminApi'
import type { Proposal, ProposalEvent } from '../lib/proposalsApi'
import { Badge, cx, formatDate } from '../components/ui'

export const PROJECT_TYPES = ['Development', 'Research', 'Research & Development']
export const DOMAINS = [
  'Web application',
  'Mobile application',
  'Artificial intelligence / Machine learning',
  'Data science',
  'Internet of Things',
  'Cyber security',
  'Blockchain',
  'Game development',
  'Cloud / DevOps',
  'Computer vision',
  'Networking',
  'Other',
]

export const statusLabel: Record<ProposalStatus, string> = {
  not_started: 'Not started',
  draft: 'Draft',
  submitted: 'With supervisor',
  revision_requested: 'Changes requested',
  supervisor_endorsed: 'Waiting for approval',
  approved: 'Approved',
}

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const tone = status === 'approved' ? 'green' : status === 'revision_requested' ? 'red' : status === 'supervisor_endorsed' || status === 'submitted' ? 'blue' : 'grey'
  return <Badge tone={tone}>{statusLabel[status]}</Badge>
}

/** Four-step tracker: write → supervisor → coordinator → approved. */
export function ProposalSteps({ status }: { status: ProposalStatus }) {
  const steps = ['Write 3 ideas', 'Supervisor review', 'Coordinator approval', 'Approved']
  const current = status === 'approved' ? 4 : status === 'supervisor_endorsed' ? 2 : status === 'submitted' ? 1 : 0
  const revision = status === 'revision_requested'
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Proposal progress">
      {steps.map((label, i) => {
        const done = i < current
        const here = i === current && current < 4
        return (
          <li key={label} className="flex flex-col gap-2 min-w-0">
            <span className={cx('h-1.5 rounded-full', done ? 'bg-good' : here ? (revision ? 'bg-bad' : 'bg-accent') : 'bg-black/[0.07]')} />
            <span className={cx('text-xs flex items-center gap-1 min-w-0', done ? 'text-good font-medium' : here ? 'text-ink font-semibold' : 'text-ink-3')}>
              {done && <Check size={13} strokeWidth={3} className="shrink-0" />}
              {here && revision && <CircleAlert size={13} className="text-bad shrink-0" />}
              <span className="truncate">{label}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1">{label}</div>
      <div className="text-sm text-ink whitespace-pre-line leading-relaxed">{children}</div>
    </div>
  )
}

/** Read-only view of one idea, used by group, supervisor and coordinator. */
export function ProposalDetail({ proposal, approved, footer }: { proposal: Proposal | undefined; slot: number; approved?: boolean; footer?: ReactNode }) {
  if (!proposal) return <p className="text-[13px] text-ink-3">Not written yet.</p>
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug">{proposal.title || 'Untitled idea'}</h3>
        <div className="flex gap-1 shrink-0">
          {approved && <Badge tone="green"><Trophy size={11} className="mr-1" />Official project</Badge>}
          {proposal.recommended && !approved && <Badge tone="blue"><Star size={11} className="mr-1" />Recommended</Badge>}
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {proposal.project_type && <Badge tone="grey">{proposal.project_type}</Badge>}
        {proposal.domain && <Badge tone="grey">{proposal.domain}</Badge>}
      </div>
      <Section label="Abstract">{proposal.summary || '—'}</Section>
      <div className="grid sm:grid-cols-2 gap-4">
        <Section label="Objectives">{proposal.objectives || '—'}</Section>
        <Section label="Expected outcomes">{proposal.outcomes || '—'}</Section>
      </div>
      {proposal.apis && <Section label="APIs used">{proposal.apis}</Section>}
      {proposal.tech_stack.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {proposal.tech_stack.map((t) => (
            <span key={t} className="h-6 px-2.5 rounded-md bg-black/[0.05] text-xs font-medium grid place-items-center">{t}</span>
          ))}
        </div>
      )}
      {proposal.supervisor_note && (
        <div className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13px] flex gap-2">
          <MessageSquareText size={15} className="text-accent shrink-0 mt-0.5" />
          <span><span className="font-semibold">Supervisor note: </span>{proposal.supervisor_note}</span>
        </div>
      )}
      {footer}
    </div>
  )
}

const eventText: Record<ProposalEvent['action'], string> = {
  submitted: 'Sent the three proposals for review',
  revision_requested: 'Asked for changes',
  endorsed: 'Recommended a proposal and sent it for approval',
  approved: 'Approved the official project',
}
const roleText = { group: 'Group', supervisor: 'Supervisor', coordinator: 'FYP coordinator' }

export function ProposalHistory({ events, names = {} }: { events: ProposalEvent[]; names?: Record<string, string> }) {
  if (events.length === 0) return <p className="text-[13px] text-ink-3">Nothing has happened yet.</p>
  return (
    <ol className="space-y-4">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span className={cx('w-2 h-2 rounded-full mt-1.5 shrink-0', e.action === 'approved' ? 'bg-good' : e.action === 'revision_requested' ? 'bg-bad' : 'bg-accent')} />
          <div className="min-w-0 text-[13px]">
            <div className="text-ink">
              <span className="font-semibold">{(e.actor_id && names[e.actor_id]) || roleText[e.actor_role]}</span> · {eventText[e.action] ?? e.action}
            </div>
            {e.comment && <div className="mt-1 rounded-lg bg-black/[0.04] px-3 py-2 text-ink-2 whitespace-pre-line">“{e.comment}”</div>}
            <div className="text-xs text-ink-3 mt-1">{formatDate(e.created_at)}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Tabs to switch between idea 1, 2 and 3. */
export function IdeaTabs({ value, onChange, proposals, mark }: { value: number; onChange: (slot: number) => void; proposals: Proposal[]; mark?: (p: Proposal | undefined) => ReactNode }) {
  return (
    <div role="tablist" aria-label="Ideas" className="flex gap-1 p-1 rounded-xl bg-black/[0.05] w-fit">
      {[1, 2, 3].map((slot) => {
        const p = proposals.find((x) => x.slot === slot)
        return (
          <button key={slot} type="button" role="tab" aria-selected={value === slot} onClick={() => onChange(slot)}
            className={cx('h-8 px-3 rounded-lg text-[13px] cursor-pointer flex items-center gap-1.5', value === slot ? 'bg-white shadow-sm font-medium' : 'text-ink-2')}>
            Idea {slot} {mark?.(p)}
          </button>
        )
      })}
    </div>
  )
}
