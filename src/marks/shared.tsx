/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CalendarDays, CalendarPlus, FileSignature, Lock, Pencil, Save, Trash2 } from 'lucide-react'
import type { Group, Member } from '../lib/adminApi'
import {
  calcFinal,
  calcPhase,
  componentLabel,
  componentMax,
  deleteClassSession,
  fmt,
  phaseLabel,
  saveClassSession,
  saveEvaluationMarks,
  setDeclaration,
  type AttendanceStatus,
  type ClassSession,
  type EvalComponent,
  type MarksConfig,
  type MarksData,
  type Phase,
  type PhaseResult,
} from '../lib/marksApi'
import { Badge, Button, EmptyState, ErrorBox, Field, Modal, ModalActions, Panel, cx, formatDate, inputCls, useAsync } from '../components/ui'

export const ACCEPTANCE_CRITERIA = [
  'Domain knowledge',
  'Technology used',
  'Problem statement',
  'Feasibility of idea',
  'Scope of the project',
  'Elements of innovation',
  'Social impact',
]

export const EVAL_HINT: Record<EvalComponent, string> = {
  proposal: `Judge on: ${ACCEPTANCE_CRITERIA.join(', ')}.`,
  fyp1_internal: 'FYP-1 needs about 70% of the work done, a signed declaration, a proper report and a clear business flow, using real data.',
  fyp2_internal: 'FYP-2 needs 100% of the work done, a signed declaration, a 4–5 minute demo video, a poster and a proper report. Every member answers every question.',
  external: 'Marks given by the industry experts at the external evaluation.',
}

const lockedText = (phase: Phase) => `${phaseLabel[phase]} results are published, so its marks are locked. The FYP coordinator can unpublish them to allow changes.`

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "2026-09-12" → "12 Sep 2026" (no time-zone shift). */
export const dayLabel = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const numberCls = cx(inputCls.replace('w-full', 'w-24'), 'shrink-0 text-right tabular-nums')

export function LockedNote({ phase }: { phase: Phase }) {
  return (
    <p className="mb-5 flex items-center gap-2 rounded-xl bg-black/[0.04] px-3.5 py-2.5 text-[13px] text-ink-2">
      <Lock size={14} className="shrink-0" />
      {lockedText(phase)}
    </p>
  )
}

/** Absences used, e.g. "1 of 2 absences". */
export function AbsenceBadge({ count, limit }: { count: number; limit: number }) {
  if (count > limit) return <Badge tone="red">{count} absences · over limit</Badge>
  if (count === limit) return <Badge tone="amber">{count} of {limit} absences</Badge>
  return <Badge tone="grey">{count} of {limit} absences</Badge>
}

/** FYP-1 / FYP-2 switch. */
export function PhaseTabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string }[] }) {
  return (
    <div role="tablist" aria-label="Phase" className="flex gap-1 p-1 rounded-xl bg-black/[0.05] w-fit max-w-full overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx('h-8 px-3 rounded-lg text-[13px] whitespace-nowrap cursor-pointer', value === t.id ? 'bg-white shadow-sm font-medium' : 'text-ink-2')}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ class meetings (supervisor)

type Row = { status: AttendanceStatus; mark: string }

function SessionDialog({
  group, members, session, data, phase, onClose, onSaved,
}: {
  group: Group
  members: Member[]
  session: ClassSession | null
  data: MarksData
  phase: Phase
  onClose: () => void
  onSaved: (message: string) => Promise<void>
}) {
  const [heldOn, setHeldOn] = useState(session?.held_on ?? today())
  const [topic, setTopic] = useState(session?.topic ?? '')
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      members.map((m) => {
        const a = session && data.attendance.find((x) => x.session_id === session.id && x.member_id === m.id)
        return [m.id, { status: a?.status ?? 'present', mark: a?.mark != null ? String(a.mark) : '' }]
      }),
    ),
  )
  const { error, setError, busy, attempt } = useAsync()
  const setRow = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    for (const m of members) {
      const r = rows[m.id]
      if (r.status === 'present') {
        const v = Number(r.mark)
        if (r.mark.trim() === '' || !Number.isFinite(v) || v < 0 || v > 100) return setError(`Enter a mark from 0 to 100 for ${m.full_name}, or mark them absent.`)
      }
    }
    const payload = members.map((m) => ({ member_id: m.id, status: rows[m.id].status, mark: rows[m.id].status === 'present' ? Number(rows[m.id].mark) : null }))
    const ok = await attempt(async () => (await saveClassSession(group.id, session?.id ?? null, heldOn, topic, payload), true))
    if (ok) await onSaved(session ? 'Meeting updated.' : 'Meeting saved.')
  }

  return (
    <Modal title={session ? `Meeting on ${dayLabel(session.held_on)}` : `Record a ${phaseLabel[phase]} meeting`} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid sm:grid-cols-[180px_1fr] gap-4">
          <Field label="Date">
            <input type="date" required max={today()} value={heldOn} onChange={(e) => setHeldOn(e.target.value)} className={inputCls} />
          </Field>
          <Field label="What was discussed (optional)">
            <input value={topic} maxLength={300} onChange={(e) => setTopic(e.target.value)} className={inputCls} placeholder="e.g. Use case diagram review" />
          </Field>
        </div>
        <div>
          <div className="text-[13px] font-medium text-ink-2 mb-2">Attendance and class marks (out of 100)</div>
          <ul className="rounded-xl border border-line divide-y divide-black/5 bg-white/60">
            {members.map((m) => {
              const r = rows[m.id]
              return (
                <li key={m.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{m.full_name}</div>
                    <div className="text-xs text-ink-3 font-mono">{m.student_id}</div>
                  </div>
                  <div role="radiogroup" aria-label={`Attendance of ${m.full_name}`} className="flex p-0.5 rounded-lg bg-black/[0.05]">
                    {(['present', 'absent'] as const).map((s) => (
                      <button key={s} type="button" role="radio" aria-checked={r.status === s} onClick={() => setRow(m.id, { status: s })}
                        className={cx('h-7 px-2.5 rounded-md text-xs cursor-pointer capitalize', r.status === s ? (s === 'absent' ? 'bg-bad text-white font-medium' : 'bg-white shadow-sm font-medium') : 'text-ink-2')}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number" inputMode="decimal" min={0} max={100} step={0.5}
                    aria-label={`Class mark of ${m.full_name}`}
                    disabled={r.status === 'absent'}
                    value={r.status === 'absent' ? '' : r.mark}
                    placeholder={r.status === 'absent' ? '—' : '/100'}
                    onChange={(e) => setRow(m.id, { mark: e.target.value })}
                    className={numberCls}
                  />
                </li>
              )
            })}
          </ul>
        </div>
        <ErrorBox message={error} />
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" icon={Save} disabled={busy}>{busy ? 'Saving…' : 'Save meeting'}</Button>
        </ModalActions>
      </form>
    </Modal>
  )
}

/** Register of a group's meetings for one phase: one column per student. */
export function MeetingsPanel({
  group, members, data, cfg, phase, editable, onChanged, showAverage = true,
}: {
  group: Group
  members: Member[]
  data: MarksData
  cfg: MarksConfig
  phase: Phase
  /** New meetings are always recorded in the current phase; older phases can still be edited. */
  editable: boolean
  onChanged: (message: string) => Promise<void>
  /** Students see the average only after results are published. */
  showAverage?: boolean
}) {
  const [dialog, setDialog] = useState<null | 'new' | ClassSession>(null)
  const del = useAsync()
  const memberIds = new Set(members.map((m) => m.id))
  const sessions = data.sessions
    .filter((s) => s.phase === phase && (s.group_id === group.id || data.attendance.some((a) => a.session_id === s.id && memberIds.has(a.member_id))))
    .sort((a, b) => b.held_on.localeCompare(a.held_on))
  const cell = (sid: string, mid: string) => data.attendance.find((a) => a.session_id === sid && a.member_id === mid)
  const canAdd = editable && phase === cfg.currentPhase

  const remove = async (s: ClassSession) => {
    if (!window.confirm(`Delete the meeting on ${dayLabel(s.held_on)}? Its attendance and class marks will be removed.`)) return
    const ok = await del.attempt(async () => (await deleteClassSession(s.id), true))
    if (ok) await onChanged('Meeting deleted.')
  }

  return (
    <Panel
      padded={false}
      title={<span className="flex items-center gap-2"><CalendarDays size={16} className="text-ink-3" />{phaseLabel[phase]} meetings</span>}
      action={canAdd && members.length > 0 && <Button size="sm" icon={CalendarPlus} onClick={() => setDialog('new')}>Record meeting</Button>}
    >
      <ErrorBox message={del.error} />
      {members.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No students in this group" />
      ) : sessions.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No meetings recorded yet">
          {canAdd ? 'After each meeting, record who came and give each student a mark out of 100.' : 'Meetings appear here after the supervisor records them.'}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-ink-3 border-b border-black/5">
                <th className="font-medium px-5 py-2.5 whitespace-nowrap">Date</th>
                {members.map((m) => <th key={m.id} className="font-medium px-3 py-2.5 text-right whitespace-nowrap" title={m.full_name}>{m.full_name.split(' ')[0]}</th>)}
                {editable && <th className="w-0" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-2.5">
                    <div className="font-medium whitespace-nowrap">{dayLabel(s.held_on)}</div>
                    {s.topic && <div className="text-xs text-ink-3 max-w-[260px] truncate">{s.topic}</div>}
                  </td>
                  {members.map((m) => {
                    const a = cell(s.id, m.id)
                    return (
                      <td key={m.id} className="px-3 py-2.5 text-right tabular-nums">
                        {!a ? <span className="text-ink-3">—</span> : a.status === 'absent' ? <Badge tone="red">Absent</Badge> : a.mark === null ? <Badge tone="green">Present</Badge> : fmt(a.mark)}
                      </td>
                    )
                  })}
                  {editable && (
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      {s.group_id === group.id && (
                        <>
                          <button type="button" aria-label={`Edit meeting on ${dayLabel(s.held_on)}`} onClick={() => setDialog(s)} className="w-8 h-8 inline-grid place-items-center rounded-lg hover:bg-black/5 text-ink-2 cursor-pointer"><Pencil size={14} /></button>
                          <button type="button" aria-label={`Delete meeting on ${dayLabel(s.held_on)}`} disabled={del.busy} onClick={() => remove(s)} className="w-8 h-8 inline-grid place-items-center rounded-lg hover:bg-bad-soft text-bad cursor-pointer"><Trash2 size={14} /></button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-black/10 bg-black/[0.02]">
              {showAverage && <tr>
                <td className="px-5 py-2.5 font-semibold">Average</td>
                {members.map((m) => <td key={m.id} className="px-3 py-2.5 text-right font-semibold tabular-nums">{fmt(calcPhase(m.id, data, cfg, phase).advisorAvg)}</td>)}
                {editable && <td />}
              </tr>}
              <tr>
                <td className={cx('px-5 pb-3 text-ink-3', !showAverage && 'pt-3')}>Absences</td>
                {members.map((m) => <td key={m.id} className={cx('px-3 pb-3 text-right', !showAverage && 'pt-3')}><AbsenceBadge count={calcPhase(m.id, data, cfg, phase).absences} limit={cfg.absenceLimit} /></td>)}
                {editable && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {dialog && (
        <SessionDialog
          group={group} members={members} session={dialog === 'new' ? null : dialog} data={data} phase={phase}
          onClose={() => setDialog(null)}
          onSaved={async (msg) => {
            setDialog(null)
            await onChanged(msg)
          }}
        />
      )}
    </Panel>
  )
}

/** Supervisor's declaration for one phase (signed in the last meeting). */
export function DeclarationPanel({
  group, data, phase, canSign, onChanged, signerName,
}: {
  group: Group
  data: MarksData
  phase: Phase
  canSign: boolean
  onChanged: (message: string) => Promise<void>
  signerName?: (id: string | null) => string | null
}) {
  const d = data.declarations.find((x) => x.group_id === group.id && x.phase === phase)
  const { error, busy, attempt } = useAsync()
  const toggle = async (signed: boolean) => {
    if (!signed && !window.confirm(`Withdraw the ${phaseLabel[phase]} declaration?`)) return
    const ok = await attempt(async () => (await setDeclaration(group.id, phase, signed), true))
    if (ok) await onChanged(signed ? 'Declaration signed.' : 'Declaration withdrawn.')
  }
  return (
    <Panel title={<span className="flex items-center gap-2"><FileSignature size={16} className="text-ink-3" />{phaseLabel[phase]} declaration</span>} action={d ? <Badge tone="green">Signed</Badge> : <Badge tone="amber">Not signed</Badge>}>
      <p className="text-[13px] text-ink-2">
        {d
          ? `Signed${signerName?.(d.signed_by) ? ` by ${signerName(d.signed_by)}` : ''} on ${formatDate(d.signed_at)}.`
          : `The supervisor signs this in the last ${phaseLabel[phase]} meeting to confirm the group's work is ready for the internal evaluation.`}
      </p>
      <ErrorBox message={error} />
      {canSign && (
        <div className="mt-4">
          {d ? <Button variant="secondary" disabled={busy} onClick={() => toggle(false)}>Withdraw</Button> : <Button icon={FileSignature} disabled={busy} onClick={() => toggle(true)}>Sign declaration</Button>}
        </div>
      )}
    </Panel>
  )
}

// ------------------------------------------------------------------ evaluation marks

/** One evaluation for every student of a group. */
export function EvalMarksPanel({
  group, members, component, data, cfg, editable, onSaved, hint,
}: {
  group: Group
  members: Member[]
  component: EvalComponent
  data: MarksData
  cfg: MarksConfig
  editable: boolean
  onSaved: (message: string) => Promise<void>
  hint?: ReactNode
}) {
  const max = componentMax(cfg, component)
  const initial = useMemo(
    () =>
      Object.fromEntries(
        members.map((m) => {
          const e = data.marks.find((x) => x.member_id === m.id && x.component === component)
          return [m.id, { marks: e?.marks != null ? String(e.marks) : '', absent: !!e?.absent }]
        }),
      ),
    [members, data, component],
  )
  const [rows, setRows] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const { error, setError, busy, attempt } = useAsync()
  const setRow = (id: string, patch: Partial<{ marks: string; absent: boolean }>) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }))
    setDirty(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    for (const m of members) {
      const r = rows[m.id]
      if (!r.absent && r.marks.trim() !== '') {
        const v = Number(r.marks)
        if (!Number.isFinite(v) || v < 0 || v > max) return setError(`${m.full_name}: marks must be from 0 to ${max}.`)
      }
    }
    const payload = members.map((m) => ({ member_id: m.id, absent: rows[m.id].absent, marks: rows[m.id].absent || rows[m.id].marks.trim() === '' ? null : Number(rows[m.id].marks) }))
    const ok = await attempt(async () => (await saveEvaluationMarks(group.id, component, payload), true))
    if (ok) {
      setDirty(false)
      await onSaved(`${componentLabel[component]} marks saved.`)
    }
  }

  return (
    <Panel title={<>{componentLabel[component]} <span className="text-ink-3 font-normal">· out of {max}</span></>}>
      {(hint ?? EVAL_HINT[component]) && <div className="mb-4 text-[13px] text-ink-2">{hint ?? EVAL_HINT[component]}</div>}
      {members.length === 0 ? (
        <p className="text-[13px] text-ink-3">No students in this group.</p>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-4">
          <ul className="rounded-xl border border-line divide-y divide-black/5 bg-white/60">
            {members.map((m) => {
              const r = rows[m.id]
              return (
                <li key={m.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{m.full_name}</div>
                    <div className="text-xs text-ink-3 font-mono">{m.student_id}</div>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-ink-2 cursor-pointer">
                    <input type="checkbox" checked={r.absent} disabled={!editable} onChange={(e) => setRow(m.id, { absent: e.target.checked })} className="w-4 h-4 accent-[#d70015]" />
                    Absent
                  </label>
                  <input
                    type="number" inputMode="decimal" min={0} max={max} step={0.5}
                    aria-label={`${componentLabel[component]} marks of ${m.full_name}`}
                    disabled={!editable || r.absent}
                    value={r.absent ? '' : r.marks}
                    placeholder={r.absent ? 'Absent' : `/${max}`}
                    onChange={(e) => setRow(m.id, { marks: e.target.value })}
                    className={numberCls}
                  />
                </li>
              )
            })}
          </ul>
          <ErrorBox message={error} />
          {editable && (
            <div className="flex items-center justify-end gap-3">
              {dirty && <span className="text-[13px] text-warn">Unsaved changes</span>}
              <Button type="submit" icon={Save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save marks'}</Button>
            </div>
          )}
        </form>
      )}
    </Panel>
  )
}

// ------------------------------------------------------------------ results

/** Step-by-step calculation of one phase for one student. */
export function PhaseSteps({ r }: { r: PhaseResult }) {
  const steps: { label: string; how: ReactNode; value: ReactNode }[] = [
    {
      label: 'Advisor average',
      how: r.classMarks.length ? `(${r.classMarks.map((x) => fmt(x)).join(' + ')}) ÷ ${r.classMarks.length}` : 'No class marks yet',
      value: r.advisorAvg === null ? '—' : `${fmt(r.advisorAvg)} / 100`,
    },
    { label: 'Advisor marks', how: r.advisorAvg === null ? '—' : `${fmt(r.advisorAvg)} ÷ 100 × ${r.advisorMax}`, value: `${fmt(r.advisor)} / ${r.advisorMax}` },
    ...r.parts.map((p) => ({ label: p.label.replace(/^FYP-\d /, ''), how: p.absent ? 'Absent (counted as 0)' : p.component === 'external' ? 'Industry experts' : 'Jury marks', value: `${fmt(p.value)} / ${p.max}` })),
  ]
  const scaled = r.outOf !== r.total
  return (
    <table className="w-full text-[13px]">
      <tbody className="divide-y divide-black/5">
        {steps.map((s) => (
          <tr key={s.label}>
            <td className="py-2 pr-3 font-medium whitespace-nowrap">{s.label}</td>
            <td className="py-2 pr-3 text-ink-3">{s.how}</td>
            <td className="py-2 text-right tabular-nums whitespace-nowrap">{s.value}</td>
          </tr>
        ))}
        {scaled && (
          <tr>
            <td className="py-2 pr-3 font-medium whitespace-nowrap">Score</td>
            <td className="py-2 pr-3 text-ink-3">{r.score === null ? `Waiting for: ${r.missing.join(', ')}` : [fmt(r.advisor), ...r.parts.map((p) => fmt(p.value))].join(' + ')}</td>
            <td className="py-2 text-right tabular-nums whitespace-nowrap">{fmt(r.score)} / {r.outOf}</td>
          </tr>
        )}
        <tr className="border-t border-black/10">
          <td className="pt-3 pr-3 font-semibold whitespace-nowrap">{phaseLabel[r.phase]} marks</td>
          <td className="pt-3 pr-3 text-ink-3">
            {r.score === null ? (scaled ? '—' : `Waiting for: ${r.missing.join(', ')}`) : scaled ? `${fmt(r.score)} ÷ ${r.outOf} × ${r.total}` : [fmt(r.advisor), ...r.parts.map((p) => fmt(p.value))].join(' + ')}
          </td>
          <td className="pt-3 text-right text-base font-bold tabular-nums whitespace-nowrap">{fmt(r.final)} / {r.total}</td>
        </tr>
      </tbody>
    </table>
  )
}

export type SheetView = Phase | 'final'

const cellPart = (v: number | null, absent: boolean) => (absent ? <Badge tone="red">Absent</Badge> : fmt(v))

/** Result sheet: one row per student, grouped by group. */
export function ResultSheet({
  groups, membersOf, data, cfg, view, onOpenGroup,
}: {
  groups: Group[]
  membersOf: (groupId: string) => Member[]
  data: MarksData
  cfg: MarksConfig
  view: SheetView
  onOpenGroup?: (g: Group) => void
}) {
  const pc = view === 'final' ? null : cfg[view]
  const head: ReactNode[] = pc
    ? [
        <>Classes avg<br /><span className="text-[11px]">/100</span></>,
        <>Advisor<br /><span className="text-[11px]">/{pc.advisor}</span></>,
        ...pc.parts.map((p) => <>{componentLabel[p.component].replace(/^FYP-\d /, '').replace(' evaluation', '').replace(' defence', '')}<br /><span className="text-[11px]">/{p.weight}</span></>),
        ...(pc.total !== pc.advisor + pc.parts.reduce((s, x) => s + x.weight, 0) ? [<>Score<br /><span className="text-[11px]">/{pc.advisor + pc.parts.reduce((s, x) => s + x.weight, 0)}</span></>] : []),
        <>{phaseLabel[pc.phase]}<br /><span className="text-[11px]">/{pc.total}</span></>,
      ]
    : [
        <>FYP-1<br /><span className="text-[11px]">/{cfg.fyp1.total}</span></>,
        <>FYP-2<br /><span className="text-[11px]">/{cfg.fyp2.total}</span></>,
        <>Total<br /><span className="text-[11px]">/{cfg.fyp1.total + cfg.fyp2.total}</span></>,
        <>Result<br /><span className="text-[11px]">pass {cfg.passMark}</span></>,
      ]

  const rowCells = (memberId: string): ReactNode[] => {
    if (pc) {
      const r = calcPhase(memberId, data, cfg, pc.phase)
      return [
        <>{fmt(r.advisorAvg)}<div className="text-[11px] text-ink-3 whitespace-nowrap">{r.meetings} class{r.meetings === 1 ? '' : 'es'}</div></>,
        fmt(r.advisor),
        ...r.parts.map((p) => cellPart(p.value, p.absent)),
        ...(r.outOf !== r.total ? [fmt(r.score)] : []),
        <span className="font-semibold">{r.final === null ? <Badge tone="grey">Incomplete</Badge> : fmt(r.final)}</span>,
      ]
    }
    const f = calcFinal(memberId, data, cfg)
    return [
      fmt(f.fyp1.final),
      fmt(f.fyp2.final),
      <span className="font-semibold">{fmt(f.total)}</span>,
      f.passed === null ? <Badge tone="grey">Incomplete</Badge> : f.passed ? <Badge tone="green">Pass</Badge> : <Badge tone="red">Fail</Badge>,
    ]
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-ink-3 border-b border-black/5">
            <th className="font-medium px-5 py-2.5">Group</th>
            <th className="font-medium px-3 py-2.5">Student</th>
            {head.map((h, i) => <th key={i} className={cx('font-medium py-2.5 text-right whitespace-nowrap', i === head.length - 1 ? 'px-5' : 'px-3')}>{h}</th>)}
          </tr>
        </thead>
        {groups.map((g) => {
          const ms = membersOf(g.id)
          return (
            <tbody key={g.id} className="border-b border-black/5">
              {ms.length === 0 && (
                <tr><td className="px-5 py-2.5 font-mono text-xs font-semibold">{g.code}</td><td colSpan={head.length + 1} className="px-3 py-2.5 text-ink-3">No students</td></tr>
              )}
              {ms.map((m, i) => (
                <tr key={m.id} className="hover:bg-black/[0.02]">
                  {i === 0 && (
                    <td rowSpan={ms.length} className="px-5 py-2.5 align-top">
                      {onOpenGroup ? (
                        <button type="button" onClick={() => onOpenGroup(g)} className="text-left cursor-pointer group">
                          <div className="font-mono text-xs font-semibold text-accent group-hover:underline whitespace-nowrap">{g.code}</div>
                          <div className="text-xs text-ink-3 max-w-[160px] truncate">{g.name}</div>
                        </button>
                      ) : (
                        <><div className="font-mono text-xs font-semibold whitespace-nowrap">{g.code}</div><div className="text-xs text-ink-3 max-w-[160px] truncate">{g.name}</div></>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <div className="font-medium whitespace-nowrap">{m.full_name}</div>
                    <div className="text-xs text-ink-3 font-mono whitespace-nowrap">{m.student_id}</div>
                  </td>
                  {rowCells(m.id).map((c, j, all) => <td key={j} className={cx('py-2.5 text-right tabular-nums', j === all.length - 1 ? 'px-5' : 'px-3')}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

/** CSV of the result sheet (opens in Excel). */
export function resultSheetCsv(groups: Group[], membersOf: (groupId: string) => Member[], data: MarksData, cfg: MarksConfig, view: SheetView) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const v = (x: number | null, absent = false) => (absent ? 'Absent' : x === null ? '' : fmt(x))
  const lines: string[] = []
  if (view === 'final') {
    lines.push(['Group', 'Group name', 'Student ID', 'Name', `FYP-1 /${cfg.fyp1.total}`, `FYP-2 /${cfg.fyp2.total}`, `Total /${cfg.fyp1.total + cfg.fyp2.total}`, 'Result'].map(esc).join(','))
    for (const g of groups)
      for (const m of membersOf(g.id)) {
        const f = calcFinal(m.id, data, cfg)
        lines.push([g.code, g.name, m.student_id, m.full_name, v(f.fyp1.final), v(f.fyp2.final), v(f.total), f.passed === null ? 'Incomplete' : f.passed ? 'Pass' : 'Fail'].map(esc).join(','))
      }
  } else {
    const pc = cfg[view]
    lines.push(['Group', 'Group name', 'Student ID', 'Name', 'Classes', 'Absences', 'Classes avg /100', `Advisor /${pc.advisor}`, ...pc.parts.map((p) => `${componentLabel[p.component]} /${p.weight}`), `Score /${pc.advisor + pc.parts.reduce((s, x) => s + x.weight, 0)}`, `${phaseLabel[view]} /${pc.total}`].map(esc).join(','))
    for (const g of groups)
      for (const m of membersOf(g.id)) {
        const r = calcPhase(m.id, data, cfg, view)
        lines.push([g.code, g.name, m.student_id, m.full_name, r.meetings, r.absences, v(r.advisorAvg), v(r.advisor), ...r.parts.map((p) => v(p.value, p.absent)), v(r.score), v(r.final)].map(esc).join(','))
      }
  }
  return '﻿' + lines.join('\r\n')
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
