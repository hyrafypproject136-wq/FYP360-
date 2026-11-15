import { useState } from 'react'
import { Crown, Hourglass } from 'lucide-react'
import { useStudentData } from '../../student/StudentData'
import { calcFinal, calcPhase, fmt, marksConfig, phaseLabel, phaseOutOf, type Phase } from '../../lib/marksApi'
import { Badge, EmptyState, Panel } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { AbsenceBadge, PhaseSteps, PhaseTabs } from '../../marks/shared'

type View = Phase | 'final'

export default function StudentResultsPage() {
  const { data } = useStudentData()
  const cfg = marksConfig(data.settings)
  const pub = data.record.published
  const [view, setView] = useState<View>(pub.fyp2 ? 'final' : cfg.currentPhase)

  const subtitle =
    view === 'final'
      ? `Final = FYP-1 (${cfg.fyp1.total}) + FYP-2 (${cfg.fyp2.total}). You pass with ${cfg.passMark} or more, and FYP-2 must also be at least ${cfg.passMark}% — failing FYP-2 fails the FYP.`
      : view === 'fyp1'
        ? `FYP-1 is ${cfg.fyp1.total} of your 100 marks: advisor ${cfg.fyp1.advisor} + proposal defence ${cfg.fyp1.parts[0].weight} + internal ${cfg.fyp1.parts[1].weight} = ${phaseOutOf(cfg.fyp1)}, then scaled to ${cfg.fyp1.total}.`
        : `FYP-2 is ${cfg.fyp2.total} of your 100 marks: advisor ${cfg.fyp2.advisor} + internal ${cfg.fyp2.parts[0].weight} + external ${cfg.fyp2.parts[1].weight}.`

  const published = view === 'final' ? pub.fyp1 && pub.fyp2 : pub[view]

  return (
    <>
      <PageHeader
        title="Results"
        subtitle={subtitle}
        actions={<PhaseTabs<View> value={view} onChange={setView} tabs={[{ id: 'fyp1', label: 'FYP-1' }, { id: 'fyp2', label: 'FYP-2' }, { id: 'final', label: 'Final' }]} />}
      />
      {!published ? (
        <Panel>
          <EmptyState icon={Hourglass} title={`${view === 'final' ? 'Final' : phaseLabel[view]} results are not published yet`}>
            You will get a notice when the FYP coordinator publishes them.
          </EmptyState>
        </Panel>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {data.members.map((m) => {
            const title = <span className="flex items-center gap-1.5">{m.full_name}{m.is_lead && <Crown size={13} className="text-good" aria-label="Lead" />} <span className="font-mono text-xs text-ink-3 font-normal">{m.student_id}</span></span>
            if (view === 'final') {
              const f = calcFinal(m.id, data.record, cfg)
              return (
                <Panel key={m.id} title={title} action={f.passed === null ? <Badge tone="grey">Incomplete</Badge> : f.passed ? <Badge tone="green">Pass</Badge> : <Badge tone="red">Fail</Badge>}>
                  <table className="w-full text-[13px]">
                    <tbody className="divide-y divide-black/5">
                      <tr><td className="py-2 font-medium">FYP-1</td><td className="py-2 text-right tabular-nums">{fmt(f.fyp1.final)} / {cfg.fyp1.total}</td></tr>
                      <tr><td className="py-2 font-medium">FYP-2</td><td className="py-2 text-right tabular-nums">{fmt(f.fyp2.final)} / {cfg.fyp2.total}</td></tr>
                      <tr className="border-t border-black/10"><td className="pt-3 font-semibold">Total</td><td className="pt-3 text-right text-base font-bold tabular-nums">{fmt(f.total)} / {f.outOf}</td></tr>
                    </tbody>
                  </table>
                </Panel>
              )
            }
            const r = calcPhase(m.id, data.record, cfg, view)
            return (
              <Panel key={m.id} title={title} action={<AbsenceBadge count={r.absences} limit={cfg.absenceLimit} />}>
                <PhaseSteps r={r} />
              </Panel>
            )
          })}
        </div>
      )}
    </>
  )
}
