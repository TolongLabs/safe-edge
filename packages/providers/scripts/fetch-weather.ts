// Saves one live snapshot of each weather source into data/elmina/weather/ for the offline demo (NFR-1): the
// data.gov.my forecast for Petaling and the current warnings (2 of the 4 requests a minute), and the JPS Public
// Infobanjir rainfall row for Rem KTM Sungai Buloh (station 27880). The only code that calls these sites.
// Run: bun run fetch:weather
import { join } from 'node:path'
import {
  DATA_GOV_MY_LICENCE,
  DataGovMySnapshot,
  ELMINA_AREA,
  JPS_LICENCE,
  JPS_PUBLISHER,
  JPS_RAINFALL_PAGE,
  JpsRainfallSnapshot,
  createDataGovMyClient,
  forecastsOf,
  jpsRainfallReading,
  jpsRainfallRow,
  warningSnapshots
} from '../src/index.ts'

const STATION = '27880'
const JPS_TABLE_URL =
  'https://publicinfobanjir.water.gov.my/wp-content/themes/shapely/agency/searchresultrainfall.php?state=SEL&district=Petaling&station=ALL&loginStatus=0&language=1'
const outDir = join(import.meta.dir, '../../../data/elmina/weather')
const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')

const client = createDataGovMyClient({ fetch, clock: { now: Date.now, sleep: (ms) => Bun.sleep(ms) } })
const datagovmy = DataGovMySnapshot.parse({
  publisher: 'data.gov.my (MET Malaysia)',
  licence: DATA_GOV_MY_LICENCE,
  forecast: await client.forecast(ELMINA_AREA.district),
  warnings: await client.warnings(),
  simulated: false,
  source: 'provider'
})
if (datagovmy.forecast.rows.length === 0) throw new Error(`no forecast for ${ELMINA_AREA.district}`)

const retrievedAt = new Date().toISOString()
// The site's CDN answers 403 to Bun's default User-Agent, so the script names itself.
const response = await fetch(JPS_TABLE_URL, {
  headers: { 'user-agent': 'SafeEdge-weather-snapshot/1.0 (hackathon prototype; one manual request per run)' }
})
if (!response.ok) throw new Error(`${JPS_TABLE_URL} answered ${response.status}`)
const jps = JpsRainfallSnapshot.parse({
  publisher: JPS_PUBLISHER,
  licence: JPS_LICENCE,
  page: JPS_RAINFALL_PAGE,
  url: JPS_TABLE_URL,
  retrievedAt,
  stationId: STATION,
  ...jpsRainfallRow(await response.text(), STATION),
  simulated: false,
  source: 'provider'
})

// Both must read back as planning inputs before they are kept.
const forecasts = forecastsOf(datagovmy.forecast.rows)
const warnings = warningSnapshots(datagovmy, ELMINA_AREA)
const reading = jpsRainfallReading(jps)

const files = {
  [`datagovmy-${stamp(datagovmy.warnings.retrievedAt)}.json`]: datagovmy,
  [`jps-rainfall-${STATION}-${stamp(retrievedAt)}.json`]: jps
}
for (const [name, body] of Object.entries(files))
  await Bun.write(join(outDir, name), `${JSON.stringify(body, null, 2)}\n`)
console.log(`wrote ${Object.keys(files).join(' and ')} to ${outDir}`)
console.log(`forecast: ${forecasts.map((f) => `${f.date} ${f.summary.en}`).join('; ')}`)
console.log(
  `warnings in the feed: ${datagovmy.warnings.rows.length}; applying to ${ELMINA_AREA.district}: ${warnings.length}`
)
console.log(`JPS ${STATION}: ${reading.value} mm in the hour to ${reading.observedAt}`)
