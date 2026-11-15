// End-to-end test of the whole FYP workflow with temporary accounts. Everything is deleted at the end.
import { createRequire } from 'node:module'
import crypto from 'node:crypto'
import { env, url, mgmt, sql } from './sbenv.mjs'
const require = createRequire(process.cwd() + '/package.json')
const { createClient } = require('@supabase/supabase-js')

const keys = await (await mgmt('/api-keys?reveal=true')).json()
const admin = createClient(url, keys.find((k) => k.name === 'service_role').api_key, { auth: { persistSession: false } })
const tag = 'zz-test-' + crypto.randomBytes(3).toString('hex')
const pw = crypto.randomBytes(12).toString('base64url')
const created = []
let pass = 0, fail = 0
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log(cond ? '  ✓' : '  ✗', label, extra) }
const seq = (await sql('select last_value, is_called from group_code_seq'))[0]
const startAudit = (await sql('select coalesce(max(id), 0) m from audit_log'))[0].m
const settingsBefore = await sql("select key, value from app_settings where key in ('fyp1_published','fyp2_published','current_phase')")

async function makeLogin(name, role, display) {
  const { data, error } = await admin.auth.admin.createUser({ email: `${name}@login.fyp360.app`, password: pw, email_confirm: true })
  if (error) throw error
  created.push(data.user.id)
  await admin.from('profiles').insert({ id: data.user.id, role, username: name, display_name: display })
  return data.user.id
}
async function session(name) {
  const c = createClient(url, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: `${name}@login.fyp360.app`, password: pw })
  if (error) throw error
  return c
}
const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
const at = (days) => new Date(Date.now() + days * 864e5).toISOString()
const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')
const pdf = Buffer.from('%PDF-1.4\n% test file\n')
const files = []
const up = async (client, gid, did, type = 'application/pdf', body = pdf) => {
  const path = `${gid}/${did}/${Date.now()}-${crypto.randomBytes(2).toString('hex')}.bin`
  const u = await client.storage.from('submissions').upload(path, body, { contentType: type })
  if (!u.error) files.push(path)
  if (u.error) return { error: u.error, stage: 'storage' }
  const r = await client.rpc('record_submission', { p_deliverable_id: did, p_path: path, p_name: 'report.pdf' })
  return { error: r.error, stage: 'record', path }
}

try {
  await makeLogin(`${tag}-coord`, 'coordinator', 'Test Coordinator')
  const supId = await makeLogin(`${tag}-sup`, 'supervisor', 'Test Supervisor')
  await makeLogin(`${tag}-sup2`, 'supervisor', 'Other Supervisor')
  const juryId = await makeLogin(`${tag}-jury`, 'jury', 'Test Jury')
  const { data: grp } = await admin.from('groups').insert({ name: `${tag} group`, supervisor_id: supId }).select().single()
  const { data: grp2 } = await admin.from('groups').insert({ name: `${tag} group two` }).select().single()
  await admin.from('groups').update({ account_id: await makeLogin(`${tag}-grp`, 'group', grp.name) }).eq('id', grp.id)
  await admin.from('groups').update({ account_id: await makeLogin(`${tag}-grp2`, 'group', grp2.name) }).eq('id', grp2.id)
  await admin.from('group_jury').insert({ group_id: grp.id, jury_id: juryId })
  const { data: mem } = await admin.from('group_members').insert(['A', 'B'].map((x, i) => ({ group_id: grp.id, student_id: `${tag}-${x}`.toUpperCase(), full_name: `Student ${x}`, email: `${tag}-${x.toLowerCase()}@example.com`, is_lead: i === 0 }))).select().order('full_name')
  const [A, B] = mem.map((m) => m.id)
  const G = await session(`${tag}-grp`), G2 = await session(`${tag}-grp2`), S = await session(`${tag}-sup`), S2 = await session(`${tag}-sup2`), J = await session(`${tag}-jury`), K = await session(`${tag}-coord`)

  console.log('Proposals (abstract 200–250 words + APIs)')
  const idea = (n, w, apis = 'Google Maps API') => ({ p_slot: n, p_title: `Idea ${n} smart campus`, p_summary: words(w), p_objectives: 'Build it well and test it', p_outcomes: 'Working app and report', p_project_type: 'Development', p_domain: 'Web application', p_tech_stack: ['React'], p_apis: apis })
  await G.rpc('save_proposal', idea(1, 220)); await G.rpc('save_proposal', idea(2, 220)); await G.rpc('save_proposal', idea(3, 120))
  let r = await G.rpc('submit_proposals'); ok('120-word abstract blocks submit', !!r.error, r.error?.message)
  await G.rpc('save_proposal', idea(3, 220, ''))
  r = await G.rpc('submit_proposals'); ok('missing APIs blocks submit', !!r.error)
  await G.rpc('save_proposal', idea(3, 220, 'None'))
  ok('three complete ideas submit', !(await G.rpc('submit_proposals')).error)

  console.log('Deliverables and uploads')
  ok('group cannot add deliverables', !!(await G.from('deliverables').insert({ phase: 'fyp1', title: 'Hack', due_at: at(2) })).error)
  const mk = async (title, days, kind = 'document') => (await K.from('deliverables').insert({ phase: 'fyp1', title: `${tag} ${title}`, kind, due_at: at(days) }).select().single()).data
  const d1 = await mk('Report', 2), d2 = await mk('Late thing', -1), d3 = await mk('Video', 2, 'video')
  ok('coordinator adds deliverables', !!d1 && !!d2 && !!d3)
  r = await up(G, grp.id, d1.id); ok('group uploads report (v1)', !r.error, r.error?.message)
  r = await up(G, grp.id, d1.id); ok('second upload blocked while waiting for review', !!r.error, `${r.stage}: ${r.error?.message}`)
  r = await up(G, grp.id, d2.id); ok('upload after deadline blocked', !!r.error, `${r.stage}: ${r.error?.message}`)
  r = await up(G, grp.id, d1.id, 'text/plain', Buffer.from('hi')); ok('text file rejected', !!r.error, `${r.stage}: ${r.error?.message}`)
  r = await up(G, grp.id, d3.id); ok('PDF on a video deliverable rejected', !!r.error, `${r.stage}: ${r.error?.message}`)
  r = await up(G2, grp.id, d1.id); ok("other group cannot upload into this group's folder", !!r.error, r.stage)
  const { data: sub1 } = await admin.from('submissions').select('*').eq('group_id', grp.id).eq('deliverable_id', d1.id).single()
  ok('other group cannot see the file', (await G2.from('submissions').select('*')).data.length === 0 && !!(await G2.storage.from('submissions').createSignedUrl(sub1.file_path, 60)).error)
  ok('jury can open the file', !(await J.storage.from('submissions').createSignedUrl(sub1.file_path, 60)).error)

  console.log('Supervisor review')
  const rev = (c, id, d, f) => c.rpc('review_submission', { p_submission_id: id, p_decision: d, p_feedback: f })
  ok('other supervisor cannot review', !!(await rev(S2, sub1.id, 'approve', '')).error)
  ok('changes need feedback', !!(await rev(S, sub1.id, 'changes', ' ')).error)
  ok('supervisor asks for changes', !(await rev(S, sub1.id, 'changes', 'Add the ERD')).error)
  r = await up(G, grp.id, d1.id); ok('group re-uploads (v2)', !r.error, r.error?.message)
  const { data: v2 } = await admin.from('submissions').select('*').eq('deliverable_id', d1.id).eq('version', 2).single()
  ok('cannot review the old version', !!(await rev(S, sub1.id, 'approve', '')).error)
  ok('supervisor approves v2', !(await rev(S, v2.id, 'approve', 'Good')).error)
  r = await up(G, grp.id, d1.id); ok('no uploads after approval', !!r.error, r.stage)
  ok('group cannot give itself an extension', !!(await G.from('deliverable_extensions').insert({ deliverable_id: d2.id, group_id: grp.id, due_at: at(1) })).error)
  ok('coordinator extends the late deadline', !(await K.from('deliverable_extensions').insert({ deliverable_id: d2.id, group_id: grp.id, due_at: at(1) })).error)
  r = await up(G, grp.id, d2.id); ok('upload works with the extension', !r.error, r.error?.message)

  console.log('Change requests')
  const ask = (c, t, d) => c.rpc('create_change_request', { p_title: t, p_details: d })
  ok('too-short request rejected', !!(await ask(G, 'Change', 'short')).error)
  ok('other group (no jury) blocked', !!(await ask(G2, 'Change the stack', 'We want to move from Firebase to Supabase because of cost.')).error)
  ok('group asks for a change', !(await ask(G, 'Change the stack', 'We want to move from Firebase to Supabase because of cost.')).error)
  ok('only one open request at a time', !!(await ask(G, 'Another change', 'We also want to add a mobile app because users asked.')).error)
  const { data: cr } = await admin.from('change_requests').select('*').eq('group_id', grp.id).single()
  const decide = (c, ap, com) => c.rpc('decide_change_request', { p_id: cr.id, p_approve: ap, p_comment: com })
  ok('supervisor (not jury) cannot decide', !!(await decide(S, true, 'ok')).error)
  ok('jury must write a comment', !!(await decide(J, true, '')).error)
  ok('jury approves in writing', !(await decide(J, true, 'Fine, keep the same features')).error)
  ok('jury cannot decide twice', !!(await decide(J, true, 'again')).error)
  ok('coordinator approves', !(await decide(K, true, 'Approved')).error)
  ok('request is approved', (await admin.from('change_requests').select('status').eq('id', cr.id).single()).data.status === 'approved')

  console.log('Announcements and declarations')
  ok('group cannot post announcements', !!(await G.from('announcements').insert({ title: 'Hack', body: 'x' })).error)
  ok('coordinator posts', !(await K.from('announcements').insert({ title: `${tag} Defence day`, body: 'North Campus, 9 AM' })).error)
  ok('both groups notified', (await admin.from('notifications').select('group_id').eq('kind', 'announcement').in('group_id', [grp.id, grp2.id])).data.length === 2)
  ok('jury cannot sign declaration', !!(await J.rpc('set_declaration', { p_group_id: grp.id, p_phase: 'fyp1', p_signed: true })).error)
  ok('supervisor signs FYP-1 declaration', !(await S.rpc('set_declaration', { p_group_id: grp.id, p_phase: 'fyp1', p_signed: true })).error)

  console.log('FYP-1 marks')
  const meet = (date, rows) => S.rpc('save_class_session', { p_group_id: grp.id, p_session_id: null, p_held_on: date, p_topic: 't', p_rows: rows })
  ok('FYP-1 meeting', !(await meet(day(20), [{ member_id: A, status: 'present', mark: 80 }, { member_id: B, status: 'present', mark: 100 }])).error)
  const ev = (c, comp, rows) => c.rpc('save_evaluation_marks', { p_group_id: grp.id, p_component: comp, p_rows: rows })
  ok('jury proposal marks', !(await ev(J, 'proposal', [{ member_id: A, marks: 8, absent: false }, { member_id: B, marks: 10, absent: false }])).error)
  ok('jury internal marks', !(await ev(J, 'fyp1_internal', [{ member_id: A, marks: 50, absent: false }, { member_id: B, marks: 60, absent: false }])).error)
  ok('publish FYP-1', !(await K.rpc('publish_results', { p_phase: 'fyp1', p_publish: true })).error)

  console.log('FYP-2')
  ok('group cannot switch the phase', !!(await G.from('app_settings').update({ value: 'fyp2' }).eq('key', 'current_phase').select().then((x) => (x.data?.length ? null : 'none'))))
  await K.from('app_settings').update({ value: 'fyp2' }).eq('key', 'current_phase')
  ok('FYP-2 meeting', !(await meet(day(2), [{ member_id: A, status: 'present', mark: 90 }, { member_id: B, status: 'present', mark: 70 }])).error)
  ok('FYP-2 meeting stored in FYP-2', (await admin.from('class_sessions').select('phase').eq('group_id', grp.id).eq('held_on', day(2)).single()).data.phase === 'fyp2')
  ok('FYP-1 meetings now locked (published)', !!(await S.rpc('save_class_session', { p_group_id: grp.id, p_session_id: (await admin.from('class_sessions').select('id').eq('held_on', day(20)).single()).data.id, p_held_on: day(20), p_topic: 'x', p_rows: [{ member_id: A, status: 'present', mark: 10 }] })).error)
  ok('internal over 30 blocked', !!(await ev(J, 'fyp2_internal', [{ member_id: A, marks: 31, absent: false }])).error)
  ok('jury FYP-2 internal', !(await ev(J, 'fyp2_internal', [{ member_id: A, marks: 25, absent: false }, { member_id: B, marks: 10, absent: false }])).error)
  ok('jury cannot enter external marks', !!(await ev(J, 'external', [{ member_id: A, marks: 16, absent: false }])).error)
  ok('coordinator enters external marks', !(await ev(K, 'external', [{ member_id: A, marks: 16, absent: false }, { member_id: B, marks: 5, absent: false }])).error)
  let rec = (await G.rpc('my_marks_record')).data
  ok('group sees FYP-1 marks, not FYP-2', rec.published.fyp1 && !rec.published.fyp2 && rec.marks.length === 4 && rec.marks.every((m) => ['proposal', 'fyp1_internal'].includes(m.component)))
  ok('publish FYP-2', !(await K.rpc('publish_results', { p_phase: 'fyp2', p_publish: true })).error)
  rec = (await G.rpc('my_marks_record')).data
  ok('group sees all 8 marks', rec.marks.length === 8)

  // Same rules as the app: phase = advisor avg/100×weight + parts, scaled; pass = total ≥ 60 and FYP-2 ≥ 36.
  const res = (id) => {
    const att = (ph) => rec.attendance.filter((a) => a.member_id === id && rec.sessions.find((s) => s.id === a.session_id).phase === ph).map((a) => Number(a.mark))
    const m = (c) => Number(rec.marks.find((x) => x.member_id === id && x.component === c).marks)
    const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length
    const f1 = ((avg(att('fyp1')) / 100) * 30 + m('proposal') + m('fyp1_internal')) * 0.4
    const f2 = (avg(att('fyp2')) / 100) * 10 + m('fyp2_internal') + m('external')
    const total = Math.round((f1 + f2) * 100) / 100
    return { f1: Math.round(f1 * 100) / 100, f2, total, pass: total >= 60 && f2 >= 36 }
  }
  const ra = res(A), rb = res(B)
  ok('A: FYP-1 32.8 + FYP-2 50 = 82.8, PASS', ra.f1 === 32.8 && ra.f2 === 50 && ra.total === 82.8 && ra.pass, JSON.stringify(ra))
  ok('B: 40 + 22 = 62 but FYP-2 below 36 → FAIL', rb.f1 === 40 && rb.f2 === 22 && rb.total === 62 && !rb.pass, JSON.stringify(rb))
} catch (e) {
  fail++
  console.log('  ✗ crashed:', e.message)
} finally {
  for (const s of settingsBefore) await sql(`update app_settings set value = '${s.value}' where key = '${s.key}'`)
  if (files.length) await admin.storage.from('submissions').remove(files)
  await admin.from('groups').delete().like('name', 'zz-test-%')
  await admin.from('group_members').delete().like('email', 'zz-test-%')
  await admin.from('deliverables').delete().like('title', 'zz-test-%')
  await admin.from('announcements').delete().like('title', 'zz-test-%')
  await admin.from('audit_log').delete().in('actor_id', created)
  await sql(`delete from audit_log where id > ${startAudit} and actor_id is null`)
  for (const id of created) await admin.auth.admin.deleteUser(id)
  await sql(`select setval('group_code_seq', ${seq.last_value}, ${seq.is_called})`)
  const left = (await sql("select (select count(*) from profiles where username like 'zz-%') p, (select count(*) from groups) g, (select count(*) from deliverables) d, (select count(*) from submissions) s, (select count(*) from change_requests) c, (select count(*) from announcements) an, (select count(*) from storage.objects where bucket_id='submissions') files, (select count(*) from audit_log) a, (select string_agg(key||'='||value, ' ') from app_settings where key in ('fyp1_published','fyp2_published','current_phase')) st"))[0]
  console.log(`\n${pass} passed, ${fail} failed · left: ${JSON.stringify(left)}`)
}
