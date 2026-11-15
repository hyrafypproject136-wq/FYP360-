import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Inbox, UsersRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useStaffData } from '../../staff/StaffData'
import { marksConfig, phaseLabel, type Phase } from '../../lib/marksApi'
import { EmptyState, Panel } from '../../components/ui'
import { PhaseTabs } from '../../marks/shared'
import { ReviewCard } from '../../workflow/shared'

/** Supervisor: one group's uploads, to approve or send back. */
export default function StaffSubmissionsPage() {
  const { groupId } = useParams()
  const { user } = useAuth()
  const { data, reload, toast } = useStaffData()
  const cfg = marksConfig(data.settings)
  const [phase, setPhase] = useState<Phase>(cfg.currentPhase)
  const group = data.groups.find((g) => g.id === groupId && g.supervisor_id === user?.profileId)
  if (!group) return <EmptyState icon={UsersRound} title="Group not found"><Link to="/staff/submissions" className="text-accent">Back</Link></EmptyState>

  const names = Object.fromEntries(data.staff.map((p) => [p.id, p.display_name]))
  const list = data.work.deliverables.filter((d) => d.phase === phase)

  return (
    <>
      <Link to="/staff/submissions" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink mb-4"><ArrowLeft size={15} /> Submission reviews</Link>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="font-mono text-xs text-ink-3 mb-1">{group.code}</div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">{group.name}</h1>
        </div>
        <PhaseTabs value={phase} onChange={setPhase} tabs={(['fyp1', 'fyp2'] as const).map((p) => ({ id: p, label: phaseLabel[p] }))} />
      </div>
      {list.length === 0 ? (
        <Panel><EmptyState icon={Inbox} title={`No ${phaseLabel[phase]} deliverables yet`}>The FYP coordinator adds them.</EmptyState></Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((d) => (
            <ReviewCard key={d.id} w={data.work} d={d} groupId={group.id} canReview={group.status === 'active'} names={names} onDone={async (m) => { await reload(); toast(m) }} />
          ))}
        </div>
      )}
    </>
  )
}
