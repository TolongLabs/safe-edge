import type { EvidenceRef, Pose } from '@safe-edge/contracts'
import { createSafeEdgeClient, SafeEdgeDeniedError } from '@safe-edge/sdk'
import { useSyncExternalStore } from 'react'
import { base64 } from './base64'
import { client, onReset } from '../../store'
import { type DamageReportInput, itemStatusMapping, classMapping } from './report-metadata'

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type ImageType = (typeof IMAGE_TYPES)[number]

/** A photo taken on this phone, kept in IndexedDB until core has recorded it. */
export type Queued = {
  id?: number
  userId: string
  userName: string
  segmentId: string
  viewpointId: string
  capturedAt: string
  pose: Pose
  sharpness: number
  mediaType: ImageType
  bytes: ArrayBuffer
  simulated: boolean
  observationId?: string
  source?: 'camera' | 'upload'
  report?: DamageReportInput
}

export type Sent = {
  observationId: string
  at: string
  by: string
  thumb: string
  local: boolean
  sharpness: number
  captureSource: 'drone' | 'phone'
  capturedAt?: string
  source?: 'camera' | 'upload'
}

/** A reason without a trailing full stop, so callers can put it after a colon. */
export function explain(e: unknown): string {
  const text =
    e instanceof SafeEdgeDeniedError
      ? `Core refused this (${e.rule}): ${e.message}`
      : e instanceof TypeError // fetch rejects with a TypeError when the server cannot be reached
        ? 'The phone could not reach the server'
        : e instanceof Error
          ? e.message
          : String(e)
  return text.replace(/\.$/, '')
}

// Plain IndexedDB, no library: `queue` holds the photos waiting to upload, `photos` the ones kept on this phone
// (demo mode has no evidence store in core, so the photo itself stays here).
const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('safeEdgeCapture', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      req.result.createObjectStore('photos')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

async function tx<T>(store: 'queue' | 'photos', mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(store, mode).objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).finally(() => db.close())
}

type Snapshot = { waiting: Queued[]; sent: Record<string, Sent> }
let snap: Snapshot = { waiting: [], sent: {} }
const listeners = new Set<() => void>()
const publish = (next: Snapshot) => {
  snap = next
  listeners.forEach((l) => l())
}
/** Sent keys are `<segmentId>/<viewpointId>`; they live in the page, because core has no list of observations. */
export const sentKey = (segmentId: string, viewpointId: string) => `${segmentId}/${viewpointId}`

export const useCapture = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => snap
  )

export async function loadQueue() {
  const waiting = await tx<Queued[]>('queue', 'readonly', (s) => s.getAll())
  publish({ ...snap, waiting })
}

// A demo reset makes every queued photo point at a record that no longer exists.
onReset(() => {
  for (const s of Object.values(snap.sent)) URL.revokeObjectURL(s.thumb)
  void Promise.all([tx('queue', 'readwrite', (s) => s.clear()), tx('photos', 'readwrite', (s) => s.clear())]).then(() =>
    publish({ waiting: [], sent: {} })
  )
})

const env = import.meta.env
/** Set both (the API URL ends in `/v1`) to send photos to a running API (`uploadEvidence`, then `recordObservation`) instead of keeping them here. */
const api =
  env.VITE_SAFE_EDGE_API && env.VITE_SAFE_EDGE_TOKEN
    ? { baseUrl: env.VITE_SAFE_EDGE_API, token: env.VITE_SAFE_EDGE_TOKEN }
    : null
export const sendsToApi = api !== null
const http = api ? createSafeEdgeClient({ transport: 'http', ...api }) : null

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

async function record(item: Queued): Promise<Sent> {
  let image: EvidenceRef
  if (http) {
    image = await http.uploadEvidence({
      body: { mediaType: item.mediaType, dataBase64: base64(item.bytes), capturedAt: item.capturedAt, simulated: false }
    })
  } else {
    const id = `evd_local_${crypto.randomUUID().replaceAll('-', '')}`
    await tx('photos', 'readwrite', (s) => s.put(item.bytes, id))
    image = {
      id,
      mediaType: item.mediaType,
      uri: `local://${id}`,
      // crypto.subtle exists only on a secure page; the hash is optional
      sha256: crypto.subtle ? hex(await crypto.subtle.digest('SHA-256', item.bytes)) : null,
      capturedAt: item.capturedAt,
      simulated: false,
      source: 'user'
    }
  }
  const body = {
    patrolId: null,
    segmentId: item.segmentId,
    viewpointId: item.viewpointId,
    captureSource: 'phone' as const,
    image,
    pose: item.pose,
    capturedAt: item.capturedAt,
    // core needs a number from 0 to 1 and the phone cannot measure occlusion
    quality: { sharpness: item.sharpness, alignmentResidualPx: null, occlusion: 0 },
    privacyAction: 'none' as const,
    simulated: item.simulated
  }
  const who = http ?? client()
  if (!http && client().actor.id !== item.userId)
    throw new Error('Sign in as the person who took this photo before sending it')
  const observation = await who.recordObservation({ body })
  return {
    observationId: observation.id,
    at: new Date().toISOString(),
    by: item.userName,
    thumb: URL.createObjectURL(new Blob([item.bytes], { type: item.mediaType })),
    local: !http,
    sharpness: item.sharpness,
    captureSource: observation.captureSource,
    capturedAt: item.capturedAt,
    source: item.source
  }
}

const markSent = (item: Queued, sent: Sent) =>
  publish({ ...snap, sent: { ...snap.sent, [sentKey(item.segmentId, item.viewpointId)]: sent } })

/** Takes a photo: records it now, or queues it while the browser is offline. Returns the record, or null if queued. */
export async function capture(item: Queued): Promise<Sent | null> {
  if (!navigator.onLine) {
    const id = await tx<number>('queue', 'readwrite', (s) => s.add(item) as IDBRequest<number>)
    item.id = id
    await loadQueue()
    return null
  }
  const sent = await record(item)
  markSent(item, sent)
  return sent
}

/** Updates an existing offline-queued photo with its report rather than duplicating the photo. */
export async function attachReportToQueued(queueId: number, report: DamageReportInput): Promise<void> {
  const item = await tx<Queued | undefined>('queue', 'readonly', (s) => s.get(queueId))
  if (!item) {
    throw new Error(`Queued photo #${queueId} was not found on this phone`)
  }
  item.report = report
  await tx('queue', 'readwrite', (s) => s.put(item))
  await loadQueue()
}

/** Sends rich report online using an existing observation. */
export async function sendReportOnline(params: {
  segmentId: string
  observationId: string
  simulated: boolean
  report: DamageReportInput
}): Promise<unknown> {
  const who = http ?? client()
  const body = {
    segmentId: params.segmentId,
    observationIds: [params.observationId],
    inventoryItemId: null,
    itemStatus: itemStatusMapping(params.report.issueType),
    class: classMapping(params.report.issueType),
    rationale: params.report.description.trim(),
    simulated: params.simulated,
    report: params.report
  }
  return await who.reportDamage({ body })
}

/** Queues a report for an existing observation when reporting offline. */
export async function queueReportForObservation(params: {
  userId: string
  userName: string
  segmentId: string
  viewpointId: string
  capturedAt: string
  pose: Pose
  simulated: boolean
  observationId: string
  report: DamageReportInput
}): Promise<number> {
  const queuedItem: Queued = {
    userId: params.userId,
    userName: params.userName,
    segmentId: params.segmentId,
    viewpointId: params.viewpointId,
    capturedAt: params.capturedAt,
    pose: params.pose,
    sharpness: 1,
    mediaType: 'image/jpeg',
    bytes: new ArrayBuffer(0),
    simulated: params.simulated,
    observationId: params.observationId,
    report: params.report
  }
  const id = await tx<number>('queue', 'readwrite', (s) => s.add(queuedItem) as IDBRequest<number>)
  queuedItem.id = id
  await loadQueue()
  return id
}

let draining: Promise<void> | null = null
/** Sends the signed-in person's queued photos in order, each once; the next one waits for the one before it. */
export function drain(userId: string) {
  return (draining ??= (async () => {
    try {
      await loadQueue()
      for (const item of snap.waiting.filter((q) => q.userId === userId)) {
        if (!navigator.onLine || (!http && client().actor.id !== userId)) return

        let observationId = item.observationId
        if (!observationId && item.bytes.byteLength > 0) {
          const sent = await record(item)
          observationId = sent.observationId
          item.observationId = observationId
          markSent(item, sent)
          // If a report is attached, persist the observationId so retry does not duplicate observation
          if (item.report && item.id) {
            await tx('queue', 'readwrite', (s) => s.put(item))
          }
        }

        if (item.report) {
          if (!observationId) {
            throw new Error('Cannot send reportDamage: observation was not recorded')
          }
          const who = http ?? client()
          const body = {
            segmentId: item.segmentId,
            observationIds: [observationId],
            inventoryItemId: null,
            itemStatus: itemStatusMapping(item.report.issueType),
            class: classMapping(item.report.issueType),
            rationale: item.report.description.trim(),
            simulated: item.simulated,
            report: item.report
          }
          await who.reportDamage({ body })
        }

        // Marks completed only after both observation and reportDamage succeed
        await tx('queue', 'readwrite', (s) => s.delete(item.id!))
        await loadQueue()
      }
    } finally {
      draining = null
    }
  })())
}
