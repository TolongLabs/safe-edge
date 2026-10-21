import type { EvidenceRef, Pose } from '@safe-edge/contracts'
import { createSafeEdgeClient, SafeEdgeDeniedError } from '@safe-edge/sdk'
import { useSyncExternalStore } from 'react'
import { base64 } from './base64'
import { client, onReset } from '../../store'

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
}

export type Sent = {
  observationId: string
  at: string
  by: string
  thumb: string
  local: boolean
  sharpness: number
  captureSource: 'drone' | 'phone'
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
  const observation = await who.recordObservation({ body })
  return {
    observationId: observation.id,
    at: new Date().toISOString(),
    by: item.userName,
    thumb: URL.createObjectURL(new Blob([item.bytes], { type: item.mediaType })),
    local: !http,
    sharpness: item.sharpness,
    captureSource: observation.captureSource
  }
}

const markSent = (item: Queued, sent: Sent) =>
  publish({ ...snap, sent: { ...snap.sent, [sentKey(item.segmentId, item.viewpointId)]: sent } })

/** Takes a photo: records it now, or queues it while the browser is offline. Returns the record, or null if queued. */
export async function capture(item: Queued): Promise<Sent | null> {
  if (!navigator.onLine) {
    await tx('queue', 'readwrite', (s) => s.add(item))
    await loadQueue()
    return null
  }
  const sent = await record(item)
  markSent(item, sent)
  return sent
}

let draining: Promise<void> | null = null
/** Sends the signed-in person's queued photos in order, each once; the next one waits for the one before it. */
export function drain(userId: string) {
  return (draining ??= (async () => {
    try {
      await loadQueue()
      for (const item of snap.waiting.filter((q) => q.userId === userId)) {
        if (!navigator.onLine) return
        markSent(item, await record(item))
        // shortcut: if the tab dies between recordObservation and the delete, that photo is recorded twice on the next drain; upgrade with an idempotency key when the API is the default
        await tx('queue', 'readwrite', (s) => s.delete(item.id!))
        await loadQueue()
      }
    } finally {
      draining = null
    }
  })())
}
