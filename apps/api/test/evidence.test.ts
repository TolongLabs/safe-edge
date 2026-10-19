// Evidence images are stored by the API and read back through short-lived signed URLs.
import { expect, test } from 'bun:test'
import { EvidenceRef, EvidenceUrl } from '@safe-edge/contracts'
import { startApi } from './support.ts'

// FF D8 FF E0 followed by "safe-edge"; its SHA-256 from `shasum -a 256`.
const JPEG_BASE64 = '/9j/4HNhZmUtZWRnZQ=='
const JPEG_SHA256 = '488c5fe89f0acd0bdb3f13b8c9ffe0f3472be8e276567506cf60ee290ed73787'

test('an uploaded image gets an evidence reference, and a 5-minute signed URL serves it without a token', async () => {
  const api = startApi()
  const uploaded = await api.request('post', '/evidence', {
    token: 'tok_crew',
    body: { mediaType: 'image/jpeg', dataBase64: JPEG_BASE64, capturedAt: '2026-10-19T23:58:00.000Z', simulated: false }
  })
  expect(uploaded.status).toBe(201)
  const ref = EvidenceRef.parse(await uploaded.json())
  expect(ref).toEqual({
    id: expect.stringMatching(/^evd_/),
    mediaType: 'image/jpeg',
    uri: `evidence://${ref.id}`,
    sha256: JPEG_SHA256,
    capturedAt: '2026-10-19T23:58:00.000Z',
    simulated: false,
    source: 'user'
  })

  // The agent may read evidence (inspection.read).
  const link = await api.request('get', `/evidence/${ref.id}/url`, { token: 'tok_agent' })
  expect(link.status).toBe(200)
  const { url, expiresAt } = EvidenceUrl.parse(await link.json())
  expect(expiresAt).toBe('2026-10-20T00:05:00.000Z')

  const image = await fetch(url)
  expect(image.status).toBe(200)
  expect(image.headers.get('content-type')).toBe('image/jpeg')
  expect(new Uint8Array(await image.arrayBuffer())).toEqual(Uint8Array.from(atob(JPEG_BASE64), (c) => c.charCodeAt(0)))

  const forged = new URL(url)
  forged.searchParams.set('expires', '2027-01-01T00:00:00.000Z')
  expect((await fetch(forged)).status).toBe(401)
  api.setNow('2026-10-20T00:05:00.000Z')
  expect((await fetch(url)).status).toBe(401)

  const missing = await api.request('get', '/evidence/evd_404/url', { token: 'tok_manager' })
  expect(missing.status).toBe(404)
  expect(await missing.json()).toEqual({ ok: false, error: 'not_found', message: 'No evidence evd_404' })
})
