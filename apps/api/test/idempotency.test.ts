// Every write accepts an Idempotency-Key (TRD "REST API"): a retry replays the first response and changes nothing.
import { expect, test } from 'bun:test'
import { AuditEvent, Notice } from '@safe-edge/contracts'
import { S1, startApi, type Token } from './support.ts'

test('a write repeated with its Idempotency-Key replays the first response; the same key with another body is 422', async () => {
  const api = startApi()
  const draft = (token: Token, title: string) =>
    api.request('post', '/notices', {
      token,
      body: { kind: 'escalation', subjectId: S1.segmentId, title, body: 'The repair is overdue' },
      headers: { 'idempotency-key': 'draft-escalation-1' }
    })

  const first = await draft('tok_manager', 'Overdue repair')
  expect(first.status).toBe(201)
  const notice = Notice.parse(await first.json())

  const retry = await draft('tok_manager', 'Overdue repair')
  expect(retry.status).toBe(201)
  expect(await retry.json()).toEqual(notice)

  const reused = await draft('tok_manager', 'A different title')
  expect(reused.status).toBe(422)
  expect(await reused.json()).toEqual({ ok: false, error: 'idempotency_conflict', message: expect.any(String) })

  // Keys belong to their caller: the general manager's identical request is a new draft.
  const other = await draft('tok_gm', 'Overdue repair')
  expect(other.status).toBe(201)
  expect(Notice.parse(await other.json()).id).not.toBe(notice.id)

  const notices = Notice.array().parse(await (await api.request('get', '/notices', { token: 'tok_manager' })).json())
  expect(notices.map((n) => n.draftedBy.id)).toEqual(['usr_manager', 'usr_gm'])
  const audit = AuditEvent.array().parse(await (await api.request('get', '/audit', { token: 'tok_manager' })).json())
  expect(audit.filter((e) => e.action === 'draftNotice').map((e) => e.actor.id)).toEqual(['usr_manager', 'usr_gm'])
})
