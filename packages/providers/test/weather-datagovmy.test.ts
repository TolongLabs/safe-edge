import { describe, expect, test } from 'bun:test'
import { createDataGovMyClient } from '../src/index.ts'

/** A clock that only moves when the client waits, and a fetch that records when each request went out. */
function harness(respond: (url: string) => Response = () => Response.json([])) {
  let now = Date.parse('2026-10-19T06:00:00.000Z')
  const requests: { url: string; at: number }[] = []
  const client = createDataGovMyClient({
    fetch: async (url) => {
      requests.push({ url, at: now })
      return respond(url)
    },
    clock: {
      now: () => now,
      sleep: async (ms) => {
        now += ms
      }
    }
  })
  return { client, requests, start: now }
}

describe('DATA-2: the data.gov.my weather client', () => {
  test('sends at most 4 requests in any minute, queueing the rest, to the trailing-slash URLs', async () => {
    const { client, requests, start } = harness()
    await Promise.all([
      ...Array.from({ length: 5 }, () => client.forecast('Petaling')),
      ...Array.from({ length: 4 }, () => client.warnings())
    ])

    expect(requests.map((r) => (r.at - start) / 1000)).toEqual([0, 0, 0, 0, 60, 60, 60, 60, 120])
    for (const r of requests) {
      expect(requests.filter((o) => o.at <= r.at && r.at - o.at < 60_000).length).toBeLessThanOrEqual(4)
    }
    // The slash-less paths answer 301; going straight to the slash form spends no request on the redirect.
    expect(requests[0]!.url).toBe('https://api.data.gov.my/weather/forecast/?filter=Petaling@location__location_name')
    expect(requests[8]!.url).toBe('https://api.data.gov.my/weather/warning/')
  })

  test('fails loudly on a refused request, and the queue keeps going', async () => {
    let refuse = true
    const { client, requests } = harness(() =>
      refuse ? new Response('Too Many Requests', { status: 429 }) : Response.json([])
    )
    await expect(client.warnings()).rejects.toThrow(
      'https://api.data.gov.my/weather/warning/ answered 429: Too Many Requests'
    )
    refuse = false
    expect((await client.warnings()).rows).toEqual([])
    expect(requests).toHaveLength(2)
  })
})
