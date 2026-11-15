import { supabase } from './supabase'
import type { ProposalStatus } from './adminApi'

export interface Proposal {
  id: string
  group_id: string
  slot: number
  title: string
  summary: string
  objectives: string
  outcomes: string
  project_type: string
  domain: string
  tech_stack: string[]
  apis: string
  supervisor_note: string | null
  recommended: boolean
  updated_at: string
}

export interface ProposalEvent {
  id: number
  group_id: string
  actor_id: string | null
  actor_role: 'group' | 'supervisor' | 'coordinator'
  action: 'submitted' | 'revision_requested' | 'endorsed' | 'approved'
  comment: string | null
  created_at: string
}

export type ProposalDraft = Pick<Proposal, 'slot' | 'title' | 'summary' | 'objectives' | 'outcomes' | 'project_type' | 'domain' | 'tech_stack' | 'apis'>

const check = <T,>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export async function loadProposals(groupId: string) {
  const [proposals, events] = await Promise.all([
    supabase.from('proposals').select('*').eq('group_id', groupId).order('slot'),
    supabase.from('proposal_events').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
  ])
  return { proposals: check<Proposal[]>(proposals), events: check<ProposalEvent[]>(events) }
}

/** All proposals the signed-in user may see (coordinator: all; supervisor: own groups). */
export async function loadVisibleProposals() {
  return check<Proposal[]>(await supabase.from('proposals').select('*').order('slot'))
}

export async function saveProposal(p: ProposalDraft) {
  check(
    await supabase.rpc('save_proposal', {
      p_slot: p.slot,
      p_title: p.title,
      p_summary: p.summary,
      p_objectives: p.objectives,
      p_outcomes: p.outcomes,
      p_project_type: p.project_type,
      p_domain: p.domain,
      p_tech_stack: p.tech_stack,
      p_apis: p.apis,
    }),
  )
}

export async function submitProposals() {
  check(await supabase.rpc('submit_proposals'))
}

export async function supervisorReview(groupId: string, decision: 'endorse' | 'revision', recommendedSlot: number | null, comment: string, notes: Record<number, string>) {
  check(
    await supabase.rpc('supervisor_review_proposals', {
      p_group_id: groupId,
      p_decision: decision,
      p_recommended_slot: recommendedSlot,
      p_comment: comment,
      p_notes: notes,
    }),
  )
}

export async function coordinatorDecide(groupId: string, decision: 'approve' | 'revision', proposalId: string | null, comment: string) {
  check(
    await supabase.rpc('coordinator_decide_proposals', {
      p_group_id: groupId,
      p_decision: decision,
      p_proposal_id: proposalId,
      p_comment: comment,
    }),
  )
}

// Same rule as proposal_complete() in the database.
export const MIN = { title: 5, objectives: 10, outcomes: 10, apis: 2 }
/** The abstract must be one paragraph of 200–250 words. */
export const ABSTRACT_WORDS = { min: 200, max: 250 }
export const wordCount = (t: string | undefined) => ((t ?? '').trim() ? (t ?? '').trim().split(/\s+/).length : 0)
export function missingFields(p: Partial<ProposalDraft> | undefined): string[] {
  const m: string[] = []
  if (!p || (p.title ?? '').trim().length < MIN.title) m.push('title')
  const words = wordCount(p?.summary)
  if (words < ABSTRACT_WORDS.min || words > ABSTRACT_WORDS.max) m.push('abstract (200–250 words)')
  if (!p || (p.objectives ?? '').trim().length < MIN.objectives) m.push('objectives')
  if (!p || (p.outcomes ?? '').trim().length < MIN.outcomes) m.push('outcomes')
  if (!p?.project_type) m.push('project type')
  if (!p?.domain) m.push('domain')
  if (!p || (p.apis ?? '').trim().length < MIN.apis) m.push('APIs used')
  return m
}

export const editableStatuses: ProposalStatus[] = ['not_started', 'draft', 'revision_requested']
