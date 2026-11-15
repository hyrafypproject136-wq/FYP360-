import type { AuditEntry } from '../lib/adminApi'
import type { AdminData } from './AdminData'

type Row = Record<string, unknown> | undefined

const groupCode = (d: AdminData, id: unknown) => (id ? d.groups.find((g) => g.id === id)?.code ?? 'a group' : null)
const person = (d: AdminData, id: unknown) => (id ? d.profiles.find((p) => p.id === id)?.display_name ?? 'someone' : null)

/** Plain-English sentence for one audit log entry. */
export function describeAudit(d: AdminData, e: AuditEntry): string {
  const oldRow = e.details?.old as Row
  const newRow = e.details?.new as Row
  const name = (newRow?.full_name ?? oldRow?.full_name) as string | undefined
  const code = (newRow?.code ?? oldRow?.code) as string | undefined

  switch (e.action) {
    case 'groups.insert':
      return `Created group ${code}`
    case 'groups.delete':
      return `Deleted group ${code}`
    case 'groups.update': {
      if (!oldRow || !newRow) return `Updated group ${code}`
      if (oldRow.status !== newRow.status) {
        if (newRow.status === 'disqualified') return `Disqualified ${code}${newRow.status_reason ? `: ${newRow.status_reason}` : ''}`
        if (newRow.status === 'dissolved') return `Dissolved ${code}${newRow.status_reason ? `: ${newRow.status_reason}` : ''}`
        return `Reinstated ${code}`
      }
      if (oldRow.supervisor_id !== newRow.supervisor_id)
        return newRow.supervisor_id ? `Assigned ${person(d, newRow.supervisor_id)} as supervisor of ${code}` : `Removed the supervisor of ${code}`
      if (oldRow.account_id !== newRow.account_id) return newRow.account_id ? `Linked a login to ${code}` : `Removed the login of ${code}`
      if (oldRow.proposal_status !== newRow.proposal_status) return `Proposals of ${code} are now: ${String(newRow.proposal_status).replace(/_/g, ' ')}`
      if (oldRow.max_members !== newRow.max_members) return `Changed the member limit of ${code} from ${oldRow.max_members} to ${newRow.max_members}`
      return `Edited details of ${code}`
    }
    case 'group_members.insert':
      return newRow?.group_id ? `Added ${name} to ${groupCode(d, newRow.group_id)}` : `Added student ${name}`
    case 'group_members.delete':
      return `Deleted student ${name}`
    case 'group_members.update': {
      if (!oldRow || !newRow) return `Updated student ${name}`
      if (oldRow.group_id !== newRow.group_id) {
        if (!newRow.group_id) return `Removed ${name} from ${groupCode(d, oldRow.group_id)}`
        if (!oldRow.group_id) return `Placed ${name} in ${groupCode(d, newRow.group_id)}`
        return `Moved ${name} from ${groupCode(d, oldRow.group_id)} to ${groupCode(d, newRow.group_id)}`
      }
      if (!oldRow.is_lead && newRow.is_lead) return `Made ${name} lead of ${groupCode(d, newRow.group_id)}`
      if (oldRow.is_lead && !newRow.is_lead) return `${name} is no longer the lead`
      return `Edited details of ${name}`
    }
    case 'group_jury.insert':
      return `Added ${person(d, newRow?.jury_id)} to the jury of ${groupCode(d, newRow?.group_id)}`
    case 'group_jury.delete':
      return `Removed ${person(d, oldRow?.jury_id)} from the jury of ${groupCode(d, oldRow?.group_id)}`
    case 'account.create':
      return `Created login "${e.details?.username ?? e.target}"${e.details?.role ? ` (${e.details.role})` : ''}`
    case 'account.reset_password':
      return `Reset the password of "${e.target}"`
    case 'marks.session_saved':
      return `${person(d, e.actor_id) ?? 'Supervisor'} ${e.details?.new ? 'recorded' : 'updated'} a meeting of ${e.target}${e.details?.held_on ? ` (${e.details.held_on})` : ''}`
    case 'marks.session_deleted':
      return `${person(d, e.actor_id) ?? 'Someone'} deleted a meeting of ${e.target}${e.details?.held_on ? ` (${e.details.held_on})` : ''}`
    case 'marks.evaluation_saved':
      return `${person(d, e.actor_id) ?? 'Jury'} entered ${e.details?.component === 'proposal' ? 'proposal defence' : 'internal evaluation'} marks for ${e.target}`
    case 'marks.published':
      return `Published ${e.target} results to all groups`
    case 'marks.unpublished':
      return `Unpublished ${e.target} results`
    case 'attendance.over_limit':
      return `${e.details?.name ?? 'A student'} of ${e.target} has missed ${e.details?.absences ?? 'too many'} meetings`
    case 'attendance.group_absent':
      return `The whole of ${e.target} was absent from a meeting${e.details?.held_on ? ` (${e.details.held_on})` : ''}`
    case 'declaration.signed':
      return `${person(d, e.actor_id) ?? 'Supervisor'} signed the ${String(e.details?.phase ?? '').toUpperCase().replace('FYP', 'FYP-')} declaration of ${e.target}`
    case 'declaration.withdrawn':
      return `${person(d, e.actor_id) ?? 'Supervisor'} withdrew the ${String(e.details?.phase ?? '').toUpperCase().replace('FYP', 'FYP-')} declaration of ${e.target}`
    case 'submission.uploaded':
      return `${e.target} uploaded "${e.details?.title}" (version ${e.details?.version})`
    case 'submission.approved':
      return `${person(d, e.actor_id) ?? 'Supervisor'} approved "${e.details?.title}" of ${e.target}`
    case 'submission.changes':
      return `${person(d, e.actor_id) ?? 'Supervisor'} asked ${e.target} for changes to "${e.details?.title}"`
    case 'change.requested':
      return `${e.target} asked for a change: "${e.details?.title}"`
    case 'change.jury_approved':
      return `${person(d, e.actor_id) ?? 'Jury'} approved the change "${e.details?.title}" of ${e.target}`
    case 'change.approved':
      return `Approved the change "${e.details?.title}" of ${e.target}`
    case 'change.rejected':
      return `${person(d, e.actor_id) ?? 'Someone'} rejected the change "${e.details?.title}" of ${e.target}`
    case 'announcement.posted':
      return `Posted an announcement: "${e.target}"`
    case 'deliverables.insert':
      return `Added deliverable "${(e.details?.new as Row)?.title}"`
    case 'deliverables.update':
      return `Updated deliverable "${(e.details?.new as Row)?.title}"`
    case 'deliverables.delete':
      return `Deleted deliverable "${(e.details?.old as Row)?.title}"`
    case 'deliverable_extensions.insert':
    case 'deliverable_extensions.update':
      return `Extended a deadline for ${groupCode(d, (e.details?.new as Row)?.group_id)}`
    case 'deliverable_extensions.delete':
      return `Removed a deadline extension for ${groupCode(d, (e.details?.old as Row)?.group_id)}`
    case 'proposal.submitted':
      return `${e.target} sent three proposals to their supervisor`
    case 'proposal.endorsed':
      return `Supervisor recommended a proposal of ${e.target}`
    case 'proposal.revision_requested':
      return `Changes requested on proposals of ${e.target}${e.details?.comment ? `: ${e.details.comment}` : ''}`
    case 'proposal.approved':
      return `Approved the official project of ${e.target}`
    case 'account.delete':
      return `Deleted login "${e.target}"`
    default:
      return `${e.action} ${e.target ?? ''}`.trim()
  }
}
