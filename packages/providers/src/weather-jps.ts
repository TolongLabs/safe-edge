import { ContextSnapshot, Source, Timestamp } from '@safe-edge/contracts'
import * as z from 'zod'
import { malaysiaTime } from './weather-datagovmy.ts'

// JPS Public Infobanjir publishes rain gauge readings on public pages, with no documented API or reuse licence (TRD
// "Data sources and licences"). The planner reads a timestamped snapshot of one station's row; the app never calls
// the site.

export const JPS_PUBLISHER = 'JPS Public Infobanjir'
export const JPS_LICENCE =
  'Public page; JPS documents no API and no reuse licence. Kept as a timestamped snapshot for the offline demo; the app never calls the site. Times on the page are Malaysia time (UTC+8).'
/** The Selangor rainfall page, which shows the table this snapshot copies a row of. */
export const JPS_RAINFALL_PAGE = 'https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=SEL&lang=en'

/** One station's row of the public rainfall table, as text, under the table's column headings. */
export const JpsRainfallSnapshot = z.object({
  publisher: z.literal(JPS_PUBLISHER),
  licence: z.string(),
  page: z.url(),
  /** The request the page makes for its table. */
  url: z.url(),
  retrievedAt: Timestamp,
  stationId: z.string(),
  header: z.array(z.string()),
  row: z.array(z.string()),
  simulated: z.boolean(),
  source: Source
})
export type JpsRainfallSnapshot = z.infer<typeof JpsRainfallSnapshot>

const LAST_UPDATED = 'Last Updated'
const ONE_HOUR = 'Total 1 Hour (Now)'

/**
 * The station's one-hour rainfall total as a planning input, observed at the row's "Last Updated" time. The page marks
 * a missing reading -9999; that, or a column the page no longer shows, throws.
 */
export function jpsRainfallReading(snapshot: JpsRainfallSnapshot): ContextSnapshot {
  const { header, row, stationId } = snapshot
  if (header.length !== row.length)
    throw new Error(`station ${stationId}: ${row.length} cells under ${header.length} headings`)
  const cell = (heading: string) => {
    const index = header.indexOf(heading)
    if (index < 0) throw new Error(`the JPS rainfall table has no "${heading}" column`)
    return row[index]!
  }
  const updated = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/.exec(cell(LAST_UPDATED))
  if (!updated) throw new Error(`station ${stationId} last updated "${cell(LAST_UPDATED)}", not DD/MM/YYYY hh:mm:ss`)
  const [, day, month, year, time] = updated
  const mm = Number(cell(ONE_HOUR))
  if (!(mm >= 0)) throw new Error(`station ${stationId} reported no one-hour total ("${cell(ONE_HOUR)}")`)
  return ContextSnapshot.parse({
    kind: 'rainfall',
    value: mm,
    text: null,
    observedAt: malaysiaTime(`${year}-${month}-${day}T${time}`),
    validTo: null,
    publisher: JPS_PUBLISHER,
    stationId,
    url: snapshot.page,
    simulated: snapshot.simulated,
    source: snapshot.source
  })
}

/**
 * Copies one station's row out of the HTML the rainfall table request returns, under flattened headings (the six
 * "Daily Rainfall" dates in place of that heading). The station is found by its graph link, because the table's
 * "Station ID" column is blank for many gauges. For the snapshot script.
 */
export function jpsRainfallRow(html: string, stationId: string): { header: string[]; row: string[] } {
  const text = (cells: RegExpMatchArray[]) =>
    cells.map((c) =>
      c[1]!
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
  const headings = text([...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)])
  const daily = headings.indexOf('Daily Rainfall')
  const dates = headings.filter((h) => /^\d{2}\/\d{2}\/\d{4}$/.test(h))
  if (daily < 0 || dates.length === 0) throw new Error('the JPS rainfall table has no daily rainfall columns')
  const header = [...headings.slice(0, daily), ...dates, ...headings.slice(daily + 1).filter((h) => !dates.includes(h))]

  const rows = html.split("<td data-th='No'>").slice(1)
  const matches = rows.filter((r) => r.includes(`stationid=${stationId}'`))
  if (matches.length !== 1)
    throw new Error(`the JPS rainfall table has ${matches.length} rows for station ${stationId}`)
  const row = text([...`<td>${matches[0]!}`.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)])
  if (row.length !== header.length)
    throw new Error(`station ${stationId}: ${row.length} cells under ${header.length} headings`)
  return { header, row }
}
