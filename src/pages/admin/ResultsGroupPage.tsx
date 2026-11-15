import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Crown, UsersRound } from 'lucide-react'
import { membersOf, profileName, useAdminData } from '../../admin/AdminData'
import { calcPhase, marksConfig, phaseLabel, type Phase } from '../../lib/marksApi'
import { EmptyState, Panel } from '../../components/ui'
import { AbsenceBadge, DeclarationPanel, EvalMarksPanel, LockedNote, MeetingsPanel, PhaseSteps, PhaseTabs } from '../../marks/shared'

/** One group's marks. The coordinator can correct any of them, and enters external marks. */
export default function ResultsGroupPage() {
  const { groupId } = useParams()
  const { data, reload, toast } = useAdminData()
  const cfg = marksConfig(data.settings)
  const [phase, setPhase] = useState<Phase>(cfg.currentPhase)
  const group = data.groups.find((g) => g.id === groupId)
  if (!group) return <EmptyState icon={UsersRound} title="Group not found"><Link to="/admin/results" className="text-accent">Back to results</Link></EmptyState>

  const members = membersOf(data, group.id)
  const locked = cfg.published[phase]
  const jury = data.jury.filter((j) => j.group_id === group.id).map((j) => profileName(data, j.jury_id)).filter(Boolean)
  const done = async (msg: string) => {
    await reload()
    toast(msg)
  }

  return (
    <>
      <Link to="/admin/results" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink mb-4"><ArrowLeft size={15} /> Results</Link>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="font-mono text-xs text-ink-3 mb-1">{group.code}</div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">{group.name}</h1>
          <p className="text-[13px] text-ink-2 mt-1">Supervisor: {profileName(data, group.supervisor_id) ?? '—'} · Jury: {jury.length ? jury.join(', ') : '—'}</p>
        </div>
        <PhaseTabs value={phase} onChange={setPhase} tabs={(['fyp1', 'fyp2'] as const).map((p) => ({ id: p, label: phaseLabel[p] }))} />
      </div>
      {locked && <LockedNote phase={phase} />}

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        {members.map((m) => {
          const r = calcPhase(m.id, data.marks, cfg, phase)
          return (
            <Panel key={m.id} title={<span className="flex items-center gap-1.5">{m.full_name}{m.is_lead && <Crown size={13} className="text-good" aria-label="Lead" />} <span className="font-mono text-xs text-ink-3 font-normal">{m.student_id}</span></span>} action={<AbsenceBadge count={r.absences} limit={cfg.absenceLimit} />}>
              <PhaseSteps r={r} />
            </Panel>
          )
        })}
        {members.length === 0 && <Panel className="md:col-span-2"><EmptyState icon={UsersRound} title="No students in this group" /></Panel>}
      </div>

      <div className="flex flex-col gap-5">
        <MeetingsPanel group={group} members={members} data={data.marks} cfg={cfg} phase={phase} editable={!locked} onChanged={done} />
        <DeclarationPanel group={group} data={data.marks} phase={phase} canSign={!locked} onChanged={done} signerName={(id) => profileName(data, id)} />
        <div className="grid xl:grid-cols-2 gap-5 items-start">
          {cfg[phase].parts.map((p) => (
            <EvalMarksPanel key={`${p.component}-${group.id}`} group={group} members={members} component={p.component} data={data.marks} cfg={cfg} editable={!locked} onSaved={done} />
          ))}
        </div>
      </div>
    </>
  )
}
