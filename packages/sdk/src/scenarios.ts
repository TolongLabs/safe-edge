import { jpsRainfallReading, JpsRainfallSnapshot } from '@safe-edge/providers'
import jps from '../../../data/elmina/weather/jps-rainfall-27880-20261019T070234Z.json'
import s1 from '../../../data/elmina/scenarios/s1-after-rain-patrol.json'
import s2 from '../../../data/elmina/scenarios/s2-choosing-a-fix.json'
import s3 from '../../../data/elmina/scenarios/s3-proving-the-fix.json'
import s4 from '../../../data/elmina/scenarios/s4-governance.json'
import s5 from '../../../data/elmina/scenarios/s5-integration.json'
import s6 from '../../../data/elmina/scenarios/s6-text-in-image.json'
import { Scenario } from './scenario.ts'

/** S1 to S6 from `data/elmina/scenarios/`, checked against the scenario schema. */
export const elminaScenarios: Scenario[] = [s1, s2, s3, s4, s5, s6].map((json) => Scenario.parse(json))

const rainfallSnapshot = JpsRainfallSnapshot.parse(jps)

/** The real one-hour rainfall at the gauge nearest Elmina, from the saved JPS snapshot, with the gauge's name. */
export const elminaRainfall = {
  station: rainfallSnapshot.row[rainfallSnapshot.header.indexOf('Station')]!,
  reading: jpsRainfallReading(rainfallSnapshot)
}
