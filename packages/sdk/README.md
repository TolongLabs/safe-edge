# @safe-edge/sdk

One typed client for the screens, the scene and the scenario player. It has one method per operationId in the contracts' operations table (`packages/contracts/src/operations.ts`), so inputs and results are typed from the contract. The `memory` transport runs `@safe-edge/core` in the page on the labelled Elmina seed; the `http` transport calls the v1 API.

Contents:

1.  [Demo mode: the memory transport](#demo-mode-the-memory-transport)
1.  [Calling operations](#calling-operations)
1.  [Events and Reset demo](#events-and-reset-demo)
1.  [Patrol plans in demo mode](#patrol-plans-in-demo-mode)
1.  [The http transport](#the-http-transport)
1.  [Streams over HTTP: Ask and events](#streams-over-http-ask-and-events)
1.  [Errors](#errors)

## Demo mode: the memory transport

```ts
import { createSafeEdgeClient, elminaSeed } from '@safe-edge/sdk'

const demo = createSafeEdgeClient({ transport: 'memory', userId: 'usr_manager' })
const installer = demo.as('usr_installer') // same demo, another seeded user
```

- Demo users are the seeded `usr_<role>` users: `usr_manager`, `usr_engineer`, `usr_reviewer`, `usr_installer`, `usr_pilot`, `usr_gm`, `usr_crew`, `usr_integrator`, `usr_agent`, `usr_system` and `usr_drone_sim` (the simulated drone provider). `demo.listUsers()` returns them with names for a role switcher.
- Every seeded record carries `simulated: true` and `source: 'fixture'`, and keeps them after the story changes it. Show the label on screen.
- Pass a `clock` (`{ now(): string }`, ISO 8601 UTC) to drive time from the scenario player; without one the wall clock is used. With the same clock steps, IDs, timestamps and audit hashes repeat exactly.
- `elminaSeed.story.s1` names S1's segment, viewpoint and fence panel.

## Calling operations

Each method takes the operation's `{ params?, query?, body? }` and resolves to its response:

```ts
const segments = await demo.listSegments()
const s1 = await demo.getSegment({ params: { id: elminaSeed.story.s1.segmentId } })
const open = await demo.listFindings({ query: { status: 'open' } })
const decision = await demo.decideCandidate({
  params: { id: 'cand_1' },
  body: { decision: 'confirm', severity: 'high' }
})
```

`SafeEdgeClient` is the type both transports share (every core operation), so a screen written against it runs in demo mode and against the API. `packages/sdk/test/story.ts` plays S1 to S3 this way as the demo users.

## Events and Reset demo

```ts
const unsubscribe = demo.subscribe((event) => {
  // CloudEvents from core, e.g. edge.pass.suspended.v1 with subject segments/<id>
})

await demo.resetDemo() // the seed again, an empty audit chain, ID counters from 1
await demo.tick('2026-11-01T02:00:00.000Z') // passes move to expiring and expired on the scenario clock
```

- `subscribe` hears every event core emits in this demo, whichever user acted. Over HTTP, read `GET /v1/events` with `streamEvents` instead (see [Streams over HTTP](#streams-over-http-ask-and-events)).
- `resetDemo` restores the seed for every client made with `as`, and subscribers stay subscribed. It emits no event, so refetch what the screen shows after calling it. The agent user cannot reset.
- `tick(now)` runs core's time-driven pass moves (S4's expiring passes): valid to expiring 30 days before `validTo`, then to expired. The system acts, whichever user the client is, so a tick never makes a pass valid. Subscribers get the `edge.pass.expiring.v1` and `edge.pass.expired.v1` events, and `tick` returns them. It is memory-only: the HTTP API exposes no tick.

## Patrol plans in demo mode

`createPatrolPlan` needs a planner. Build the Elmina one and pass it in:

```ts
import { createElminaPlanner, createSafeEdgeClient } from '@safe-edge/sdk'

// Paths are repo-relative (`elminaLayerPaths` in @safe-edge/planner); serve those GeoJSON files from the app.
// Third parties are what plans keep 50 m from, such as S1's people on the path (`ThirdParty` in @safe-edge/planner).
const planner = await createElminaPlanner((path) => fetch(`/${path}`).then((r) => r.json()), { thirdParties: [] })
const demo = createSafeEdgeClient({ transport: 'memory', userId: 'usr_manager', planner })
```

Without a planner, `createPatrolPlan` throws.

## The http transport

```ts
const api = createSafeEdgeClient({ transport: 'http', baseUrl: 'http://localhost:3000/v1', token })
await api.uploadEvidence({ body: { mediaType: 'image/jpeg', dataBase64, capturedAt: null } })
```

- Every request sends `Authorization: Bearer <token>`; the API maps the token to a user.
- Every write sends a fresh `Idempotency-Key`. To retry a write safely, pass your own and reuse it: `api.draftNotice(input, { idempotencyKey })`.
- The http client also has the HTTP-only operations (`uploadEvidence`, `getEvidenceUrl`, `triageImages`, `registerWebhook`, `setScenarioClock`, and the agent's `draftInbox` and `draftMonthlyReport`) and lacks `resetDemo`. Responses are checked against the contract.
- To replay a scenario against a dev API started with `SAFE_EDGE_CLOCK=scenario`, set its clock to each event's time as the system user before the event: `system.setScenarioClock({ body: { now: event.at } })`. Records then carry the scenario's times, as they do with the memory transport's `clock`. An API on the wall clock, as production always is, answers 501.

## Streams over HTTP: Ask and events

The two streamed operations are http-client methods too. Each resolves once the API has accepted the request, so a refusal or bad input throws there as a typed error, and then yields parsed events:

```ts
const hangUp = new AbortController()
const reply = await api.askAgent({ body: { question: 'Which passes expire in 30 days?' } }, { signal: hangUp.signal })
for await (const part of reply) {
  if (part.event === 'delta')
    append(part.data.text) // text as the agent writes it
  else if (part.event === 'answer')
    show(part.data) // AgentAnswer: replaces the deltas, with citations and model
  else showStopped(part.data) // AgentStopped: Claude refused or could not finish
}

const events = await api.streamEvents() // subscribed now: act after this
for await (const event of events) handle(event) // EdgeEvent CloudEvents, as subscribe gives them
```

- `askAgent` ends after one `answer` or one `stopped`. An `error` event (the run failed on the server) throws.
- To hang up, abort `signal` or leave the `for await` loop early. Hanging up on `askAgent` cancels the agent's Claude run on the server, so close the stream when the Ask panel closes.
- `streamEvents` never ends on its own: abort its `signal` or leave the loop when the screen goes away. It has no replay, so events emitted before it resolved are not sent.

## Errors

Both transports throw the same typed errors:

```ts
import { SafeEdgeApiError, SafeEdgeDeniedError } from '@safe-edge/sdk'

try {
  await demo.as('usr_agent').submitWorkOrder({ params: { id }, body })
} catch (error) {
  if (error instanceof SafeEdgeDeniedError)
    error.rule // 'agents_draft_only'; show it, it is on the audit chain
  else throw error
}
```

- `SafeEdgeDeniedError`: a 403. `rule` is the `PolicyRule` that refused it (`role_forbidden`, `two_person_rule`, `one_way_rule` and so on).
- `SafeEdgeApiError`: `status` and `error` for `invalid_input` (400), `unauthenticated` (401), `not_found` (404) and the API's other contract errors.
