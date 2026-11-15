import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, UsersRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useStaffData } from '../../staff/StaffData'
import { isSigned, juryComponents, marksConfig, phaseLabel, type Phase } from '../../lib/marksApi'
import { Badge, EmptyState, Panel } from '../../components/ui'
import { DeclarationPanel, EvalMarksPanel, LockedNote, MeetingsPanel, PhaseTabs } from '../../marks/shared'
import { ReviewCard } from '../../workflow/shared'

/** Supervisor: one group's meeting register and declaration. Jury: one group's evaluation marks. */
export default function StaffMarksPage({ mode }: { mode: 'meetings' | 'jury' }) {
  const { groupId } = useParams()
  const { user } = useAuth()
  const { data, reload, toast } = useStaffData()
  const cfg = marksConfig(data.settings)
  const [phase, setPhase] = useState<Phase>(cfg.currentPhase)
  const me = user?.profileId
  const base = mode === 'meetings' ? '/staff/meetings' : '/staff/marks'
  const group = data.groups.find(
    (g) => g.id === groupId && (mode === 'meetings' ? g.supervisor_id === me : data.jury.some((j) => j.group_id === g.id && j.jury_id === me)),
  )
  if (!group) {
    return <EmptyState icon={UsersRound} title="Group not found"><Link to={base} className="text-accent">Back</Link></EmptyState>
  }

  const members = data.members.filter((m) => m.group_id === group.id)
  const locked = cfg.published[phase]
  const official = data.proposals.find((p) => p.id === group.approved_proposal_id)
  const names = Object.fromEntries(data.staff.map((p) => [p.id, p.display_name]))
  const done = async (msg: string) => {
    await reload()
    toast(msg)
  }

  return (
    <>
      <Link to={base} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink mb-4">
        <ArrowLeft size={15} /> {mode === 'meetings' ? 'Class meetings' : 'Evaluation marks'}
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="font-mono text-xs text-ink-3 mb-1">{group.code}</div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">{group.name}</h1>
          {official && <p className="text-[13px] text-ink-2 mt-1">Project: {official.title}</p>}
        </div>
        <PhaseTabs value={phase} onChange={setPhase} tabs={(['fyp1', 'fyp2'] as const).map((p) => ({ id: p, label: phaseLabel[p] + (p === cfg.currentPhase ? ' · now' : '') }))} />
      </div>
      {locked && <LockedNote phase={phase} />}

      {mode === 'meetings' ? (
        <div className="flex flex-col gap-5">
          <MeetingsPanel group={group} members={members} data={data.marks} cfg={cfg} phase={phase} editable={!locked} onChanged={done} />
          <DeclarationPanel group={group} data={data.marks} phase={phase} canSign={!locked} onChanged={done} signerName={(id) => (id ? names[id] ?? null : null)} />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <Panel>
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-ink-2">Supervisor's {phaseLabel[phase]} declaration</span>
              {isSigned(data.marks, group.id, phase) ? <Badge tone="green">Signed</Badge> : <Badge tone="amber">Not signed yet</Badge>}
            </div>
          </Panel>
          <div className="grid xl:grid-cols-2 gap-5 items-start">
            {juryComponents[phase].map((c) => (
              <EvalMarksPanel key={`${c}-${group.id}`} group={group} members={members} component={c} data={data.marks} cfg={cfg} editable={!locked} onSaved={done} />
            ))}
          </div>
          {phase === 'fyp2' && <p className="text-xs text-ink-3">External evaluation marks are entered by the FYP coordinator.</p>}
          {data.work.deliverables.some((d) => d.phase === phase) && (
            <>
              <h2 className="text-[15px] font-semibold mt-2">Group's {phaseLabel[phase]} submissions</h2>
              {data.work.deliverables.filter((d) => d.phase === phase).map((d) => (
                <ReviewCard key={d.id} w={data.work} d={d} groupId={group.id} canReview={false} names={names} onDone={done} />
              ))}
            </>
          )}
        </div>
      )}
    </>
  )
}
