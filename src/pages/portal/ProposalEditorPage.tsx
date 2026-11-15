import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Lock, Save, X } from 'lucide-react'
import { useStudentData } from '../../student/StudentData'
import { ABSTRACT_WORDS, editableStatuses, MIN, missingFields, saveProposal, wordCount, type ProposalDraft } from '../../lib/proposalsApi'
import { Badge, Button, ErrorBox, Field, Panel, inputCls, textareaCls, cx, useAsync } from '../../components/ui'
import { DOMAINS, IdeaTabs, PROJECT_TYPES, ProposalDetail } from '../../proposals/shared'

const empty = (slot: number): ProposalDraft => ({ slot, title: '', summary: '', objectives: '', outcomes: '', project_type: '', domain: '', tech_stack: [], apis: '' })

function Counter({ value, min }: { value: string; min: number }) {
  const n = value.trim().length
  return <span className={cx('text-xs', n >= min ? 'text-good' : 'text-ink-3')}>{n >= min ? '✓' : `${n}/${min} characters minimum`}</span>
}

function WordCounter({ value }: { value: string }) {
  const n = wordCount(value)
  const ok = n >= ABSTRACT_WORDS.min && n <= ABSTRACT_WORDS.max
  return <span className={cx('text-xs', ok ? 'text-good' : n > ABSTRACT_WORDS.max ? 'text-bad' : 'text-ink-3')}>{n} words {ok ? '✓' : `(needs ${ABSTRACT_WORDS.min}–${ABSTRACT_WORDS.max})`}</span>
}

function ProposalEditor() {
  const params = useParams()
  const slot = Math.min(3, Math.max(1, Number(params.slot) || 1))
  const navigate = useNavigate()
  const { data, reload, toast } = useStudentData()
  const { group, proposals } = data
  const existing = proposals.find((p) => p.slot === slot)
  const editable = editableStatuses.includes(group.proposal_status) && group.status === 'active'

  const [form, setForm] = useState<ProposalDraft>(existing ? { ...existing, apis: existing.apis ?? '' } : empty(slot))
  const [tech, setTech] = useState('')
  const [dirty, setDirty] = useState(false)
  const { error, busy, attempt } = useAsync()

  // Warn before leaving the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const set = <K extends keyof ProposalDraft>(k: K, v: ProposalDraft[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setDirty(true)
  }
  const addTech = () => {
    const t = tech.trim()
    if (t && !form.tech_stack.includes(t) && form.tech_stack.length < 12) set('tech_stack', [...form.tech_stack, t])
    setTech('')
  }

  const save = async (then?: 'next' | 'overview') => {
    const ok = await attempt(async () => (await saveProposal(form), true))
    if (!ok) return
    setDirty(false)
    await reload()
    toast(`Idea ${slot} saved.`)
    if (then === 'next' && slot < 3) navigate(`/student/proposals/${slot + 1}`)
    if (then === 'overview' || (then === 'next' && slot === 3)) navigate('/student/proposals')
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    save('next')
  }

  const goTo = (s: number) => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
    navigate(`/student/proposals/${s}`)
  }

  const missing = missingFields(form)

  return (
    <>
      <Link to="/student/proposals" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink mb-4"><ArrowLeft size={15} /> Proposals</Link>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h1 className="text-[26px] font-bold tracking-tight">Idea {slot}</h1>
        <IdeaTabs value={slot} onChange={goTo} proposals={proposals} mark={(p) => (missingFields(p).length === 0 ? <span className="w-1.5 h-1.5 rounded-full bg-good" /> : null)} />
      </div>

      {!editable ? (
        <Panel>
          <p className="text-[13px] text-ink-3 mb-4 flex items-center gap-1.5"><Lock size={14} />This idea is locked while it is reviewed.</p>
          <ProposalDetail proposal={existing} slot={slot} approved={existing?.id === group.approved_proposal_id} />
        </Panel>
      ) : (
        <form onSubmit={onSubmit}>
          <Panel>
            <div className="flex flex-col gap-5">
              {existing?.supervisor_note && (
                <div className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13px]"><span className="font-semibold">Supervisor note: </span>{existing.supervisor_note}</div>
              )}
              <Field label="Project title">
                <input value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} className={inputCls} placeholder="e.g. Smart attendance using face recognition" />
                <Counter value={form.title} min={MIN.title} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Project type">
                  <select value={form.project_type} onChange={(e) => set('project_type', e.target.value)} className={inputCls}>
                    <option value="">Choose…</option>
                    {PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Domain">
                  <input list="fyp-domains" value={form.domain} maxLength={120} onChange={(e) => set('domain', e.target.value)} className={inputCls} placeholder="Choose or type" />
                  <datalist id="fyp-domains">{DOMAINS.map((d) => <option key={d} value={d} />)}</datalist>
                </Field>
              </div>
              <Field label="Abstract" hint="One paragraph, no bullet points. Say WHAT you will build, HOW (method and technology) and WHY it matters — like a movie trailer for your project.">
                <textarea rows={8} value={form.summary} maxLength={4000} onChange={(e) => set('summary', e.target.value.replace(/\n+/g, ' '))} className={textareaCls} />
                <WordCounter value={form.summary} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Objectives" hint="One per line.">
                  <textarea rows={5} value={form.objectives} maxLength={4000} onChange={(e) => set('objectives', e.target.value)} className={textareaCls} />
                  <Counter value={form.objectives} min={MIN.objectives} />
                </Field>
                <Field label="Expected outcomes" hint="What you will deliver at the end.">
                  <textarea rows={5} value={form.outcomes} maxLength={4000} onChange={(e) => set('outcomes', e.target.value)} className={textareaCls} />
                  <Counter value={form.outcomes} min={MIN.outcomes} />
                </Field>
              </div>
              <Field label="APIs used" hint="Every API the project will use (e.g. Google Maps API, OpenAI API). Write “None” if there are none.">
                <input value={form.apis} maxLength={1000} onChange={(e) => set('apis', e.target.value)} className={inputCls} placeholder="e.g. Google Maps API, Stripe API" />
                <Counter value={form.apis} min={MIN.apis} />
              </Field>
              <Field label="Technologies (optional)" hint="Press Enter to add.">
                <div className="flex gap-2">
                  <input value={tech} onChange={(e) => setTech(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTech() } }} className={inputCls} placeholder="e.g. React" />
                  <Button variant="secondary" onClick={addTech}>Add</Button>
                </div>
              </Field>
              {form.tech_stack.length > 0 && (
                <div className="flex gap-1.5 flex-wrap -mt-2">
                  {form.tech_stack.map((t) => (
                    <span key={t} className="h-7 pl-2.5 pr-1 rounded-md bg-black/[0.05] text-xs font-medium flex items-center gap-1">
                      {t}
                      <button type="button" aria-label={`Remove ${t}`} onClick={() => set('tech_stack', form.tech_stack.filter((x) => x !== t))} className="w-5 h-5 grid place-items-center rounded hover:bg-black/10 cursor-pointer"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <ErrorBox message={error} />
            </div>
          </Panel>

          <div className="sticky bottom-3 mt-4 glass-strong window-shadow rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-[13px]">
              {missing.length === 0 ? <Badge tone="green">Complete</Badge> : <span className="text-ink-3">Still needed: {missing.join(', ')}</span>}
              {dirty && <span className="ml-2 text-warn">Unsaved changes</span>}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" icon={Save} disabled={busy} onClick={() => save('overview')}>Save draft</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : slot < 3 ? `Save & go to idea ${slot + 1}` : 'Save & finish'}</Button>
            </div>
          </div>
        </form>
      )}
    </>
  )
}

/** A fresh editor per idea, so switching tabs never mixes up form contents. */
export default function ProposalEditorPage() {
  const { slot } = useParams()
  return <ProposalEditor key={slot} />
}
