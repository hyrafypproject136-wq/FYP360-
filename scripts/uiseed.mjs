// Temporary UI-test accounts (all usernames start with zz-ui-). Remove with: node uiseed.mjs --clean
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { url, mgmt, sql } from './sbenv.mjs'
const STATE = new URL('./uiseed.state.json', import.meta.url)
const require = createRequire(process.cwd() + '/package.json')
const { createClient } = require('@supabase/supabase-js')
const keys = await (await mgmt('/api-keys?reveal=true')).json()
const admin = createClient(url, keys.find((k) => k.name === 'service_role').api_key, { auth: { persistSession: false } })
const PW = 'zz-ui-Test-2026'

async function clean() {
  const { data: profs } = await admin.from('profiles').select('id').like('username', 'zz-ui-%')
  const { data: gs } = await admin.from('groups').select('id').like('name', 'ZZ UI%')
  for (const g of gs ?? []) {
    for (const folder of (await admin.storage.from('submissions').list(g.id)).data ?? []) {
      const inner = (await admin.storage.from('submissions').list(`${g.id}/${folder.name}`)).data ?? []
      if (inner.length) await admin.storage.from('submissions').remove(inner.map((f) => `${g.id}/${folder.name}/${f.name}`))
    }
  }
  await admin.from('groups').delete().like('name', 'ZZ UI%')
  await admin.from('deliverables').delete().like('title', 'ZZ UI%')
  await admin.from('announcements').delete().like('title', 'ZZ UI%')
  await admin.from('group_members').delete().like('email', 'zz-ui-%')
  for (const p of profs ?? []) await admin.auth.admin.deleteUser(p.id)
  await admin.from('audit_log').delete().or('target.like.zz-ui-%,details->new->>name.like.ZZ UI%,details->old->>name.like.ZZ UI%,details->new->>email.like.zz-ui-%,details->old->>email.like.zz-ui-%')
  await admin.from('password_reset_requests').delete().in('identifier', ['test-request', 'test-check'])
  if (fs.existsSync(STATE)) {
    const st = JSON.parse(fs.readFileSync(STATE, 'utf8'))
    const ids = (profs ?? []).map((p) => `'${p.id}'`).join(',') || "'00000000-0000-0000-0000-000000000000'"
    await sql(`delete from audit_log where id > ${st.audit} and (actor_id is null or actor_id in (${ids}))`)
    await sql(`select setval('group_code_seq', ${st.seq.last_value}, ${st.seq.is_called})`)
    await sql("update app_settings set value = 'false' where key in ('fyp1_published', 'fyp2_published')")
    await sql("update app_settings set value = 'fyp1' where key = 'current_phase'")
    fs.unlinkSync(STATE)
  }
  console.log('cleaned', (profs ?? []).length, 'test logins')
}
if (process.argv.includes('--clean')) { await clean(); process.exit(0) }

await clean()
fs.writeFileSync(STATE, JSON.stringify({ audit: (await sql('select coalesce(max(id), 0) m from audit_log'))[0].m, seq: (await sql('select last_value, is_called from group_code_seq'))[0] }))
async function login(username, role, display) {
  const { data, error } = await admin.auth.admin.createUser({ email: `${username}@login.fyp360.app`, password: PW, email_confirm: true })
  if (error) throw error
  await admin.from('profiles').insert({ id: data.user.id, role, username, display_name: display })
  return data.user.id
}
await login('zz-ui-admin', 'coordinator', 'ZZ UI Coordinator')
const sup = await login('zz-ui-sup', 'supervisor', 'Dr. ZZ UI Supervisor')
const jury = await login('zz-ui-jury', 'jury', 'Prof. ZZ UI Jury')
const { data: g } = await admin.from('groups').insert({ name: 'ZZ UI Test Group', section: 'A', semester: 'Fall 2026', supervisor_id: sup }).select().single()
const acct = await login('zz-ui-grp', 'group', g.name)
await admin.from('groups').update({ account_id: acct }).eq('id', g.id)
await admin.from('group_jury').insert({ group_id: g.id, jury_id: jury })
await admin.from('group_members').insert([
  { group_id: g.id, student_id: 'ZZ-UI-001', full_name: 'Ali Test', email: 'zz-ui-ali@example.com', is_lead: true },
  { group_id: g.id, student_id: 'ZZ-UI-002', full_name: 'Sara Test', email: 'zz-ui-sara@example.com', is_lead: false },
  { group_id: g.id, student_id: 'ZZ-UI-003', full_name: 'Omar Test', email: 'zz-ui-omar@example.com', is_lead: false },
])
await admin.from('group_members').insert({ group_id: null, student_id: 'ZZ-UI-004', full_name: 'Hina Test (no group)', email: 'zz-ui-hina@example.com' })
console.log('created test group', g.code, 'and logins zz-ui-admin, zz-ui-sup, zz-ui-jury, zz-ui-grp')

if (process.argv.includes('--rich')) {
  const { createClient: cc } = require('@supabase/supabase-js')
  const { env } = await import('./sbenv.mjs')
  const sess = async (u) => { const c = cc(url, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } }); const r = await c.auth.signInWithPassword({ email: `${u}@login.fyp360.app`, password: PW }); if (r.error) throw r.error; return c }
  const G = await sess('zz-ui-grp'), S = await sess('zz-ui-sup'), J = await sess('zz-ui-jury'), K = await sess('zz-ui-admin')
  const must = (r, what) => { if (r.error) throw new Error(what + ': ' + r.error.message); return r.data }
  const text = (topic) => `This project builds a ${topic} for university students and staff. ` + Array.from({ length: 210 }, (_, i) => ['it', 'helps', 'people', 'save', 'time', 'every', 'day', 'with', 'simple', 'tools'][i % 10]).join(' ') + '.'
  const topics = ['smart attendance system', 'campus navigation app', 'library booking portal']
  for (const [i, t] of topics.entries()) must(await G.rpc('save_proposal', { p_slot: i + 1, p_title: t.replace(/^./, (c) => c.toUpperCase()), p_summary: text(t), p_objectives: 'Build the app\nTest with real users', p_outcomes: 'Working app, report and poster', p_project_type: 'Development', p_domain: 'Web application', p_tech_stack: ['React', 'Supabase'], p_apis: i === 1 ? 'Google Maps API' : 'None' }), 'proposal')
  must(await G.rpc('submit_proposals'), 'submit')
  must(await S.rpc('supervisor_review_proposals', { p_group_id: g.id, p_decision: 'endorse', p_recommended_slot: 2, p_comment: 'Idea 2 is the strongest', p_notes: { 2: 'Clear scope' } }), 'endorse')
  const props = must(await K.from('proposals').select('id, slot').eq('group_id', g.id).order('slot'), 'read')
  must(await K.rpc('coordinator_decide_proposals', { p_group_id: g.id, p_decision: 'approve', p_proposal_id: props[1].id, p_comment: 'Approved' }), 'approve')
  const at = (d) => new Date(Date.now() + d * 864e5).toISOString()
  const dl = must(await K.from('deliverables').insert([
    { phase: 'fyp1', title: 'ZZ UI Proposal document', kind: 'document', due_at: at(5), description: 'Three proposals in the official format.' },
    { phase: 'fyp1', title: 'ZZ UI FYP-1 report', kind: 'document', due_at: at(12), description: '' },
    { phase: 'fyp2', title: 'ZZ UI FYP-2 report', kind: 'document', due_at: at(120), description: '' },
    { phase: 'fyp2', title: 'ZZ UI Demo video', kind: 'video', due_at: at(120), description: 'A 4–5 minute demo.' },
  ]).select(), 'deliverables')
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
  const upload = async () => { const path = `${g.id}/${dl[0].id}/${Date.now()}-proposal.pdf`; must(await G.storage.from('submissions').upload(path, pdf, { contentType: 'application/pdf' }), 'upload'); must(await G.rpc('record_submission', { p_deliverable_id: dl[0].id, p_path: path, p_name: 'proposal.pdf' }), 'record') }
  await upload()
  const s1 = must(await K.from('submissions').select('id').eq('group_id', g.id).single(), 'sub')
  must(await S.rpc('review_submission', { p_submission_id: s1.id, p_decision: 'changes', p_feedback: 'Add the use case diagram.' }), 'review')
  await upload()
  const { data: ms } = await admin.from('group_members').select('id, full_name').eq('group_id', g.id).order('full_name')
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
  must(await S.rpc('save_class_session', { p_group_id: g.id, p_session_id: null, p_held_on: day(14), p_topic: 'Scope and requirements', p_rows: ms.map((m, i) => ({ member_id: m.id, status: 'present', mark: 70 + i * 10 })) }), 'm1')
  must(await S.rpc('save_class_session', { p_group_id: g.id, p_session_id: null, p_held_on: day(1), p_topic: 'Use case diagram review', p_rows: ms.map((m, i) => (i === 1 ? { member_id: m.id, status: 'absent', mark: null } : { member_id: m.id, status: 'present', mark: 85 })) }), 'm2')
  must(await J.rpc('save_evaluation_marks', { p_group_id: g.id, p_component: 'proposal', p_rows: ms.map((m, i) => ({ member_id: m.id, marks: 7 + i, absent: false })) }), 'jury')
  must(await G.rpc('create_change_request', { p_title: 'Use Supabase instead of Firebase', p_details: 'Supabase gives us SQL and row level security, which fits our project better.' }), 'change')
  must(await K.from('announcements').insert({ title: 'ZZ UI Proposal defence on 5 September', body: 'Venue: North Campus\nTime: 9:00 AM – 3:00 PM' }), 'announce')
  console.log('rich test data added')
}
