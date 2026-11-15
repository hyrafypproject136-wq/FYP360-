import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { useStudentData } from '../../student/StudentData'
import { absencesIn, marksConfig, phaseLabel, type Phase } from '../../lib/marksApi'
import { PageHeader } from '../../layouts/WindowFrame'
import { DeclarationPanel, MeetingsPanel, PhaseTabs } from '../../marks/shared'

export default function StudentMeetingsPage() {
  const { data, reload } = useStudentData()
  const cfg = marksConfig(data.settings)
  const [phase, setPhase] = useState<Phase>(cfg.currentPhase)
  const warn = data.members.map((m) => ({ m, n: absencesIn(data.record, m.id, phase) })).filter((x) => x.n >= cfg.absenceLimit)

  return (
    <>
      <PageHeader
        title="Meetings"
        subtitle={`Meetings are held every two weeks. Each member may miss ${cfg.absenceLimit} meetings a semester; at least one member must come to every meeting. Report an emergency absence to your supervisor by e-mail, copying the FYP Committee Head and the FYP coordinator.`}
        actions={<PhaseTabs value={phase} onChange={setPhase} tabs={(['fyp1', 'fyp2'] as const).map((p) => ({ id: p, label: phaseLabel[p] }))} />}
      />
      {warn.length > 0 && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl bg-bad-soft text-bad px-4 py-3 text-[13px]">
          <TriangleAlert size={16} className="shrink-0 mt-0.5" />
          <span>
            {warn.map(({ m, n }) => `${m.full_name} has missed ${n}`).join('; ')}.{' '}
            {warn.some((x) => x.n > cfg.absenceLimit) ? 'This is over the limit. The FYP coordinator will decide what happens next.' : 'One more absence means removal from the FYP.'}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-5">
        <MeetingsPanel group={data.group} members={data.members} data={data.record} cfg={cfg} phase={phase} editable={false} showAverage={data.record.published[phase]} onChanged={async () => reload()} />
        <DeclarationPanel group={data.group} data={data.record} phase={phase} canSign={false} onChanged={async () => reload()} />
      </div>
      {!data.record.published[phase] && <p className="mt-3 text-xs text-ink-3">Class marks stay hidden until the FYP coordinator publishes {phaseLabel[phase]} results.</p>}
    </>
  )
}
