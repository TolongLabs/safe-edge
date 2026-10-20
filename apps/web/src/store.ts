import type { CandidateEvidence, EdgePass, Finding, Task, User, WorkOrder } from '@safe-edge/contracts'
import { createSafeEdgeClient } from '@safe-edge/sdk'
import { useSyncExternalStore } from 'react'
import { raiseSampleCandidates, type SampleMeta } from './sample'

/** The demo core running in the page, acting as the park manager (Farah Hashim). */
export const demo = createSafeEdgeClient({ transport: 'memory', userId: 'usr_manager' })

export type Snapshot = {
  users: User[]
  evidence: CandidateEvidence[]
  findings: Finding[]
  tasks: Task[]
  workOrders: WorkOrder[]
  passes: EdgePass[]
  metas: Record<string, SampleMeta>
}

export type Presenter = { demo: typeof demo; refresh: () => Promise<void> }
declare global {
  interface Window {
    /** The presenter and test handle: lets steps whose screens do not exist yet (Fix Lens #81, the crew) be made as
     * those people through the demo core, which still refuses what their role may not do (agents cannot decide). */
    safeEdgeDemo: Presenter
  }
}

type State = { snapshot: Snapshot | null; error: Error | null }
let state: State = { snapshot: null, error: null }
let metas: Record<string, SampleMeta> = {}
const listeners = new Set<() => void>()
const set = (next: State) => {
  state = next
  listeners.forEach((l) => l())
}
const fail = (error: unknown) => set({ ...state, error: error instanceof Error ? error : new Error(String(error)) })

// Only the newest refresh may publish; a slower, older one (for example from before a reset) is dropped.
let latest = 0

/** Reads everything the Inbox shows from core. Call after any change, including another user's. */
export async function refresh() {
  const mine = ++latest
  const [users, candidates, findings, tasks, workOrders, passes] = await Promise.all([
    demo.listUsers(),
    demo.listCandidates(),
    demo.listFindings(),
    demo.listTasks(),
    demo.listWorkOrders(),
    demo.listPasses()
  ])
  const evidence = await Promise.all(candidates.map((c) => demo.getCandidate({ params: { id: c.id } })))
  if (mine !== latest) return
  set({ snapshot: { users, evidence, findings, tasks, workOrders, passes, metas }, error: null })
}

// Core's events fire while the sample cards are being raised; only redraw once their display extras are known.
let ready = false

async function load() {
  metas = await raiseSampleCandidates(demo)
  ready = true
  await refresh()
}

let started: Promise<void> | null = null
/** Loads once, even when React runs an effect twice. A failed load is shown and can be retried. */
export const start = () =>
  (started ??= load().catch((error) => {
    started = null
    fail(error)
    throw error
  }))

/** Reset demo: the seed again, then the same four sample cards. */
export async function resetAll() {
  ready = false
  await demo.resetDemo()
  await load()
}

export const useStore = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state
  )

demo.subscribe(() => {
  if (ready) refresh().catch(fail)
})

window.safeEdgeDemo = { demo, refresh }
