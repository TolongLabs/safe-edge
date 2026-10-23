import type { EvidenceRef } from '@safe-edge/contracts'
import { createSafeEdgeClient } from '@safe-edge/sdk'
import { base64 } from './base64'
import type { Shot } from './Camera'

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('safeEdgeCapture', 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('queue')) {
        req.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
      if (!req.result.objectStoreNames.contains('photos')) {
        req.result.createObjectStore('photos')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

async function tx<T>(store: 'photos', mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(store, mode).objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).finally(() => db.close())
}

const env = import.meta.env
const api =
  env.VITE_SAFE_EDGE_API && env.VITE_SAFE_EDGE_TOKEN
    ? { baseUrl: env.VITE_SAFE_EDGE_API, token: env.VITE_SAFE_EDGE_TOKEN }
    : null
const http = api ? createSafeEdgeClient({ transport: 'http', ...api }) : null

const randomId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replaceAll('-', '')
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export async function savePhotoEvidence(shot: Shot): Promise<EvidenceRef> {
  const bytes = await shot.blob.arrayBuffer()
  const mediaType: 'image/jpeg' | 'image/png' | 'image/webp' =
    shot.blob.type === 'image/png' || shot.blob.type === 'image/webp' ? shot.blob.type : 'image/jpeg'
  const capturedAt = shot.capturedAt ?? (shot.originalDate ? shot.originalDate.toISOString() : new Date().toISOString())

  if (http) {
    return await http.uploadEvidence({
      body: {
        mediaType,
        dataBase64: base64(bytes),
        capturedAt,
        simulated: false
      }
    })
  }

  const id = `evd_local_${randomId()}`
  await tx('photos', 'readwrite', (s) => s.put(bytes, id))
  let sha256: string | null = null
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      sha256 = hex(await crypto.subtle.digest('SHA-256', bytes))
    } catch {
      sha256 = null
    }
  }
  return {
    id,
    mediaType,
    uri: `local://${id}`,
    sha256,
    capturedAt,
    simulated: false,
    source: 'user'
  }
}
