import type { EvidenceRef } from '@safe-edge/contracts'
import { createSafeEdgeClient } from '@safe-edge/sdk'
import { useEffect, useState } from 'react'

export type EvidencePhotoProps = {
  image?: EvidenceRef | null
  alt: string
  className?: string
}

function openSafeEdgeDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available'))
    }
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
}

async function getPhotoFromIndexedDb(key: string): Promise<ArrayBuffer | Blob | null> {
  const db = await openSafeEdgeDb()
  return new Promise<ArrayBuffer | Blob | null>((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains('photos')) {
        resolve(null)
        return
      }
      const tx = db.transaction('photos', 'readonly')
      const store = tx.objectStore('photos')
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    } catch (e) {
      reject(e)
    }
  }).finally(() => db.close())
}

export function EvidencePhoto({ image, alt, className }: EvidencePhotoProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let active = true
    let createdUrl: string | null = null

    async function resolve() {
      setLoading(true)
      setUnavailable(false)
      setResolvedUrl(null)

      if (!image || !image.uri) {
        if (active) {
          setLoading(false)
          setUnavailable(true)
        }
        return
      }

      const uri = image.uri

      // 1. Direct web or fixture path
      if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:') || uri.startsWith('/')) {
        if (active) {
          setResolvedUrl(uri)
          setLoading(false)
        }
        return
      }

      // 2. local:// URI in IndexedDB safeEdgeCapture/photos
      if (uri.startsWith('local://')) {
        try {
          const rawId = uri.replace(/^local:\/\//, '')
          // Existing queue photos store ArrayBuffer keyed by image.id
          const bytes =
            (image.id ? await getPhotoFromIndexedDb(image.id) : null) ??
            (rawId && rawId !== image.id ? await getPhotoFromIndexedDb(rawId) : null)

          if (!bytes) {
            if (active) {
              setLoading(false)
              setUnavailable(true)
            }
            return
          }

          const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: image.mediaType || 'image/jpeg' })
          createdUrl = URL.createObjectURL(blob)
          if (active) {
            setResolvedUrl(createdUrl)
            setLoading(false)
          }
        } catch {
          if (active) {
            setLoading(false)
            setUnavailable(true)
          }
        }
        return
      }

      // 3. API via SDK getEvidenceUrl if configured
      const env = import.meta.env
      const apiConfig =
        env.VITE_SAFE_EDGE_API && env.VITE_SAFE_EDGE_TOKEN
          ? { baseUrl: env.VITE_SAFE_EDGE_API, token: env.VITE_SAFE_EDGE_TOKEN }
          : null

      if (apiConfig) {
        try {
          const httpClient = createSafeEdgeClient({ transport: 'http', ...apiConfig })
          const res = await httpClient.getEvidenceUrl({ params: { id: image.id } })
          if (active && res?.url) {
            setResolvedUrl(res.url)
            setLoading(false)
            return
          }
        } catch {
          // Fall through to client check or unavailable
        }
      }

      // If unresolvable or evidence:// without configured API, show clear unavailable message
      if (active) {
        setLoading(false)
        setUnavailable(true)
      }
    }

    void resolve()

    return () => {
      active = false
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [image?.id, image?.uri, image?.mediaType])

  if (loading) {
    return (
      <div className={`evidence-photo-container ${className ?? ''}`} aria-busy="true">
        <div className="evidence-photo-loading">Loading photo…</div>
      </div>
    )
  }

  if (unavailable || !resolvedUrl) {
    return (
      <div className={`evidence-photo-container ${className ?? ''}`} role="status">
        <div className="evidence-photo-unavailable">Photo unavailable</div>
      </div>
    )
  }

  return (
    <div className={`evidence-photo-container ${className ?? ''}`}>
      <img className="evidence-photo-img" src={resolvedUrl} alt={alt} onError={() => setUnavailable(true)} />
    </div>
  )
}
