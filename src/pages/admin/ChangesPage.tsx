import { useState } from 'react'
import { GitPullRequestArrow } from 'lucide-react'
import { useAdminData } from '../../admin/AdminData'
import type { ChangeStatus } from '../../lib/workflowApi'
import { EmptyState, Panel } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { PhaseTabs } from '../../marks/shared'
import { ChangeRequestCard } from '../../workflow/shared'

type Tab = ChangeStatus | 'all'

export default function ChangesPage() {
  const { data, reload, toast } = useAdminData()
  const [tab, setTab] = useState<Tab>('pending_coordinator')
  const all = data.work.changes
  const list = tab === 'all' ? all : all.filter((c) => c.status === tab)
  const names = Object.fromEntries(data.profiles.map((p) => [p.id, p.display_name]))
  const group = (id: string) => data.groups.find((g) => g.id === id)
  const count = (t: Tab) => (t === 'all' ? all.length : all.filter((c) => c.status === t).length)

  return (
    <>
      <PageHeader title="Change requests" subtitle="Groups ask for a change, the jury approves it in writing, then you decide. Every decision needs a written comment." />
      <div className="mb-4">
        <PhaseTabs<Tab> value={tab} onChange={setTab} tabs={[
          { id: 'pending_coordinator', label: `Waiting for you ${count('pending_coordinator')}` },
          { id: 'pending_jury', label: `With jury ${count('pending_jury')}` },
          { id: 'approved', label: 'Approved' },
          { id: 'rejected', label: 'Rejected' },
          { id: 'all', label: 'All' },
        ]} />
      </div>
      {list.length === 0 ? (
        <Panel><EmptyState icon={GitPullRequestArrow} title="Nothing here" /></Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((c) => (
            <ChangeRequestCard key={c.id} c={c} names={names} groupLabel={<>{group(c.group_id)?.name} · <span className="font-mono">{group(c.group_id)?.code}</span></>}
              canDecide={c.status === 'pending_coordinator'} onDone={async (m) => { await reload(); toast(m) }} />
          ))}
        </div>
      )}
    </>
  )
}
