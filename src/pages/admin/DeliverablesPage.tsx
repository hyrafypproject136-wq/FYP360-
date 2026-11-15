import { useState, type FormEvent } from 'react'
import { CalendarClock, FileText, Film, Inbox, Pencil, Plus, Trash2 } from 'lucide-react'
import { membersOf, profileName, useAdminData } from '../../admin/AdminData'
import { phaseLabel, type Phase } from '../../lib/marksApi'
import {
  deleteDeliverable,
  deliverableState,
  dueFor,
  saveDeliverable,
  setExtension,
  type Deliverable,
  type DeliverableDraft,
  type DeliverableKind,
} from '../../lib/workflowApi'
import type { Group } from '../../lib/adminApi'
import { Badge, Button, EmptyState, ErrorBox, Field, Modal, ModalActions, Panel, cx, formatDate, inputCls, textareaCls, useAsync } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { PhaseTabs } from '../../marks/shared'
import { DueLine, ReviewCard, StateBadge } from '../../workflow/shared'

/** Common FYP deliverables, to save typing. */
const TEMPLATES: { phase: Phase; title: string; kind: DeliverableKind; description: string }[] = [
  { phase: 'fyp1', title: 'Proposal document', kind: 'document', description: 'Three proposals in the official proposal format.' },
  { phase: 'fyp1', title: 'FYP-1 report', kind: 'document', description: 'About 70% of the work: correct formatting, labelled and visible diagrams, clear business flow, real data.' },
  { phase: 'fyp2', title: 'FYP-2 report', kind: 'document', description: 'Final report with proper formatting and diagrams.' },
  { phase: 'fyp2', title: 'Demo video', kind: 'video', description: 'A 4–5 minute demo of the working project.' },
  { phase: 'fyp2', title: 'Poster', kind: 'document', description: 'Project poster for the evaluation.' },
]

/** ISO → value for <input type="datetime-local"> in local time. */
const toLocal = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const inAWeek = () => {
  const d = new Date(Date.now() + 7 * 864e5)
  d.setHours(23, 59, 0, 0)
  return d.toISOString()
}

function DeliverableDialog({ d, phase, onClose }: { d: Deliverable | null; phase: Phase; onClose: () => void }) {
  const { reload, toast } = useAdminData()
  const [form, setForm] = useState<DeliverableDraft>(d ? { phase: d.phase, title: d.title, description: d.description, kind: d.kind, due_at: d.due_at } : { phase, title: '', description: '', kind: 'document', due_at: inAWeek() })
  const { error, setError, busy, attempt } = useAsync()
  const set = <K extends keyof DeliverableDraft>(k: K, v: DeliverableDraft[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.title.trim().length < 3) return setError('Give it a title of at least 3 characters.')
    const ok = await attempt(async () => (await saveDeliverable(d?.id ?? null, { ...form, title: form.title.trim(), description: form.description.trim() }), true))
    if (ok) {
      toast(d ? 'Deliverable updated.' : 'Deliverable added. Groups can see it now.')
      await reload()
      onClose()
    }
  }

  return (
    <Modal title={d ? 'Edit deliverable' : 'New deliverable'} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!d && (
          <div className="flex gap-1.5 flex-wrap">
            {TEMPLATES.filter((t) => t.phase === form.phase).map((t) => (
              <button key={t.title} type="button" onClick={() => setForm((f) => ({ ...f, title: t.title, kind: t.kind, description: t.description }))}
                className="h-7 px-2.5 rounded-full bg-black/[0.05] hover:bg-black/10 text-xs cursor-pointer">{t.title}</button>
            ))}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Title"><input required value={form.title} maxLength={120} onChange={(e) => set('title', e.target.value)} className={inputCls} /></Field>
          <Field label="Phase">
            <select value={form.phase} onChange={(e) => set('phase', e.target.value as Phase)} className={inputCls}>
              <option value="fyp1">FYP-1</option>
              <option value="fyp2">FYP-2</option>
            </select>
          </Field>
          <Field label="File type">
            <select value={form.kind} onChange={(e) => set('kind', e.target.value as DeliverableKind)} className={inputCls}>
              <option value="document">Document (PDF, Word, PowerPoint, ZIP, image · 20 MB)</option>
              <option value="video">Video (MP4, MOV · 50 MB)</option>
            </select>
          </Field>
          <Field label="Deadline" hint="Uploads close at this time.">
            <input type="datetime-local" required value={toLocal(form.due_at)} onChange={(e) => e.target.value && set('due_at', new Date(e.target.value).toISOString())} className={inputCls} />
          </Field>
        </div>
        <Field label="Instructions for groups (optional)"><textarea rows={3} value={form.description} maxLength={2000} onChange={(e) => set('description', e.target.value)} className={textareaCls} /></Field>
        <ErrorBox message={error} />
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : d ? 'Save' : 'Add deliverable'}</Button>
        </ModalActions>
      </form>
    </Modal>
  )
}

/** One group × one deliverable: files, review, and a per-group extension. */
function CellDialog({ d, g, onClose }: { d: Deliverable; g: Group; onClose: () => void }) {
  const { data, reload, toast } = useAdminData()
  const current = data.work.extensions.find((e) => e.deliverable_id === d.id && e.group_id === g.id)
  const [due, setDue] = useState(current?.due_at ?? new Date(Math.max(Date.now(), new Date(d.due_at).getTime()) + 3 * 864e5).toISOString())
  const { error, busy, attempt } = useAsync()
  const names = Object.fromEntries(data.profiles.map((p) => [p.id, p.display_name]))
  const save = async (value: string | null) => {
    const ok = await attempt(async () => (await setExtension(d.id, g.id, value), true))
    if (ok) {
      toast(value ? `Deadline extended for ${g.code}.` : `Extension removed for ${g.code}.`)
      await reload()
    }
  }
  return (
    <Modal title={`${g.code} · ${d.title}`} onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <ReviewCard w={data.work} d={d} groupId={g.id} canReview names={names} onDone={async (m) => { await reload(); toast(m) }} />
        <div>
          <div className="text-[13px] font-semibold mb-1">Extension for this group only</div>
          <p className="text-xs text-ink-3 mb-3">Normal deadline: {formatDate(d.due_at)}.{current && ` Extended to ${formatDate(current.due_at)}.`}</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input type="datetime-local" value={toLocal(due)} onChange={(e) => e.target.value && setDue(new Date(e.target.value).toISOString())} className={cx(inputCls, 'w-auto')} aria-label="New deadline" />
            <Button disabled={busy} onClick={() => save(due)}>{current ? 'Change extension' : 'Extend deadline'}</Button>
            {current && <Button variant="secondary" disabled={busy} onClick={() => save(null)}>Remove</Button>}
          </div>
          <ErrorBox message={error} />
        </div>
        <ModalActions><Button variant="secondary" onClick={onClose}>Close</Button></ModalActions>
      </div>
    </Modal>
  )
}

export default function DeliverablesPage() {
  const { data, run } = useAdminData()
  const [phase, setPhase] = useState<Phase>(data.settings.current_phase === 'fyp2' ? 'fyp2' : 'fyp1')
  const [tab, setTab] = useState<'tracker' | 'setup'>('tracker')
  const [editing, setEditing] = useState<null | 'new' | Deliverable>(null)
  const [cell, setCell] = useState<null | { d: Deliverable; g: Group }>(null)
  const list = data.work.deliverables.filter((d) => d.phase === phase)
  const groups = data.groups.filter((g) => g.status === 'active').sort((a, b) => a.code.localeCompare(b.code))
  const used = (d: Deliverable) => data.work.submissions.some((s) => s.deliverable_id === d.id)

  return (
    <>
      <PageHeader
        title="Submissions"
        subtitle="Set what each group must upload and by when. Uploads close at the deadline; extend it for one group from the tracker."
        actions={<Button icon={Plus} onClick={() => setEditing('new')}>New deliverable</Button>}
      />
      <div className="flex flex-wrap gap-3 mb-4">
        <PhaseTabs value={phase} onChange={setPhase} tabs={(['fyp1', 'fyp2'] as const).map((p) => ({ id: p, label: phaseLabel[p] }))} />
        <PhaseTabs value={tab} onChange={setTab} tabs={[{ id: 'tracker', label: 'Tracker' }, { id: 'setup', label: `Deliverables ${list.length}` }]} />
      </div>

      {list.length === 0 ? (
        <Panel><EmptyState icon={Inbox} title={`No ${phaseLabel[phase]} deliverables yet`}>Add the proposal document, reports, demo video and poster with their deadlines.</EmptyState></Panel>
      ) : tab === 'setup' ? (
        <Panel padded={false}>
          <ul className="divide-y divide-black/5">
            {list.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-5 py-3.5">
                {d.kind === 'video' ? <Film size={16} className="text-ink-3" /> : <FileText size={16} className="text-ink-3" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{d.title}</div>
                  <DueLine due={d.due_at} />
                </div>
                <Badge tone="grey">{data.work.submissions.filter((s) => s.deliverable_id === d.id && s.status === 'approved').length} approved</Badge>
                <Button variant="ghost" size="sm" icon={Pencil} aria-label={`Edit ${d.title}`} onClick={() => setEditing(d)} />
                <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Delete ${d.title}`} disabled={used(d)} title={used(d) ? 'Groups already uploaded work' : undefined}
                  onClick={() => window.confirm(`Delete "${d.title}"?`) && run(() => deleteDeliverable(d.id), 'Deliverable deleted.')} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <Panel padded={false}>
          {groups.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No active groups" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-ink-3 border-b border-black/5">
                    <th className="font-medium px-5 py-2.5">Group</th>
                    {list.map((d) => <th key={d.id} className="font-medium px-3 py-2.5 whitespace-nowrap">{d.title}<div className="text-[11px] font-normal">{formatDate(d.due_at)}</div></th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {groups.map((g) => (
                    <tr key={g.id}>
                      <td className="px-5 py-2.5">
                        <div className="font-mono text-xs font-semibold whitespace-nowrap">{g.code}</div>
                        <div className="text-xs text-ink-3 max-w-[180px] truncate">{g.name} · {membersOf(data, g.id).length} · {profileName(data, g.supervisor_id) ?? 'no supervisor'}</div>
                      </td>
                      {list.map((d) => (
                        <td key={d.id} className="px-3 py-2.5">
                          <button type="button" onClick={() => setCell({ d, g })} className="cursor-pointer hover:opacity-80 flex flex-col items-start gap-0.5" aria-label={`${g.code} ${d.title}`}>
                            <StateBadge state={deliverableState(data.work, d, g.id)} />
                            {dueFor(data.work, d, g.id) !== d.due_at && <span className="text-[11px] text-accent">extended</span>}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {editing && <DeliverableDialog d={editing === 'new' ? null : editing} phase={phase} onClose={() => setEditing(null)} />}
      {cell && <CellDialog d={cell.d} g={cell.g} onClose={() => setCell(null)} />}
    </>
  )
}
