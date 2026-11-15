import { useState } from 'react'
import { Inbox } from 'lucide-react'
import { useStudentData } from '../../student/StudentData'
import { marksConfig, phaseLabel, type Phase } from '../../lib/marksApi'
import { EmptyState, Panel } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { PhaseTabs } from '../../marks/shared'
import { DeliverableCard } from '../../workflow/shared'

export default function StudentSubmissionsPage() {
  const { data, reload, toast } = useStudentData()
  const cfg = marksConfig(data.settings)
  const [phase, setPhase] = useState<Phase>(cfg.currentPhase)
  const list = data.work.deliverables.filter((d) => d.phase === phase)
  const active = data.group.status === 'active'

  return (
    <>
      <PageHeader
        title="Submissions"
        subtitle="Upload each piece of work before its deadline. Late uploads are blocked. Your supervisor reviews every upload and can ask for changes."
        actions={<PhaseTabs value={phase} onChange={setPhase} tabs={(['fyp1', 'fyp2'] as const).map((p) => ({ id: p, label: phaseLabel[p] }))} />}
      />
      {list.length === 0 ? (
        <Panel><EmptyState icon={Inbox} title={`No ${phaseLabel[phase]} deliverables yet`}>The FYP coordinator adds deliverables and deadlines here.</EmptyState></Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((d) => (
            <DeliverableCard key={d.id} w={data.work} d={d} groupId={data.group.id} active={active} onUploaded={async (m) => { await reload(); toast(m) }} />
          ))}
        </div>
      )}
    </>
  )
}
