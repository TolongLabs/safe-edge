import type { Actor, EvidenceRef, EvidenceUrl, UploadEvidenceRequest } from '@safe-edge/contracts'
import type { Clock, IdGenerator } from '@safe-edge/core'
import { timingSafeEqual } from 'node:crypto'

const URL_TTL_MS = 5 * 60_000

/**
 * Uploaded evidence, in memory like the core. A short-lived URL is signed with a per-process key, so it needs no
 * bearer token and dies with the process or after five minutes.
 */
export function createEvidenceStore({ clock, ids }: { clock: Clock; ids: IdGenerator }) {
  const key = crypto.getRandomValues(new Uint8Array(32))
  const files = new Map<string, { ref: EvidenceRef; bytes: Uint8Array<ArrayBuffer> }>()
  const sign = (id: string, expires: string) =>
    new Bun.CryptoHasher('sha256', key).update(`${id}\n${expires}`).digest('hex')

  return {
    put(upload: UploadEvidenceRequest, actor: Actor): EvidenceRef {
      const bytes = new Uint8Array(Buffer.from(upload.dataBase64, 'base64'))
      const id = ids.next('evd')
      const ref: EvidenceRef = {
        id,
        mediaType: upload.mediaType,
        uri: `evidence://${id}`,
        sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
        capturedAt: upload.capturedAt,
        simulated: upload.simulated,
        source: actor.type
      }
      files.set(id, { ref, bytes })
      return ref
    },

    /** A URL for `GET /v1/evidence/{id}/content`, or undefined when there is no such evidence. */
    url(id: string, origin: string): EvidenceUrl | undefined {
      if (!files.has(id)) return undefined
      const expiresAt = new Date(Date.parse(clock.now()) + URL_TTL_MS).toISOString()
      const url = new URL(`/v1/evidence/${id}/content`, origin)
      url.searchParams.set('expires', expiresAt)
      url.searchParams.set('signature', sign(id, expiresAt))
      return { url: url.href, expiresAt }
    },

    /** The uploaded image behind an evidence reference, for the server's own use. Fixture paths are not stored here. */
    bytes(ref: EvidenceRef): Uint8Array<ArrayBuffer> {
      const file = files.get(ref.id)
      if (file === undefined || ref.uri !== `evidence://${ref.id}`) {
        throw new Error(`No uploaded evidence at ${ref.uri}`)
      }
      return file.bytes
    },

    /** The stored image, when the signature matches and the URL has not expired. */
    read(id: string, expires: string, signature: string) {
      const expected = Buffer.from(sign(id, expires))
      const given = Buffer.from(signature)
      const valid = given.length === expected.length && timingSafeEqual(given, expected)
      if (!valid || Date.parse(clock.now()) >= Date.parse(expires)) return undefined
      return files.get(id)
    }
  }
}
