import { describe, expect, test } from 'bun:test'
import { DOMParser, type Document, type Element } from '@xmldom/xmldom'
import { strFromU8, unzipSync } from 'fflate'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { demoPlan } from '../scripts/export-mission.ts'
import { exportQgcPlan, exportWpmlKmz } from '../src/export/index.ts'

const repoRoot = join(import.meta.dir, '../../..')
const readJson = (path: string) => Bun.file(join(repoRoot, path)).json()

// MAV_CMD values from MAVLink common.xml.
const NAV_WAYPOINT = 16
const NAV_LAND = 21
const NAV_TAKEOFF = 22
const DO_MOUNT_CONTROL = 205
const IMAGE_START_CAPTURE = 2000

describe('mission export of a patrol planned over real Elmina segments', async () => {
  // The demo dock sits on a 6 m roof at 101.5135, 3.1784, on ground 36 m above sea level; the plan flies 9 m above
  // the edge, so 3 m above the dock, and hovers 3 s at each camera station.
  const { plan, drone, groundAmslM } = await demoPlan(readJson)
  const stations = plan.waypoints.filter((w) => w.kind === 'station')

  test('the demo plan flies real stations from the dock and back', () => {
    expect(stations.length).toBeGreaterThan(10)
    expect(plan.waypoints.map((w): string => w.kind)).toEqual([
      'takeoff',
      'transit',
      ...stations.map(() => 'station'),
      'transit',
      'landing'
    ])
  })

  describe('QGroundControl .plan', () => {
    const file = JSON.parse(exportQgcPlan({ plan, drone, groundAmslM }))
    const items: {
      command: number
      frame: number
      params: (number | null)[]
      autoContinue: boolean
      doJumpId: number
      Altitude?: number
      AltitudeMode?: number
    }[] = file.mission.items

    test('has the documented plan file shape, with the dock as planned home', () => {
      expect(file).toMatchObject({
        fileType: 'Plan',
        version: 1,
        geoFence: { circles: [], polygons: [], version: 2 },
        rallyPoints: { points: [], version: 2 },
        mission: {
          version: 2,
          firmwareType: 12, // MAV_AUTOPILOT_PX4
          vehicleType: 2, // MAV_TYPE_QUADROTOR
          globalPlanAltitudeMode: 1, // relative to home
          cruiseSpeed: drone.cruiseSpeedMps,
          hoverSpeed: drone.cruiseSpeedMps,
          plannedHomePosition: [3.1784, 101.5135, 42]
        }
      })
      expect(items.map((item) => item.doJumpId)).toEqual(items.map((_, i) => i + 1))
    })

    test('is stamped not flight-ready', () => {
      expect(file.groundStation).toContain('NOT FLIGHT-READY')
      expect(file.notice).toContain('NOT FLIGHT-READY')
    })

    test('takes off from the dock, flies every waypoint 3 m above it, and lands back on it', () => {
      const nav = items.filter((item) => item.frame === 3)
      expect(nav.map((item) => item.command)).toEqual([
        NAV_TAKEOFF,
        ...plan.waypoints.slice(1, -1).map(() => NAV_WAYPOINT),
        NAV_LAND
      ])
      nav.forEach((item, i) => {
        const w = plan.waypoints[i]!
        expect(item.params.slice(4, 6)).toEqual([w.lat, w.lon])
        expect(item.params[3]).toBe(w.headingDeg)
      })
      // The take-off climbs to flight height; landing is back at the dock's height.
      const heights = [3, ...plan.waypoints.slice(1, -1).map(() => 3), 0]
      expect(nav.map((item) => item.Altitude)).toEqual(heights)
      expect(nav.map((item) => item.params[6])).toEqual(heights)
      expect(nav.every((item) => item.AltitudeMode === 1 && item.autoContinue === true)).toBe(true)
      expect(nav.at(-1)!.params.slice(4, 6)).toEqual([3.1784, 101.5135])
    })

    test('hovers 3 s at each station, then pitches the gimbal and takes one photo', () => {
      const atStations = items.flatMap((item, i) =>
        item.command === NAV_WAYPOINT && item.params[0] !== 0 ? [items.slice(i, i + 3)] : []
      )
      expect(atStations).toHaveLength(stations.length)
      atStations.forEach(([waypoint, gimbal, photo], i) => {
        expect(waypoint!.params[0]).toBe(3)
        expect(waypoint!.params.slice(4, 6)).toEqual([stations[i]!.lat, stations[i]!.lon])
        // QGC's own camera-section encoding: pitch, roll 0, yaw 0 (straight ahead), MAV_MOUNT_MODE_MAVLINK_TARGETING.
        expect(gimbal).toMatchObject({ command: DO_MOUNT_CONTROL, frame: 2 })
        expect(gimbal!.params).toEqual([stations[i]!.gimbalPitchDeg, 0, 0, 0, 0, 0, 2])
        expect(photo).toMatchObject({ command: IMAGE_START_CAPTURE, frame: 2 })
        expect(photo!.params).toEqual([0, 0, 1, i + 1, null, null, null])
      })
      expect(items).toHaveLength(plan.waypoints.length + 2 * stations.length)
    })
  })

  describe('DJI WPML KMZ', () => {
    const kmz = unzipSync(exportWpmlKmz({ plan, drone }))
    const xml = (name: string) => parseXml(strFromU8(kmz[name]!))
    const files = { 'wpmz/template.kml': xml('wpmz/template.kml'), 'wpmz/waylines.wpml': xml('wpmz/waylines.wpml') }
    // Take-off and landing are not waypoints in WPML: the aircraft climbs to the take-off security height, flies to
    // the first waypoint, and goes home when the route finishes.
    const airborne = plan.waypoints.slice(1, -1)

    test('holds exactly the two WPML files, both KML with the WPML 1.0.2 namespace', () => {
      expect(Object.keys(kmz).toSorted()).toEqual(['wpmz/template.kml', 'wpmz/waylines.wpml'])
      for (const doc of Object.values(files)) {
        expect(doc.documentElement!.namespaceURI).toBe(KML)
        expect(doc.documentElement!.localName).toBe('kml')
        expect(doc.documentElement!.lookupNamespaceURI('wpml')).toBe(WPML)
      }
    })

    test('both files are stamped not flight-ready in the KML document name and description', () => {
      for (const doc of Object.values(files)) {
        const document = child(doc.documentElement!, KML, 'Document')
        expect(child(document, KML, 'name').textContent).toBe('Safe Edge plan_demo (NOT FLIGHT-READY)')
        expect(child(document, KML, 'description').textContent).toStartWith('NOT FLIGHT-READY: ')
      }
    })

    test('both mission configs carry the required elements for a Matrice 3TD on a dock', () => {
      for (const [name, doc] of Object.entries(files)) {
        const config = child(child(doc.documentElement!, KML, 'Document'), WPML, 'missionConfig')
        expect(wpmlValues(config)).toMatchObject({
          flyToWaylineMode: 'safely',
          finishAction: 'goHome',
          exitOnRCLost: 'executeLostAction',
          executeRCLostAction: 'goBack',
          // DJI's floor for a dock: the plan's own climb is only 3 m above the dock.
          takeOffSecurityHeight: '8',
          globalTransitionalSpeed: '8',
          ...(name === 'wpmz/waylines.wpml' ? { globalRTHHeight: '3' } : {})
        })
        expect(wpmlValues(child(config, WPML, 'droneInfo'))).toEqual({ droneEnumValue: '91', droneSubEnumValue: '1' })
        expect(wpmlValues(child(config, WPML, 'payloadInfo'))).toEqual({
          payloadEnumValue: '81',
          payloadPositionIndex: '0'
        })
      }
    })

    test('the waylines folder has its required elements and one waypoint per plan waypoint in the air', () => {
      const folder = child(child(files['wpmz/waylines.wpml'].documentElement!, KML, 'Document'), KML, 'Folder')
      expect(wpmlValues(folder)).toMatchObject({
        templateId: '0',
        waylineId: '0',
        executeHeightMode: 'relativeToStartPoint',
        autoFlightSpeed: '8'
      })
      const placemarks = children(folder, KML, 'Placemark')
      expect(placemarks).toHaveLength(airborne.length)
      placemarks.forEach((placemark, i) => {
        expect(wpmlValues(placemark)).toMatchObject({ index: String(i), executeHeight: '3', waypointSpeed: '8' })
        expect(wpmlValues(child(placemark, WPML, 'waypointTurnParam'))).toEqual({
          waypointTurnMode: 'toPointAndStopWithDiscontinuityCurvature',
          waypointTurnDampingDist: '0'
        })
      })
    })

    test('the template is a waypoint template at one flight height, 3 m above take-off', () => {
      const document = child(files['wpmz/template.kml'].documentElement!, KML, 'Document')
      expect(wpmlValues(document)).toMatchObject({ author: 'Safe Edge planner', createTime: '1792476000000' })
      const folder = child(document, KML, 'Folder')
      expect(wpmlValues(folder)).toMatchObject({
        templateType: 'waypoint',
        templateId: '0',
        autoFlightSpeed: '8',
        globalHeight: '3',
        gimbalPitchMode: 'usePointSetting',
        globalWaypointTurnMode: 'toPointAndStopWithDiscontinuityCurvature'
      })
      expect(wpmlValues(child(folder, WPML, 'waylineCoordinateSysParam'))).toEqual({
        coordinateMode: 'WGS84',
        heightMode: 'relativeToStartPoint'
      })
      const placemarks = children(folder, KML, 'Placemark')
      expect(placemarks).toHaveLength(airborne.length)
      placemarks.forEach((placemark, i) => {
        expect(wpmlValues(placemark)).toMatchObject({
          index: String(i),
          useGlobalHeight: '1',
          useGlobalSpeed: '1',
          useGlobalTurnParam: '1',
          useGlobalHeadingParam: '0',
          gimbalPitchAngle: String(airborne[i]!.gimbalPitchDeg)
        })
      })
    })

    test('in both files every waypoint sits on its plan waypoint and holds its heading', () => {
      for (const doc of Object.values(files)) {
        const folder = child(child(doc.documentElement!, KML, 'Document'), KML, 'Folder')
        children(folder, KML, 'Placemark').forEach((placemark, i) => {
          const w = airborne[i]!
          const coordinates = child(child(placemark, KML, 'Point'), KML, 'coordinates').textContent!
          expect(coordinates.split(',').map(Number)).toEqual([w.lon, w.lat])
          expect(wpmlValues(child(placemark, WPML, 'waypointHeadingParam'))).toEqual({
            waypointHeadingMode: 'smoothTransition',
            waypointHeadingAngle: String(w.headingDeg),
            waypointHeadingPathMode: 'followBadArc'
          })
        })
      }
    })

    test('in both files each station pitches the gimbal, hovers 3 s and takes one photo named for its segment', () => {
      for (const doc of Object.values(files)) {
        const folder = child(child(doc.documentElement!, KML, 'Document'), KML, 'Folder')
        const groups = children(folder, KML, 'Placemark').map((placemark, i) => {
          const [group, ...more] = children(placemark, WPML, 'actionGroup')
          expect(more).toEqual([])
          if (airborne[i]!.kind !== 'station') return expect(group).toBeUndefined()
          expect(wpmlValues(group!)).toMatchObject({
            actionGroupStartIndex: String(i),
            actionGroupEndIndex: String(i),
            actionGroupMode: 'sequence'
          })
          expect(wpmlValues(child(group!, WPML, 'actionTrigger'))).toEqual({ actionTriggerType: 'reachPoint' })
          const actions = children(group!, WPML, 'action').map((action) => ({
            ...wpmlValues(action),
            ...wpmlValues(child(action, WPML, 'actionActuatorFuncParam'))
          }))
          expect(actions).toEqual([
            expect.objectContaining({
              actionId: '0',
              actionActuatorFunc: 'gimbalRotate',
              gimbalRotateMode: 'absoluteAngle',
              gimbalPitchRotateEnable: '1',
              gimbalPitchRotateAngle: String(airborne[i]!.gimbalPitchDeg),
              gimbalYawRotateEnable: '0',
              gimbalRollRotateEnable: '0'
            }),
            expect.objectContaining({ actionId: '1', actionActuatorFunc: 'hover', hoverTime: '3' }),
            expect.objectContaining({
              actionId: '2',
              actionActuatorFunc: 'takePhoto',
              fileSuffix: airborne[i]!.segmentId,
              payloadPositionIndex: '0'
            })
          ])
          return wpmlValues(group!).actionGroupId
        })
        const ids = groups.filter((id) => id !== undefined)
        expect(ids).toHaveLength(stations.length)
        expect(new Set(ids).size).toBe(stations.length)
      }
    })
  })

  test('refuses a drone the plan does not fly, a format the drone does not take, and a plan with no waypoints', () => {
    const other = { ...drone, id: 'drn_other' }
    expect(() => exportWpmlKmz({ plan, drone: other })).toThrow('plan plan_demo flies drn_assumed, not drn_other')
    const qgcOnly = { ...drone, missionFormats: ['qgc_plan' as const] }
    expect(() => exportWpmlKmz({ plan, drone: qgcOnly })).toThrow('drone drn_assumed does not take wpml missions')
    const empty = { ...plan, waypoints: [] }
    expect(() => exportQgcPlan({ plan: empty, drone, groundAmslM })).toThrow('plan plan_demo has no waypoints')
  })

  test('`bun run export:mission <dir>` writes both files for the demo plan, stamped in their names', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'mission-export-'))
    const run = Bun.spawnSync(['bun', 'run', 'export:mission', outDir], { cwd: repoRoot })
    if (run.exitCode !== 0) throw new Error(run.stderr.toString())
    expect(run.stdout.toString()).toContain('wrote plan_demo-NOT-FLIGHT-READY.kmz and plan_demo-NOT-FLIGHT-READY.plan')
    expect((await readdir(outDir)).toSorted()).toEqual([
      'plan_demo-NOT-FLIGHT-READY.kmz',
      'plan_demo-NOT-FLIGHT-READY.plan'
    ])
    // Same files as the library export; zip entry times are local time, so compare the contents, not the bytes.
    const kmz = unzipSync(await Bun.file(join(outDir, 'plan_demo-NOT-FLIGHT-READY.kmz')).bytes())
    expect(kmz).toEqual(unzipSync(exportWpmlKmz({ plan, drone })))
    const qgc = await Bun.file(join(outDir, 'plan_demo-NOT-FLIGHT-READY.plan')).text()
    expect(qgc).toBe(exportQgcPlan({ plan, drone, groundAmslM }))
    await rm(outDir, { recursive: true })
  })
})

const KML = 'http://www.opengis.net/kml/2.2'
const WPML = 'http://www.dji.com/wpmz/1.0.2'

/** Parses XML, failing on any well-formedness error or warning. */
function parseXml(text: string): Document {
  return new DOMParser({
    onError: (level, message) => {
      throw new Error(`XML ${level}: ${message}`)
    }
  }).parseFromString(text, 'text/xml')
}

function children(el: Element, ns: string, name: string): Element[] {
  return Array.from(el.childNodes).filter(
    (n): n is Element => n.nodeType === n.ELEMENT_NODE && (n as Element).namespaceURI === ns && n.localName === name
  )
}

function child(el: Element, ns: string, name: string): Element {
  const [first, ...more] = children(el, ns, name)
  if (!first || more.length > 0) throw new Error(`expected one <${name}> in <${el.tagName}>`)
  return first
}

/** The text of each `wpml:` child element that holds only text, by local name. */
function wpmlValues(el: Element): Record<string, string> {
  return Object.fromEntries(
    Array.from(el.childNodes)
      .filter(
        (n): n is Element =>
          n.nodeType === n.ELEMENT_NODE &&
          (n as Element).namespaceURI === WPML &&
          Array.from(n.childNodes).every((c) => c.nodeType === c.TEXT_NODE)
      )
      .map((n) => [n.localName!, n.textContent!])
  )
}
