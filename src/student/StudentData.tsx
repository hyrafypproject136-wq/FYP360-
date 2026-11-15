/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { errorMessage } from '../lib/supabase'
import { loadProposals, type Proposal, type ProposalEvent } from '../lib/proposalsApi'
import { loadMyGroup } from '../pages/portal/portalApi'
import { loadSettings, type Settings } from '../lib/adminApi'
import { loadMyRecord, type MyRecord } from '../lib/marksApi'
import { loadWorkflow, type WorkflowData } from '../lib/workflowApi'
import { useToast } from '../components/Toast'

type GroupData = Awaited<ReturnType<typeof loadMyGroup>>
export interface StudentData extends GroupData {
  proposals: Proposal[]
  events: ProposalEvent[]
  record: MyRecord
  settings: Settings
  work: WorkflowData
}

interface StudentValue {
  data: StudentData | null
  error: string | null
  reload: () => Promise<void>
  toast: (m: string) => void
}

const Ctx = createContext<StudentValue | undefined>(undefined)

export function StudentDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const toast = useToast()
  const [data, setData] = useState<StudentData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user?.groupId) return
    try {
      const [g, p, record, settings, work] = await Promise.all([loadMyGroup(user.groupId), loadProposals(user.groupId), loadMyRecord(user.groupId), loadSettings(), loadWorkflow()])
      setData({ ...g, ...p, record, settings, work })
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [user?.groupId])

  useEffect(() => {
    reload()
  }, [reload])

  return <Ctx.Provider value={{ data, error, reload, toast }}>{children}</Ctx.Provider>
}

export function useStudent() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStudent outside provider')
  return v
}

/** For pages rendered by StudentLayout after data loaded. */
export function useStudentData() {
  const v = useStudent()
  if (!v.data) throw new Error('Student data not loaded')
  return v as StudentValue & { data: StudentData }
}
