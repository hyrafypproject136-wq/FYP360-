/* eslint-disable react-refresh/only-export-components */
import { useRef, useState, type ReactNode } from 'react'
import { Check, Download, FileText, Film, Undo2, Upload, X } from 'lucide-react'
import {
  canUploadNow,
  changeStatusLabel,
  decideChangeRequest,
  deliverableState,
  dueFor,
  formatBytes,
  LIMITS,
  openSubmission,
  reviewSubmission,
  uploadSubmission,
  versionsOf,
  type ChangeRequest,
  type Deliverable,
  type DeliverableState,
  type Submission,
  type WorkflowData,
} from '../lib/workflowApi'
import { phaseLabel } from '../lib/marksApi'
import { errorMessage } from '../lib/supabase'
import { Badge, Button, ErrorBox, Field, Modal, ModalActions, Panel, cx, formatDate, textareaCls, useAsync } from '../components/ui'

// ------------------------------------------------------------------ small bits

export function StateBadge({ state }: { state: DeliverableState }) {
  switch (state) {
    case 'approved':
      return <Badge tone="green">Approved</Badge>
    case 'submitted':
      return <Badge tone="blue">Waiting for review</Badge>
    case 'changes_requested':
      return <Badge tone="red">Changes requested</Badge>
    case 'missed':
      return <Badge tone="red">Missed</Badge>
    default:
      return <Badge tone="grey">Not submitted</Badge>
  }
}

export function timeLeft(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return 'deadline passed'
  const h = Math.floor(ms / 3600000)
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))} min left`
  if (h < 48) return `${h} h left`
  return `${Math.floor(h / 24)} days left`
}

export function DueLine({ due, extended }: { due: string; extended?: boolean }) {
  const passed = new Date(due).getTime() < Date.now()
  return (
    <span className={cx('text-xs', passed ? 'text-bad' : 'text-ink-3')}>
      Due {formatDate(due)} · {timeLeft(due)}
      {extended && <span className="text-accent"> · extended for your group</span>}
    </span>
  )
}

const KindIcon = ({ kind }: { kind: Deliverable['kind'] }) => (kind === 'video' ? <Film size={16} className="text-ink-3 shrink-0" /> : <FileText size={16} className="text-ink-3 shrink-0" />)

function OpenFile({ s }: { s: Submission }) {
  const [err, setErr] = useState<string | null>(null)
  return (
    <>
      <button type="button" onClick={() => openSubmission(s.file_path).catch((e) => setErr(errorMessage(e)))}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline cursor-pointer min-w-0">
        <Download size={13} className="shrink-0" /><span className="truncate">{s.file_name}</span>
      </button>
      {err && <span className="text-xs text-bad ml-2">{err}</span>}
    </>
  )
}

/** All uploads of one deliverable, newest first, with supervisor feedback. */
export function VersionList({ versions, names = {} }: { versions: Submission[]; names?: Record<string, string> }) {
  if (versions.length === 0) return null
  return (
    <ol className="space-y-2.5">
      {versions.map((s) => (
        <li key={s.id} className="rounded-xl bg-black/[0.03] px-3.5 py-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-ink-2 whitespace-nowrap">v{s.version}</span>
            <div className="min-w-0 flex-1"><OpenFile s={s} /></div>
            <span className="text-xs text-ink-3 whitespace-nowrap">{formatBytes(s.file_size)} · {formatDate(s.submitted_at)}</span>
            <StateBadge state={s.status} />
          </div>
          {s.feedback && (
            <div className="mt-2 text-[13px] text-ink-2 whitespace-pre-line">
              <span className="font-semibold text-ink">{(s.reviewed_by && names[s.reviewed_by]) || 'Supervisor'}: </span>
              {s.feedback}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

// ------------------------------------------------------------------ group: upload

export function DeliverableCard({ w, d, groupId, active, onUploaded }: { w: WorkflowData; d: Deliverable; groupId: string; active: boolean; onUploaded: (msg: string) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null)
  const { error, busy, attempt } = useAsync()
  const state = deliverableState(w, d, groupId)
  const versions = versionsOf(w, d, groupId)
  const due = dueFor(w, d, groupId)
  const open = active && canUploadNow(w, d, groupId)

  const pick = async (file: File | undefined) => {
    if (!file) return
    const ok = await attempt(async () => (await uploadSubmission(groupId, d, file), true))
    if (input.current) input.current.value = ''
    if (ok) await onUploaded(`"${d.title}" uploaded.`)
  }

  const note: Record<DeliverableState, string> = {
    open: `Upload before the deadline. ${LIMITS[d.kind].label}.`,
    changes_requested: 'Your supervisor asked for changes. Upload a new version (the deadline does not apply).',
    submitted: 'Your supervisor will review this upload. You can upload again only if they ask for changes.',
    approved: 'Approved by your supervisor.',
    missed: 'The deadline has passed. Ask the FYP coordinator for an extension.',
  }

  return (
    <Panel>
      <div className="flex items-start gap-3">
        <KindIcon kind={d.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold">{d.title}</h3>
            <Badge tone="grey">{phaseLabel[d.phase]}</Badge>
            <StateBadge state={state} />
          </div>
          <DueLine due={due} extended={due !== d.due_at} />
          {d.description && <p className="text-[13px] text-ink-2 mt-2 whitespace-pre-line">{d.description}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <p className="text-xs text-ink-3">{note[state]}</p>
        {open && (
          <div>
            <input ref={input} type="file" accept={LIMITS[d.kind].accept} className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label={`File for ${d.title}`} />
            <Button icon={Upload} disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : versions.length ? 'Upload new version' : 'Upload file'}</Button>
          </div>
        )}
        <ErrorBox message={error} />
        <VersionList versions={versions} />
      </div>
    </Panel>
  )
}

// ------------------------------------------------------------------ supervisor: review

export function ReviewDialog({ s, d, decision, onClose, onDone }: { s: Submission; d: Deliverable; decision: 'approve' | 'changes'; onClose: () => void; onDone: (msg: string) => Promise<void> }) {
  const [feedback, setFeedback] = useState('')
  const { error, busy, attempt } = useAsync()
  const send = async () => {
    const ok = await attempt(async () => (await reviewSubmission(s.id, decision, feedback), true))
    if (ok) await onDone(decision === 'approve' ? `"${d.title}" approved.` : 'Changes requested. The group can upload again.')
  }
  return (
    <Modal title={decision === 'approve' ? `Approve "${d.title}"?` : 'Ask for changes'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-ink-2">{decision === 'approve' ? `Version ${s.version} becomes the final upload for this deliverable.` : 'The group can upload a new version, even after the deadline.'}</p>
        <Field label={decision === 'approve' ? 'Comment (optional)' : 'What should they change?'}>
          <textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} className={textareaCls} />
        </Field>
        <ErrorBox message={error} />
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || (decision === 'changes' && !feedback.trim())} onClick={send} className={decision === 'changes' ? '!bg-bad hover:!bg-bad/90' : ''}>
            {busy ? 'Sending…' : decision === 'approve' ? 'Approve' : 'Send back'}
          </Button>
        </ModalActions>
      </div>
    </Modal>
  )
}

/** One deliverable of one group, as the supervisor (or coordinator / jury) sees it. */
export function ReviewCard({ w, d, groupId, canReview, names, onDone }: { w: WorkflowData; d: Deliverable; groupId: string; canReview: boolean; names: Record<string, string>; onDone: (msg: string) => Promise<void> }) {
  const [dialog, setDialog] = useState<null | 'approve' | 'changes'>(null)
  const versions = versionsOf(w, d, groupId)
  const latest = versions[0]
  const due = dueFor(w, d, groupId)
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <KindIcon kind={d.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold">{d.title}</h3>
            <Badge tone="grey">{phaseLabel[d.phase]}</Badge>
            <StateBadge state={deliverableState(w, d, groupId)} />
          </div>
          <DueLine due={due} />
        </div>
        {canReview && latest?.status === 'submitted' && (
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="danger" icon={Undo2} onClick={() => setDialog('changes')}>Changes</Button>
            <Button size="sm" icon={Check} onClick={() => setDialog('approve')}>Approve</Button>
          </div>
        )}
      </div>
      <div className="mt-4">
        {versions.length ? <VersionList versions={versions} names={names} /> : <p className="text-[13px] text-ink-3">Nothing uploaded yet.</p>}
      </div>
      {dialog && latest && (
        <ReviewDialog s={latest} d={d} decision={dialog} onClose={() => setDialog(null)} onDone={async (m) => { setDialog(null); await onDone(m) }} />
      )}
    </Panel>
  )
}

// ------------------------------------------------------------------ change requests

export function ChangeBadge({ status }: { status: ChangeRequest['status'] }) {
  const tone = status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'amber'
  return <Badge tone={tone}>{changeStatusLabel[status]}</Badge>
}

function Step({ who, when, comment, tone }: { who: string; when: string | null; comment: string | null; tone: 'good' | 'bad' | 'wait' }) {
  return (
    <li className="flex gap-3">
      <span className={cx('w-2 h-2 rounded-full mt-1.5 shrink-0', tone === 'good' ? 'bg-good' : tone === 'bad' ? 'bg-bad' : 'bg-black/15')} />
      <div className="text-[13px] min-w-0">
        <div className="font-medium">{who}</div>
        {comment && <div className="mt-1 rounded-lg bg-black/[0.04] px-3 py-2 text-ink-2 whitespace-pre-line">“{comment}”</div>}
        {when && <div className="text-xs text-ink-3 mt-1">{formatDate(when)}</div>}
      </div>
    </li>
  )
}

/** A change request with its jury → coordinator trail. `canDecide` shows approve / reject. */
export function ChangeRequestCard({ c, names, groupLabel, canDecide, onDone }: { c: ChangeRequest; names: Record<string, string>; groupLabel?: ReactNode; canDecide?: boolean; onDone?: (msg: string) => Promise<void> }) {
  const [dialog, setDialog] = useState<null | boolean>(null)
  const [comment, setComment] = useState('')
  const { error, busy, attempt } = useAsync()
  const juryDone = c.jury_at !== null
  const send = async () => {
    const ok = await attempt(async () => (await decideChangeRequest(c.id, dialog!, comment), true))
    if (ok) {
      setDialog(null)
      await onDone?.(dialog ? 'Change request approved.' : 'Change request rejected.')
    }
  }
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          {groupLabel && <div className="text-xs text-ink-3 mb-0.5">{groupLabel}</div>}
          <h3 className="text-[15px] font-semibold">{c.title}</h3>
          <div className="text-xs text-ink-3">Asked {formatDate(c.created_at)}</div>
        </div>
        <ChangeBadge status={c.status} />
      </div>
      <p className="text-[13px] text-ink-2 whitespace-pre-line mb-4">{c.details}</p>
      <ol className="space-y-3">
        <Step
          who={juryDone ? `Jury: ${(c.jury_by && names[c.jury_by]) || 'jury member'} ${c.status === 'rejected' && !c.coord_at ? 'rejected' : 'approved'}` : 'Waiting for the jury'}
          when={c.jury_at} comment={c.jury_comment} tone={!juryDone ? 'wait' : c.status === 'rejected' && !c.coord_at ? 'bad' : 'good'}
        />
        {(juryDone && !(c.status === 'rejected' && !c.coord_at)) && (
          <Step
            who={c.coord_at ? `FYP coordinator ${c.status === 'approved' ? 'approved' : 'rejected'}` : 'Waiting for the FYP coordinator'}
            when={c.coord_at} comment={c.coord_comment} tone={!c.coord_at ? 'wait' : c.status === 'approved' ? 'good' : 'bad'}
          />
        )}
      </ol>
      {canDecide && (
        <div className="mt-4 flex gap-2 justify-end">
          <Button size="sm" variant="danger" icon={X} onClick={() => { setComment(''); setDialog(false) }}>Reject</Button>
          <Button size="sm" icon={Check} onClick={() => { setComment(''); setDialog(true) }}>Approve</Button>
        </div>
      )}
      {dialog !== null && (
        <Modal title={dialog ? 'Approve this change?' : 'Reject this change?'} onClose={() => setDialog(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-ink-2">All changes need written approval. The group will see your comment.</p>
            <Field label="Your written decision"><textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} className={textareaCls} /></Field>
            <ErrorBox message={error} />
            <ModalActions>
              <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
              <Button disabled={busy || !comment.trim()} onClick={send} className={dialog ? '' : '!bg-bad hover:!bg-bad/90'}>{busy ? 'Sending…' : dialog ? 'Approve' : 'Reject'}</Button>
            </ModalActions>
          </div>
        </Modal>
      )}
    </Panel>
  )
}
