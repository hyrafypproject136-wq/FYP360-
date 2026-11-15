import { supabase } from './supabase'
import type { Settings } from './adminApi'

// ---------- types

export type Phase = 'fyp1' | 'fyp2'
export type AttendanceStatus = 'present' | 'absent'
export type EvalComponent = 'proposal' | 'fyp1_internal' | 'fyp2_internal' | 'external'

export interface ClassSession {
  id: string
  group_id: string
  phase: Phase
  held_on: string // YYYY-MM-DD
  topic: string
  created_at: string
  updated_at: string
}

export interface Attendance {
  session_id: string
  member_id: string
  status: AttendanceStatus
  mark: number | null
}

export interface EvalMark {
  member_id: string
  component: EvalComponent
  marks: number | null
  absent: boolean
  updated_at: string
}

export interface Declaration {
  group_id: string
  phase: Phase
  signed_by: string | null
  signed_at: string
}

export interface MarksData {
  sessions: ClassSession[]
  attendance: Attendance[]
  marks: EvalMark[]
  declarations: Declaration[]
}

export interface MyRecord extends MarksData {
  published: Record<Phase, boolean>
}

const check = <T,>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
const normal = <T extends MarksData>(d: T): T => ({
  ...d,
  attendance: d.attendance.map((a) => ({ ...a, mark: num(a.mark) })),
  marks: d.marks.map((m) => ({ ...m, marks: num(m.marks) })),
})

// ---------- reads

/** Meetings, attendance, evaluation marks and declarations the signed-in staff member may see. */
export async function loadMarksData(): Promise<MarksData> {
  const [sessions, attendance, marks, declarations] = await Promise.all([
    supabase.from('class_sessions').select('*').order('held_on'),
    supabase.from('session_attendance').select('*'),
    supabase.from('evaluation_marks').select('member_id, component, marks, absent, updated_at'),
    supabase.from('group_declarations').select('*'),
  ])
  return normal({ sessions: check(sessions), attendance: check(attendance), marks: check(marks), declarations: check(declarations) })
}

/** The signed-in group's attendance, and its marks once each phase is published. */
export async function loadMyRecord(groupId: string): Promise<MyRecord> {
  const [rec, declarations] = await Promise.all([
    supabase.rpc('my_marks_record'),
    supabase.from('group_declarations').select('*').eq('group_id', groupId),
  ])
  const r = check<Omit<MyRecord, 'declarations'>>(rec)
  return normal({ ...r, declarations: check<Declaration[]>(declarations) })
}

// ---------- writes

export interface AttendanceRow {
  member_id: string
  status: AttendanceStatus
  mark: number | null
}

export async function saveClassSession(groupId: string, sessionId: string | null, heldOn: string, topic: string, rows: AttendanceRow[]) {
  return check<string>(
    await supabase.rpc('save_class_session', { p_group_id: groupId, p_session_id: sessionId, p_held_on: heldOn, p_topic: topic, p_rows: rows }),
  )
}

export async function deleteClassSession(sessionId: string) {
  check(await supabase.rpc('delete_class_session', { p_session_id: sessionId }))
}

export interface EvalRow {
  member_id: string
  marks: number | null
  absent: boolean
}

export async function saveEvaluationMarks(groupId: string, component: EvalComponent, rows: EvalRow[]) {
  check(await supabase.rpc('save_evaluation_marks', { p_group_id: groupId, p_component: component, p_rows: rows }))
}

export async function publishResults(phase: Phase, publish: boolean) {
  check(await supabase.rpc('publish_results', { p_phase: phase, p_publish: publish }))
}

export async function setDeclaration(groupId: string, phase: Phase, signed: boolean) {
  check(await supabase.rpc('set_declaration', { p_group_id: groupId, p_phase: phase, p_signed: signed }))
}

// ---------- the marking rules

export const phaseLabel: Record<Phase, string> = { fyp1: 'FYP-1', fyp2: 'FYP-2' }
export const componentLabel: Record<EvalComponent, string> = {
  proposal: 'Proposal defence',
  fyp1_internal: 'FYP-1 internal evaluation',
  fyp2_internal: 'FYP-2 internal evaluation',
  external: 'External evaluation',
}
export const componentPhase = (c: EvalComponent): Phase => (c === 'proposal' || c === 'fyp1_internal' ? 'fyp1' : 'fyp2')
/** Components the jury enters, per phase. External is entered by the coordinator. */
export const juryComponents: Record<Phase, EvalComponent[]> = { fyp1: ['proposal', 'fyp1_internal'], fyp2: ['fyp2_internal'] }

export interface PhaseConfig {
  phase: Phase
  advisor: number
  parts: { component: EvalComponent; weight: number }[]
  total: number
}

export interface MarksConfig {
  fyp1: PhaseConfig
  fyp2: PhaseConfig
  absentZero: boolean
  absenceLimit: number
  passMark: number
  currentPhase: Phase
  published: Record<Phase, boolean>
}

const n = (v: string | undefined, d: number) => {
  const x = Number(v)
  return v !== undefined && v !== '' && Number.isFinite(x) ? x : d
}

export function marksConfig(s: Settings): MarksConfig {
  return {
    fyp1: {
      phase: 'fyp1',
      advisor: n(s.fyp1_weight_advisor, 30),
      parts: [
        { component: 'proposal', weight: n(s.fyp1_weight_proposal, 10) },
        { component: 'fyp1_internal', weight: n(s.fyp1_weight_internal, 60) },
      ],
      total: n(s.fyp1_total, 40),
    },
    fyp2: {
      phase: 'fyp2',
      advisor: n(s.fyp2_weight_advisor, 10),
      parts: [
        { component: 'fyp2_internal', weight: n(s.fyp2_weight_internal, 30) },
        { component: 'external', weight: n(s.fyp2_weight_external, 20) },
      ],
      total: n(s.fyp2_total, 60),
    },
    absentZero: (s.fyp1_absent_counts_zero ?? 'true') === 'true',
    absenceLimit: n(s.fyp1_absence_limit, 2),
    passMark: n(s.pass_mark, 60),
    currentPhase: s.current_phase === 'fyp2' ? 'fyp2' : 'fyp1',
    published: { fyp1: s.fyp1_published === 'true', fyp2: s.fyp2_published === 'true' },
  }
}

export const componentMax = (cfg: MarksConfig, c: EvalComponent) => cfg[componentPhase(c)].parts.find((p) => p.component === c)?.weight ?? 0
export const phaseOutOf = (p: PhaseConfig) => p.advisor + p.parts.reduce((s, x) => s + x.weight, 0)

export interface PartResult {
  component: EvalComponent
  label: string
  max: number
  value: number | null
  absent: boolean
}

export interface PhaseResult {
  phase: Phase
  classMarks: number[]
  meetings: number
  absences: number
  advisorAvg: number | null // out of 100
  advisor: number | null // out of config.advisor
  advisorMax: number
  parts: PartResult[]
  score: number | null // out of outOf
  outOf: number
  final: number | null // out of total
  total: number
  missing: string[]
}

/** One student's marks for one phase, step by step. A part marked "absent" counts as 0. */
export function calcPhase(memberId: string, d: MarksData, cfg: MarksConfig, phase: Phase): PhaseResult {
  const pc = cfg[phase]
  const ids = new Set(d.sessions.filter((s) => s.phase === phase).map((s) => s.id))
  const rows = d.attendance.filter((a) => a.member_id === memberId && ids.has(a.session_id))
  const classMarks: number[] = []
  for (const a of rows) {
    if (a.status === 'present' && a.mark !== null) classMarks.push(a.mark)
    else if (a.status === 'absent' && cfg.absentZero) classMarks.push(0)
  }
  const advisorAvg = classMarks.length ? classMarks.reduce((s, x) => s + x, 0) / classMarks.length : null
  const advisor = advisorAvg === null ? null : (advisorAvg / 100) * pc.advisor

  const parts: PartResult[] = pc.parts.map(({ component, weight }) => {
    const e = d.marks.find((m) => m.member_id === memberId && m.component === component)
    return { component, label: componentLabel[component], max: weight, value: e ? (e.absent ? 0 : e.marks) : null, absent: !!e?.absent }
  })

  const missing: string[] = []
  if (advisor === null) missing.push('Advisor marks')
  for (const p of parts) if (p.value === null) missing.push(p.label)

  const outOf = phaseOutOf(pc)
  const score = missing.length === 0 ? advisor! + parts.reduce((s, p) => s + p.value!, 0) : null
  const final = score === null || outOf <= 0 ? null : (score / outOf) * pc.total

  return {
    phase,
    classMarks,
    meetings: rows.length,
    absences: rows.filter((a) => a.status === 'absent').length,
    advisorAvg,
    advisor,
    advisorMax: pc.advisor,
    parts,
    score,
    outOf,
    final,
    total: pc.total,
    missing,
  }
}

export const calcFyp1 = (memberId: string, d: MarksData, cfg: MarksConfig) => calcPhase(memberId, d, cfg, 'fyp1')

export interface FinalResult {
  fyp1: PhaseResult
  fyp2: PhaseResult
  total: number | null
  outOf: number
  passed: boolean | null
}

/** Final = FYP-1 + FYP-2. Pass needs the pass mark overall and the same share of FYP-2 (FYP-2 fail = fail). */
export function calcFinal(memberId: string, d: MarksData, cfg: MarksConfig): FinalResult {
  const fyp1 = calcPhase(memberId, d, cfg, 'fyp1')
  const fyp2 = calcPhase(memberId, d, cfg, 'fyp2')
  const outOf = cfg.fyp1.total + cfg.fyp2.total
  const total = fyp1.final !== null && fyp2.final !== null ? fyp1.final + fyp2.final : null
  const passed = total === null ? null : total >= (cfg.passMark / 100) * outOf && fyp2.final! >= (cfg.passMark / 100) * cfg.fyp2.total
  return { fyp1, fyp2, total, outOf, passed }
}

/** Number with at most 2 decimals, or a dash. */
export const fmt = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? '—' : String(Math.round(v * 10 ** digits) / 10 ** digits))

/** Absences of a member in one phase. */
export const absencesIn = (d: MarksData, memberId: string, phase: Phase) => {
  const ids = new Set(d.sessions.filter((s) => s.phase === phase).map((s) => s.id))
  return d.attendance.filter((a) => a.member_id === memberId && a.status === 'absent' && ids.has(a.session_id)).length
}

export const isSigned = (d: MarksData, groupId: string, phase: Phase) => d.declarations.some((x) => x.group_id === groupId && x.phase === phase)
