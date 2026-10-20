import {
  operations,
  type CandidateEvidence,
  type EdgePass,
  type Finding,
  type OperationId,
  type Role,
  type Task,
  type User,
  type WorkOrder
} from '@safe-edge/contracts'
import { createSafeEdgeClient } from '@safe-edge/sdk'
import { useSyncExternalStore } from 'react'
import { raiseSampleCandidates, type SampleMeta } from './sample'

/** The demo core running in the page, acting as the park manager (Farah Hashim). Screens act through `client()`. */
export const demo = createSafeEdgeClient({ transport: 'memory', userId: 'usr_manager' })

const MANAGER = 'usr_manager'
const KEY = 'safeEdge.signedIn'
const stored = () => {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null // storage blocked: the person is not remembered across a reload
  }
}
// `signedId` is the person the page shows and acts as; it changes only together with the snapshot read for them.
// `target` is the person the next read is for (a sign-in in progress).
let signedId = stored() ?? MANAGER
let target = signedId
const remember = (id: string) => {
  try {
    sessionStorage.setItem(KEY, id)
  } catch {
    // see stored()
  }
}

/** The SDK client acting as the signed-in person. */
export const client = () => demo.as(signedId)

/** Whether the signed-in role may call the operation, read from the contracts' own role list. */
const rolesOf = (id: OperationId): readonly Role[] | 'any' => operations[id].roles

export function can(id: OperationId): boolean {
  const roles = rolesOf(id)
  if (roles === 'any') return true
  const me = state.snapshot?.users.find((u) => u.id === signedId)
  if (!me) throw new Error(`Signed-in user ${signedId} is not in the seed`)
  return roles.includes(me.role)
}

export type Snapshot = {
  users: User[]
  evidence: CandidateEvidence[]
  findings: Finding[]
  tasks: Task[]
  workOrders: WorkOrder[]
  passes: EdgePass[]
  metas: Record<string, SampleMeta>
  /** Core records no one for a finished task, so the page remembers who pressed Mark done. */
  doneBy: Record<string, string>
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
const doneBy: Record<string, string> = {}
/** Remembers who marked a task done (call after core accepted it). */
export const rememberDone = (taskId: string, name: string) => void (doneBy[taskId] = name)
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
  const who = target
  const me = demo.as(who)
  const users = await demo.listUsers()
  const role = users.find((u) => u.id === who)?.role
  if (!role) throw new Error(`Signed-in user ${who} is not in the seed`)
  const allowed = rolesOf('listCandidates')
  const [candidates, findings, tasks, workOrders, passes] = await Promise.all([
    allowed === 'any' || allowed.includes(role) ? demo.listCandidates() : [],
    me.listFindings(),
    me.listTasks(),
    me.listWorkOrders(),
    me.listPasses()
  ])
  const evidence = await Promise.all(candidates.map((c) => demo.getCandidate({ params: { id: c.id } })))
  if (mine !== latest) return
  signedId = who
  remember(who)
  set({ snapshot: { users, evidence, findings, tasks, workOrders, passes, metas, doneBy: { ...doneBy } }, error: null })
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
  for (const k of Object.keys(doneBy)) delete doneBy[k]
  target = MANAGER
  await demo.resetDemo()
  await load()
  resetListeners.forEach((l) => l())
}

const resetListeners = new Set<() => void>()
/** Runs after Reset demo has reloaded the data, so a screen can drop what it kept. Returns the unsubscribe. */
export function onReset(listener: () => void) {
  resetListeners.add(listener)
  return () => void resetListeners.delete(listener)
}

/** Switch who every screen acts as; the choice survives a reload (per tab). */
export async function signIn(userId: string) {
  const before = target
  target = userId
  try {
    await refresh()
  } catch (error) {
    target = before
    throw error
  }
}

/** The signed-in person and the SDK client acting as them. Only call it once the data is loaded. */
export function useSignedIn() {
  const { snapshot } = useStore()
  const user = snapshot?.users.find((u) => u.id === signedId)
  if (!user) throw new Error(`Signed-in user ${signedId} is not loaded`)
  return { user, client: client() }
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
