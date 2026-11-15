import { supabase } from './supabase'
import type { Phase } from './marksApi'

// ---------- types

export type DeliverableKind = 'document' | 'video'
export type SubmissionStatus = 'submitted' | 'approved' | 'changes_requested'
export type ChangeStatus = 'pending_jury' | 'pending_coordinator' | 'approved' | 'rejected'

export interface Deliverable {
  id: string
  phase: Phase
  title: string
  description: string
  kind: DeliverableKind
  due_at: string
  created_at: string
}

export interface Extension {
  deliverable_id: string
  group_id: string
  due_at: string
}

export interface Submission {
  id: string
  deliverable_id: string
  group_id: string
  version: number
  file_path: string
  file_name: string
  file_size: number
  mime_type: string
  submitted_at: string
  status: SubmissionStatus
  feedback: string | null
  reviewed_by: string | null
  reviewed_at: string | null
}

export interface ChangeRequest {
  id: string
  group_id: string
  title: string
  details: string
  status: ChangeStatus
  jury_by: string | null
  jury_comment: string | null
  jury_at: string | null
  coord_by: string | null
  coord_comment: string | null
  coord_at: string | null
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  created_by: string | null
  created_at: string
}

export interface WorkflowData {
  deliverables: Deliverable[]
  extensions: Extension[]
  submissions: Submission[]
  changes: ChangeRequest[]
  announcements: Announcement[]
}

const check = <T,>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/** Everything the signed-in user may see (security rules filter by group). */
export async function loadWorkflow(): Promise<WorkflowData> {
  const [deliverables, extensions, submissions, changes, announcements] = await Promise.all([
    supabase.from('deliverables').select('*').order('due_at'),
    supabase.from('deliverable_extensions').select('*'),
    supabase.from('submissions').select('*').order('version', { ascending: false }),
    supabase.from('change_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(100),
  ])
  return {
    deliverables: check(deliverables),
    extensions: check(extensions),
    submissions: check<Submission[]>(submissions).map((s) => ({ ...s, file_size: Number(s.file_size) })),
    changes: check(changes),
    announcements: check(announcements),
  }
}

// ---------- coordinator: deliverables

export interface DeliverableDraft {
  phase: Phase
  title: string
  description: string
  kind: DeliverableKind
  due_at: string // ISO
}

export async function saveDeliverable(id: string | null, d: DeliverableDraft) {
  if (id) check(await supabase.from('deliverables').update(d).eq('id', id))
  else check(await supabase.from('deliverables').insert(d))
}

export async function deleteDeliverable(id: string) {
  const r = await supabase.from('deliverables').delete().eq('id', id)
  if (r.error?.message.includes('foreign key')) throw new Error('Groups have already uploaded work for this deliverable, so it cannot be deleted. Change its deadline instead.')
  check(r)
}

export async function setExtension(deliverableId: string, groupId: string, dueAt: string | null) {
  if (dueAt) check(await supabase.from('deliverable_extensions').upsert({ deliverable_id: deliverableId, group_id: groupId, due_at: dueAt }))
  else check(await supabase.from('deliverable_extensions').delete().eq('deliverable_id', deliverableId).eq('group_id', groupId))
}

// ---------- uploads

export const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
]
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime']
export const LIMITS: Record<DeliverableKind, { types: string[]; max: number; accept: string; label: string }> = {
  document: { types: DOC_TYPES, max: 20 * 1024 * 1024, accept: '.pdf,.doc,.docx,.ppt,.pptx,.zip,.png,.jpg,.jpeg', label: 'PDF, Word, PowerPoint, ZIP, PNG or JPG · up to 20 MB' },
  video: { types: VIDEO_TYPES, max: 50 * 1024 * 1024, accept: '.mp4,.mov', label: 'MP4 or MOV video · up to 50 MB' },
}

export const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

/** Problem with a file before uploading, or null. */
export function fileProblem(kind: DeliverableKind, file: File) {
  const l = LIMITS[kind]
  if (!l.types.includes(file.type)) return `This file type is not allowed. Use: ${l.label}.`
  if (file.size > l.max) return `This file is ${formatBytes(file.size)}. The limit is ${formatBytes(l.max)}.`
  if (file.size === 0) return 'This file is empty.'
  return null
}

export async function uploadSubmission(groupId: string, d: Deliverable, file: File) {
  const problem = fileProblem(d.kind, file)
  if (problem) throw new Error(problem)
  const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-80) || 'file'
  const path = `${groupId}/${d.id}/${Date.now()}-${safe}`
  const up = await supabase.storage.from('submissions').upload(path, file, { contentType: file.type, upsert: false })
  if (up.error) {
    const m = up.error.message
    throw new Error(/row-level security|policy/i.test(m) ? 'Uploads are closed for this deliverable.' : m)
  }
  check(await supabase.rpc('record_submission', { p_deliverable_id: d.id, p_path: path, p_name: file.name }))
}

/** Opens a file in a new tab. The tab opens straight away (inside the click) so pop-up blockers allow it. */
export async function openSubmission(path: string) {
  const tab = window.open('about:blank', '_blank')
  const r = await supabase.storage.from('submissions').createSignedUrl(path, 300)
  if (r.error) {
    tab?.close()
    throw new Error(r.error.message)
  }
  if (tab) {
    tab.opener = null
    tab.location.href = r.data.signedUrl
  } else {
    window.location.assign(r.data.signedUrl)
  }
}

export async function reviewSubmission(id: string, decision: 'approve' | 'changes', feedback: string) {
  check(await supabase.rpc('review_submission', { p_submission_id: id, p_decision: decision, p_feedback: feedback }))
}

// ---------- change requests

export async function createChangeRequest(title: string, details: string) {
  check(await supabase.rpc('create_change_request', { p_title: title, p_details: details }))
}

export async function decideChangeRequest(id: string, approve: boolean, comment: string) {
  check(await supabase.rpc('decide_change_request', { p_id: id, p_approve: approve, p_comment: comment }))
}

// ---------- announcements

export async function postAnnouncement(title: string, body: string) {
  check(await supabase.from('announcements').insert({ title: title.trim(), body: body.trim() }))
}

export async function deleteAnnouncement(id: string) {
  check(await supabase.from('announcements').delete().eq('id', id))
}

// ---------- derived state

export const dueFor = (w: WorkflowData, d: Deliverable, groupId: string) =>
  w.extensions.find((e) => e.deliverable_id === d.id && e.group_id === groupId)?.due_at ?? d.due_at

export const versionsOf = (w: WorkflowData, d: Deliverable, groupId: string) =>
  w.submissions.filter((s) => s.deliverable_id === d.id && s.group_id === groupId).sort((a, b) => b.version - a.version)

export type DeliverableState = 'approved' | 'submitted' | 'changes_requested' | 'open' | 'missed'

/** Where a group stands on a deliverable. Mirrors the upload rule in the database. */
export function deliverableState(w: WorkflowData, d: Deliverable, groupId: string, now = Date.now()): DeliverableState {
  const last = versionsOf(w, d, groupId)[0]
  if (last) return last.status
  return now > new Date(dueFor(w, d, groupId)).getTime() ? 'missed' : 'open'
}

export const canUploadNow = (w: WorkflowData, d: Deliverable, groupId: string) => {
  const s = deliverableState(w, d, groupId)
  return s === 'open' || s === 'changes_requested'
}

export const changeStatusLabel: Record<ChangeStatus, string> = {
  pending_jury: 'With jury',
  pending_coordinator: 'With coordinator',
  approved: 'Approved',
  rejected: 'Rejected',
}
