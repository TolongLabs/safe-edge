// The saved weather snapshots in data/elmina/weather/ read back as planning inputs, and drive the planner's weather
// triggers into core's re-plan subscriber the way a weather feed would.
import { describe, expect, test } from 'bun:test'
import type { EdgeEvent, PatrolPlan } from '@safe-edge/contracts'
import { actorFor, counterIds, createCore, createReplanSubscriber, type Seed } from '@safe-edge/core'
import { rainCategory, weatherTriggers } from '@safe-edge/planner'
import { createElminaPlanner } from '@safe-edge/sdk'
import { join } from 'node:path'
import {
  DataGovMySnapshot,
  ELMINA_AREA,
  JpsRainfallSnapshot,
  forecastsOf,
  jpsRainfallReading,
  warningSnapshots
} from '../src/index.ts'

const repoRoot = join(import.meta.dir, '../../..')
const readJson = (path: string) => Bun.file(join(repoRoot, path)).json()
const jps = JpsRainfallSnapshot.parse(await readJson('data/elmina/weather/jps-rainfall-27880-20261019T070234Z.json'))
const datagovmy = DataGovMySnapshot.parse(await readJson('data/elmina/weather/datagovmy-20261019T070234Z.json'))
const seed = (await readJson('data/elmina/fixtures/seed.json')) as Seed

/** A core with the Elmina planner and one proposed plan over three lake segments, plus the re-plan subscriber. */
async function openPlan(now: string) {
  const planner = await createElminaPlanner(readJson, { thirdParties: [] })
  const core = createCore({ seed, clock: { now: () => now }, ids: counterIds(), planner })
  const manager = actorFor(seed.users.find((u) => u.id === 'usr_manager')!)
  const created = core.dispatch('createPatrolPlan', manager, {
    body: {
      dockId: 'dock_elmina_roof',
      droneProfileId: 'drn_assumed',
      segmentIds: [seed.story.s1.segmentId, 'seg_866518980_5', 'seg_866518980_6'],
      context: [],
      notBefore: now,
      altitudeCapM: 60
    }
  })
  if (!created.ok) throw new Error(created.message)
  const subscriber = createReplanSubscriber({
    dispatch: core.dispatch,
    clock: { now: () => now },
    committedTasks: () => 0,
    retest: { dockId: 'dock_elmina_roof', droneProfileId: 'drn_assumed', altitudeCapM: 60 },
    onFailure: (error) => {
      throw error
    }
  })
  const plans = (events: EdgeEvent[]): PatrolPlan[] => {
    const listed = core.dispatch('listPatrolPlans', manager, {})
    if (!listed.ok) throw new Error(listed.message)
    return events.flatMap((e) =>
      e.type === 'edge.patrol.planned.v1' ? listed.data.filter((p) => p.id === e.data.planId) : []
    )
  }
  return { plan: created.data, subscriber, plans }
}

describe('DATA-2: saved weather snapshots', () => {
  test('the JPS snapshot reads as a real, timestamped rainfall reading for station 27880', () => {
    const reading = jpsRainfallReading(jps)
    // The page showed Rem KTM Sungai Buloh (F2) last updated 19/10/2026 04:00 Malaysia time, 0.0 mm in the hour.
    expect(reading).toEqual({
      kind: 'rainfall',
      value: 0,
      text: null,
      observedAt: '2026-10-18T20:00:00.000Z',
      validTo: null,
      publisher: 'JPS Public Infobanjir',
      stationId: '27880',
      url: 'https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=SEL&lang=en',
      simulated: false,
      source: 'provider'
    })
    expect(rainCategory(reading.value!)).toBe('none')
    expect(jps.licence).toContain('no reuse licence')
  })

  test('the data.gov.my snapshot reads in English, and none of its warnings is for Petaling', () => {
    expect(datagovmy.licence).toStartWith('CC BY 4.0')
    const forecasts = forecastsOf(datagovmy.forecast.rows)
    expect(forecasts.map((f) => f.date).toSorted()).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25'
    ])
    expect(forecasts.find((f) => f.date === '2026-10-19')).toMatchObject({
      locationName: 'Petaling',
      summary: { ms: 'Ribut petir di beberapa tempat', en: 'Scattered thunderstorms' },
      summaryWhen: { ms: 'Sepanjang Hari', en: 'Throughout the day' }
    })

    // In force that afternoon: thunderstorms over Sarawak, Sabah and Labuan, and sea warnings for the waters of Selangor.
    expect(datagovmy.warnings.rows.map((w) => w.warning_issue.title_en)).toEqual([
      'Thunderstorms Warning',
      'Strong Winds and Rough Seas Warning',
      'No Advisory',
      'Strong Winds and Rough Seas Warning'
    ])
    expect(warningSnapshots(datagovmy, ELMINA_AREA)).toEqual([])
    // The thunderstorm warning does name Miri, Sarawak: 12:00 to 16:00 Malaysia time.
    expect(warningSnapshots(datagovmy, { state: 'Sarawak', district: 'Miri' })).toMatchObject([
      {
        kind: 'lightning_warning',
        observedAt: '2026-10-19T04:00:00.000Z',
        validTo: '2026-10-19T08:00:00.000Z',
        simulated: false
      }
    ])
  })

  test('the snapshots drive the rain trigger: the real 0.0 mm hour re-plans nothing, a heavy hour re-plans', async () => {
    const reading = jpsRainfallReading(jps)
    expect(weatherTriggers([reading, ...warningSnapshots(datagovmy, ELMINA_AREA)], reading.observedAt)).toEqual([])

    // A labelled fixture in the snapshot's own format: the same row, with a JPS "heavy" hour at 06:00 on 21 Oct.
    const heavy = jpsRainfallReading({
      ...jps,
      row: jps.row.with(jps.header.indexOf('Last Updated'), '21/10/2026 06:00:00').with(-1, '42.5'),
      simulated: true,
      source: 'fixture'
    })
    expect(rainCategory(heavy.value!)).toBe('heavy')
    const { plan, subscriber, plans } = await openPlan('2026-10-20T22:05:00.000Z')
    const triggers = weatherTriggers([heavy], '2026-10-20T22:05:00.000Z')
    expect(triggers).toEqual([{ kind: 'heavy_rain', reading: heavy }])

    const [replanned] = plans(triggers.flatMap(subscriber.onTrigger))
    expect(replanned!.replan).toEqual({ trigger: triggers[0], supersedes: { planId: plan.id, committedTasks: 0 } })
    expect(replanned!.context).toEqual([heavy])
    expect(replanned!.holds.map((h) => h.kind)).toEqual(['weather'])
    expect(replanned!.window.reason).toBe('next_dry_window')
  })

  test('a data.gov.my thunderstorm warning for Petaling drives the warning trigger', async () => {
    // A labelled fixture in the feed's own format: the real thunderstorm row, moved to Selangor on 21 Oct.
    const [real] = datagovmy.warnings.rows
    const fixture: DataGovMySnapshot = {
      ...datagovmy,
      warnings: {
        ...datagovmy.warnings,
        rows: [
          {
            ...real!,
            valid_from: '2026-10-21T05:00:00',
            valid_to: '2026-10-21T09:00:00',
            text_en:
              'Thunderstorms, heavy rain and strong winds are expected over the states of Perak: Kinta • Selangor: Gombak, Petaling and Klang until 9:00 AM; Wednesday, 21 October 2026.'
          }
        ]
      },
      simulated: true,
      source: 'fixture'
    }
    const [warning] = warningSnapshots(fixture, ELMINA_AREA)
    expect(warning).toMatchObject({
      kind: 'lightning_warning',
      observedAt: '2026-10-20T21:00:00.000Z',
      validTo: '2026-10-21T01:00:00.000Z',
      simulated: true,
      source: 'fixture'
    })
    const { plan, subscriber, plans } = await openPlan('2026-10-20T21:10:00.000Z')
    const triggers = weatherTriggers([warning!], '2026-10-20T21:10:00.000Z')
    const [replanned] = plans(triggers.flatMap(subscriber.onTrigger))
    expect(replanned!.replan).toEqual({
      trigger: { kind: 'weather_warning', warning },
      supersedes: { planId: plan.id, committedTasks: 0 }
    })
    expect(replanned!.holds.map((h) => [h.kind, h.until])).toContainEqual(['lightning', '2026-10-21T01:00:00.000Z'])
  })
})
