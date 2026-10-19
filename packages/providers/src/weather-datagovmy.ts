import { ContextSnapshot, Source, Timestamp } from '@safe-edge/contracts'
import * as z from 'zod'

// data.gov.my's Weather API (developer.data.gov.my/realtime-api/weather): MET Malaysia's forecasts and warnings,
// open under CC BY 4.0 with no token, at most 4 requests a minute per the rate-limit page.

export const DATA_GOV_MY_BASE_URL = 'https://api.data.gov.my'
export const DATA_GOV_MY_LICENCE =
  'CC BY 4.0 (developer.data.gov.my/faq). Attribute as "Weather data: MET Malaysia, via data.gov.my". The API allows 4 requests a minute.'
const REQUESTS_PER_MINUTE = 4
const MINUTE_MS = 60_000

/** MET Malaysia's local times carry no offset; they are Malaysia time (UTC+8). */
const LocalDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)

// Loose objects keep any field MET adds, so a snapshot holds the rows exactly as served.
export const ForecastRow = z.looseObject({
  location: z.looseObject({ location_id: z.string(), location_name: z.string() }),
  date: z.iso.date(),
  morning_forecast: z.string(),
  afternoon_forecast: z.string(),
  night_forecast: z.string(),
  summary_forecast: z.string(),
  summary_when: z.string(),
  min_temp: z.number(),
  max_temp: z.number()
})
export type ForecastRow = z.infer<typeof ForecastRow>

export const WarningRow = z.looseObject({
  warning_issue: z.looseObject({ issued: LocalDateTime, title_bm: z.string(), title_en: z.string() }),
  valid_from: LocalDateTime.nullable(),
  valid_to: LocalDateTime.nullable(),
  heading_en: z.string().nullable(),
  text_en: z.string().nullable(),
  instruction_en: z.string().nullable(),
  heading_bm: z.string().nullable(),
  text_bm: z.string().nullable(),
  instruction_bm: z.string().nullable()
})
export type WarningRow = z.infer<typeof WarningRow>

/** One response: the rows as served, the URL asked and when. */
const SavedResponse = <T extends z.ZodType>(row: T) =>
  z.object({ url: z.url(), retrievedAt: Timestamp, rows: z.array(row) })
export type DataGovMyResponse<T> = { url: string; retrievedAt: string; rows: T[] }

/** A saved pair of responses for the offline demo, with where and when they came from. */
export const DataGovMySnapshot = z.object({
  publisher: z.literal('data.gov.my (MET Malaysia)'),
  licence: z.string(),
  forecast: SavedResponse(ForecastRow),
  warnings: SavedResponse(WarningRow),
  simulated: z.boolean(),
  source: Source
})
export type DataGovMySnapshot = z.infer<typeof DataGovMySnapshot>

export interface DataGovMyOptions {
  fetch: (url: string) => Promise<Response>
  /** Epoch milliseconds and a wait; `Date.now` and a timer outside tests. */
  clock: { now(): number; sleep(ms: number): Promise<void> }
}

export interface DataGovMyClient {
  /** The 7-day general forecast for a location by its exact name, e.g. "Petaling" (a district). */
  forecast(locationName: string): Promise<DataGovMyResponse<ForecastRow>>
  /** The warnings in MET Malaysia's current feed, for every state and the seas. */
  warnings(): Promise<DataGovMyResponse<WarningRow>>
}

/**
 * Calls the Weather API at most 4 times in any minute: further calls wait their turn, in order. Requests go to the
 * trailing-slash paths, because the bare paths answer 301. A non-2xx answer (429 when over the limit) throws.
 */
export function createDataGovMyClient({ fetch, clock }: DataGovMyOptions): DataGovMyClient {
  let sent: number[] = []
  let queue: Promise<unknown> = Promise.resolve()

  const get = <T extends z.ZodType>(path: string, row: T): Promise<DataGovMyResponse<z.infer<T>>> => {
    const url = `${DATA_GOV_MY_BASE_URL}${path}`
    const turn = async () => {
      sent = sent.filter((t) => clock.now() - t < MINUTE_MS)
      if (sent.length >= REQUESTS_PER_MINUTE) {
        await clock.sleep(sent.at(-REQUESTS_PER_MINUTE)! + MINUTE_MS - clock.now())
      }
      sent.push(clock.now())
      const retrievedAt = new Date(clock.now()).toISOString()
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${url} answered ${response.status}: ${await response.text()}`)
      return { url, retrievedAt, rows: z.array(row).parse(await response.json()) }
    }
    const result = queue.then(turn)
    // The next call waits for this one to finish, whether or not it failed; the caller still gets the failure.
    queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  return {
    forecast: (locationName) =>
      get(`/weather/forecast/?filter=${encodeURIComponent(locationName)}@location__location_name`, ForecastRow),
    warnings: () => get('/weather/warning/', WarningRow)
  }
}

// The forecast values are published in Malay only (API docs, "Possible Values"); these are the docs' translations.
// The live feed's capitals differ from the docs ("Tiada Hujan" for "Tiada hujan"), so values match ignoring case, and
// it says "Jerebu" (haze) where the docs list "Berjerebu" (seen 19 Oct 2026).
const FORECAST_EN: Record<string, string> = {
  Berjerebu: 'Hazy',
  Jerebu: 'Hazy',
  'Tiada hujan': 'No rain',
  Hujan: 'Rain',
  'Hujan di beberapa tempat': 'Scattered rain',
  'Hujan di satu dua tempat': 'Isolated rain',
  'Hujan di satu dua tempat di kawasan pantai': 'Isolated rain over coastal areas',
  'Hujan di satu dua tempat di kawasan pedalaman': 'Isolated rain over inland areas',
  'Ribut petir': 'Thunderstorms',
  'Ribut petir di beberapa tempat': 'Scattered thunderstorms',
  'Ribut petir di beberapa tempat di kawasan pedalaman': 'Scattered thunderstorms over inland areas',
  'Ribut petir di satu dua tempat': 'Isolated thunderstorms',
  'Ribut petir di satu dua tempat di kawasan pantai': 'Isolated thunderstorms over coastal areas',
  'Ribut petir di satu dua tempat di kawasan pedalaman': 'Isolated thunderstorms over inland areas'
}
const WHEN_EN: Record<string, string> = {
  Pagi: 'Morning',
  Malam: 'Night',
  Petang: 'Afternoon',
  'Pagi dan Petang': 'Morning and afternoon',
  'Pagi dan Malam': 'Morning and night',
  'Petang dan Malam': 'Afternoon and night',
  'Sepanjang Hari': 'Throughout the day'
}

/** A published Malay value and its English translation. */
export interface Bilingual {
  ms: string
  en: string
}

export interface Forecast {
  locationId: string
  locationName: string
  date: string
  morning: Bilingual
  afternoon: Bilingual
  night: Bilingual
  summary: Bilingual
  summaryWhen: Bilingual
  minTempC: number
  maxTempC: number
}

/** The forecast rows in English as well as Malay. A value the docs do not list throws, rather than show untranslated. */
export function forecastsOf(rows: ForecastRow[]): Forecast[] {
  const translate = (table: Record<string, string>, ms: string): Bilingual => {
    const en = Object.entries(table).find(([key]) => key.toLowerCase() === ms.toLowerCase())?.[1]
    if (en === undefined) throw new Error(`data.gov.my forecast value "${ms}" has no documented translation`)
    return { ms, en }
  }
  return rows.map((r) => ({
    locationId: r.location.location_id,
    locationName: r.location.location_name,
    date: r.date,
    morning: translate(FORECAST_EN, r.morning_forecast),
    afternoon: translate(FORECAST_EN, r.afternoon_forecast),
    night: translate(FORECAST_EN, r.night_forecast),
    summary: translate(FORECAST_EN, r.summary_forecast),
    summaryWhen: translate(WHEN_EN, r.summary_when),
    minTempC: r.min_temp,
    maxTempC: r.max_temp
  }))
}

/** Where the planner needs warnings for: the state, and a district of it as the warnings name it. */
export interface WarningArea {
  state: string
  district: string
}

/** Elmina lies in Petaling district, Selangor. */
export const ELMINA_AREA: WarningArea = { state: 'Selangor', district: 'Petaling' }

/**
 * The saved warnings that apply on land in `area`, as planning inputs. A warning applies when its English text names
 * the state among "the states of …" with no district list, or with a list naming the district. Sea-area warnings ("the
 * waters of …") and advisories without an area do not apply. A thunderstorm warning ("Amaran Ribut Petir") is a
 * `lightning_warning`, which holds the launch; any other is a `weather_warning`. Each is in force from `valid_from` to
 * `valid_to`, read as Malaysia time.
 */
export function warningSnapshots(
  snapshot: Pick<DataGovMySnapshot, 'publisher' | 'warnings' | 'simulated' | 'source'>,
  area: WarningArea
): ContextSnapshot[] {
  const { url, rows } = snapshot.warnings
  return rows
    .filter((w) => namesArea(w.text_en ?? '', area))
    .map((w) => {
      if (w.valid_from === null || w.valid_to === null) {
        throw new Error(`"${w.warning_issue.title_en}" issued ${w.warning_issue.issued} has no validity period`)
      }
      const thunderstorm = w.warning_issue.title_bm === 'Amaran Ribut Petir'
      return ContextSnapshot.parse({
        kind: thunderstorm ? 'lightning_warning' : 'weather_warning',
        value: null,
        text: `${w.warning_issue.title_en}: ${w.text_en}`,
        observedAt: malaysiaTime(w.valid_from),
        validTo: malaysiaTime(w.valid_to),
        publisher: snapshot.publisher,
        stationId: null,
        url,
        simulated: snapshot.simulated,
        source: snapshot.source
      })
    })
}

function namesArea(text: string, { state, district }: WarningArea): boolean {
  const states = /over the states? of (.+?) until /i.exec(text)?.[1]
  if (states === undefined) return false
  return states.split(' • ').some((item) => {
    const split = item.search(/[:(]/)
    const name = (split < 0 ? item : item.slice(0, split)).trim()
    const districts = split < 0 ? '' : item.slice(split)
    return name === state && (districts === '' || new RegExp(`\\b${district}\\b`).test(districts))
  })
}

/** `2026-10-19T12:00:00` in Malaysia time (UTC+8) as an ISO 8601 UTC timestamp. */
export function malaysiaTime(local: string): string {
  return new Date(`${local}+08:00`).toISOString()
}
