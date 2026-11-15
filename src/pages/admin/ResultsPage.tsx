import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, Download, EyeOff, Send } from 'lucide-react'
import { membersOf, useAdminData } from '../../admin/AdminData'
import { calcFinal, calcPhase, fmt, marksConfig, phaseLabel, phaseOutOf, publishResults, type Phase } from '../../lib/marksApi'
import { componentLabel } from '../../lib/marksApi'
import { Badge, Button, EmptyState, Modal, ModalActions, Panel, cx } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { PhaseTabs, ResultSheet, downloadText, resultSheetCsv, type SheetView } from '../../marks/shared'

export default function ResultsPage() {
  const { data, run } = useAdminData()
  const navigate = useNavigate()
  const cfg = marksConfig(data.settings)
  const [view, setView] = useState<SheetView>(cfg.currentPhase)
  const [onlyIncomplete, setOnlyIncomplete] = useState(false)
  const [confirm, setConfirm] = useState<null | { phase: Phase; publish: boolean }>(null)

  const active = [...data.groups.filter((g) => g.status === 'active')].sort((a, b) => a.code.localeCompare(b.code))
  const members = (gid: string) => membersOf(data, gid)
  const students = active.flatMap((g) => members(g.id))
  const finalOf = (id: string) => (view === 'final' ? calcFinal(id, data.marks, cfg).total : calcPhase(id, data.marks, cfg, view).final)
  const complete = students.filter((m) => finalOf(m.id) !== null).length
  const incompleteGroups = active.filter((g) => members(g.id).some((m) => finalOf(m.id) === null))
  const shown = onlyIncomplete ? incompleteGroups : active
  const finals = students.map((m) => finalOf(m.id)).filter((x): x is number => x !== null)
  const average = finals.length ? finals.reduce((s, x) => s + x, 0) / finals.length : null
  const passed = view === 'final' ? students.filter((m) => calcFinal(m.id, data.marks, cfg).passed === true).length : null
  const unsigned = view === 'final' ? 0 : active.filter((g) => !data.marks.declarations.some((d) => d.group_id === g.id && d.phase === view)).length

  const formula =
    view === 'final'
      ? `Final = FYP-1 /${cfg.fyp1.total} + FYP-2 /${cfg.fyp2.total}. Pass: ${cfg.passMark} or more overall and at least ${cfg.passMark}% in FYP-2.`
      : `Advisor (class average ÷ 100 × ${cfg[view].advisor}) + ${cfg[view].parts.map((p) => `${componentLabel[p.component].replace(/^FYP-\d /, '')} /${p.weight}`).join(' + ')}${phaseOutOf(cfg[view]) !== cfg[view].total ? ` = /${phaseOutOf(cfg[view])}, then ÷ ${phaseOutOf(cfg[view])} × ${cfg[view].total}` : ` = /${cfg[view].total}`}.`

  const total = view === 'final' ? cfg.fyp1.total + cfg.fyp2.total : cfg[view].total
  const exportCsv = () => downloadText(`${view === 'final' ? 'Final' : phaseLabel[view]} results ${data.settings.academic_year ?? ''}.csv`.replace(/\s+/g, ' ').trim(), resultSheetCsv(active, members, data.marks, cfg, view))

  return (
    <>
      <PageHeader
        title="Results"
        subtitle={formula}
        actions={
          <>
            <Button variant="secondary" icon={Download} disabled={students.length === 0} onClick={exportCsv}>Export CSV</Button>
            {view !== 'final' &&
              (cfg.published[view] ? (
                <Button variant="secondary" icon={EyeOff} onClick={() => setConfirm({ phase: view, publish: false })}>Unpublish {phaseLabel[view]}</Button>
              ) : (
                <Button icon={Send} disabled={students.length === 0} onClick={() => setConfirm({ phase: view, publish: true })}>Publish {phaseLabel[view]}</Button>
              ))}
          </>
        }
      />

      <div className="mb-4">
        <PhaseTabs<SheetView> value={view} onChange={setView} tabs={[{ id: 'fyp1', label: `FYP-1${cfg.published.fyp1 ? ' ✓' : ''}` }, { id: 'fyp2', label: `FYP-2${cfg.published.fyp2 ? ' ✓' : ''}` }, { id: 'final', label: 'Final' }]} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Students complete', value: `${complete} / ${students.length}` },
          view === 'final'
            ? { label: 'Passed', value: `${passed} / ${students.length}` }
            : { label: 'Declarations not signed', value: String(unsigned) },
          { label: `Average (/${total})`, value: average === null ? '—' : fmt(average) },
          view === 'final'
            ? { label: 'Status', value: cfg.published.fyp1 && cfg.published.fyp2 ? 'Published' : 'Not published' }
            : { label: 'Status', value: cfg.published[view] ? 'Published' : 'Not published' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/75 border border-white/70 p-4">
            <div className={cx('text-[22px] font-bold tracking-tight leading-none', s.value === 'Published' && 'text-good')}>{s.value}</div>
            <div className="text-[13px] text-ink-2 mt-1.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mb-3">
        <PhaseTabs value={onlyIncomplete ? 'missing' : 'all'} onChange={(v) => setOnlyIncomplete(v === 'missing')} tabs={[{ id: 'all', label: 'All groups' }, { id: 'missing', label: `Missing marks ${incompleteGroups.length}` }]} />
        {view !== 'final' && cfg.published[view] && <Badge tone="green">Students can see these marks</Badge>}
      </div>

      <Panel padded={false}>
        {shown.length === 0 ? (
          <EmptyState icon={Calculator} title={onlyIncomplete ? 'No missing marks' : 'No active groups yet'} />
        ) : (
          <ResultSheet groups={shown} membersOf={members} data={data.marks} cfg={cfg} view={view} onOpenGroup={(g) => navigate(`/admin/results/${g.id}`)} />
        )}
      </Panel>

      {confirm && (
        <Modal title={`${confirm.publish ? 'Publish' : 'Unpublish'} ${phaseLabel[confirm.phase]} results?`} onClose={() => setConfirm(null)}>
          <div className="flex flex-col gap-4 text-[13px] text-ink-2">
            {confirm.publish ? (
              <>
                <p>Every group will see its {phaseLabel[confirm.phase]} marks and get a notice. These marks are locked while published.</p>
                {complete < students.length && (
                  <p className="rounded-xl bg-warn-soft text-warn px-3.5 py-2.5 font-medium">{students.length - complete} student{students.length - complete === 1 ? ' is' : 's are'} still missing marks and will show as incomplete.</p>
                )}
                {unsigned > 0 && <p className="rounded-xl bg-warn-soft text-warn px-3.5 py-2.5 font-medium">{unsigned} group{unsigned === 1 ? ' has' : 's have'} no signed declaration.</p>}
              </>
            ) : (
              <p>Students will no longer see these marks, and supervisors and jury can change them again.</p>
            )}
            <ModalActions>
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button onClick={async () => {
                const ok = await run(() => publishResults(confirm.phase, confirm.publish), `${phaseLabel[confirm.phase]} results ${confirm.publish ? 'published' : 'unpublished'}.`)
                if (ok) setConfirm(null)
              }}>{confirm.publish ? 'Publish' : 'Unpublish'}</Button>
            </ModalActions>
          </div>
        </Modal>
      )}
    </>
  )
}
