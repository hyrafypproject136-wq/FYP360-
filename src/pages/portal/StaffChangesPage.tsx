import { useState } from 'react'
import { GitPullRequestArrow } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useStaffData } from '../../staff/StaffData'
import { EmptyState, Panel } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { PhaseTabs } from '../../marks/shared'
import { ChangeRequestCard } from '../../workflow/shared'

/** Jury: change requests of the groups they judge. */
export default function StaffChangesPage() {
  const { user } = useAuth()
  const { data, reload, toast } = useStaffData()
  const [tab, setTab] = useState<'waiting' | 'all'>('waiting')
  const mine = new Set(data.jury.filter((j) => j.jury_id === user?.profileId).map((j) => j.group_id))
  const all = data.work.changes.filter((c) => mine.has(c.group_id))
  const list = tab === 'waiting' ? all.filter((c) => c.status === 'pending_jury') : all
  const names = Object.fromEntries(data.staff.map((p) => [p.id, p.display_name]))
  const group = (id: string) => data.groups.find((g) => g.id === id)

  return (
    <>
      <PageHeader
        title="Change requests"
        subtitle="Groups ask to change their project here. Approve or reject in writing; approved requests then go to the FYP coordinator."
        actions={<PhaseTabs value={tab} onChange={setTab} tabs={[{ id: 'waiting', label: `Waiting for you ${all.filter((c) => c.status === 'pending_jury').length}` }, { id: 'all', label: 'All' }]} />}
      />
      {list.length === 0 ? (
        <Panel><EmptyState icon={GitPullRequestArrow} title={tab === 'waiting' ? 'Nothing waiting for you' : 'No change requests'} /></Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((c) => (
            <ChangeRequestCard key={c.id} c={c} names={names} groupLabel={<>{group(c.group_id)?.name} · <span className="font-mono">{group(c.group_id)?.code}</span></>}
              canDecide={c.status === 'pending_jury'} onDone={async (m) => { await reload(); toast(m) }} />
          ))}
        </div>
      )}
    </>
  )
}
