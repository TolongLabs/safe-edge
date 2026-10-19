import { strToU8, zipSync } from 'fflate'
import { assumedEnergyModel } from '../patrol.ts'
import {
  NOT_FLIGHT_READY,
  missionWaypoints,
  notFlightReadyNotice,
  type MissionExportInput,
  type MissionWaypoint
} from './mission.ts'

/**
 * The target aircraft, from DJI's WPML common-element tables: Matrice 3TD (91/1) with its camera (81) on the main
 * gimbal. It is the newest aircraft those tables list, and Dock 2's aircraft in the one CAAM notice of a nested dock
 * operation in Malaysia (docs/research/drone-integration/hardware-cost.md). Change it when an aircraft is chosen.
 */
const AIRCRAFT = { droneEnumValue: 91, droneSubEnumValue: 1, payloadEnumValue: 81, payloadPositionIndex: 0 }
/** DJI's lowest take-off security height for a dock (the range is 8–1500 m above take-off). */
const DOCK_MIN_TAKEOFF_SECURITY_HEIGHT_M = 8
const TEMPLATE_ID = 0

/** `[tag, text or child elements]`. Tags without a prefix are KML; `wpml:` tags are DJI's extension. */
type El = readonly [string, string | number | readonly El[]]

/**
 * The plan as a DJI WPML route (KMZ bytes): `wpmz/template.kml`, a waypoint template DJI Pilot 2 and FlightHub 2 can
 * edit, and `wpmz/waylines.wpml`, the route the aircraft executes. Heights are relative to the take-off point (the
 * dock). The aircraft climbs to the take-off security height, flies the plan's waypoints in the air (take-off and
 * landing are not WPML waypoints) and goes home. At each station it pitches the gimbal, hovers for the assumed
 * capture time and takes one photo whose file name ends with the segment ID. The zip entries are dated `createdAt`.
 */
export function exportWpmlKmz(input: MissionExportInput): Uint8Array {
  const { plan, drone } = input
  const waypoints = missionWaypoints(input, 'wpml').slice(1, -1)
  const heights = new Set(waypoints.map((w) => w.heightM))
  if (heights.size !== 1) throw new Error(`plan ${plan.id} flies at several heights; the WPML template holds one`)
  const flightHeightM = [...heights][0]!

  const missionConfig = (extra: El[]): El => [
    'wpml:missionConfig',
    [
      ['wpml:flyToWaylineMode', 'safely'],
      ['wpml:finishAction', 'goHome'],
      ['wpml:exitOnRCLost', 'executeLostAction'],
      ['wpml:executeRCLostAction', 'goBack'],
      ['wpml:takeOffSecurityHeight', Math.max(DOCK_MIN_TAKEOFF_SECURITY_HEIGHT_M, flightHeightM)],
      ['wpml:globalTransitionalSpeed', drone.cruiseSpeedMps],
      ...extra,
      [
        'wpml:droneInfo',
        [
          ['wpml:droneEnumValue', AIRCRAFT.droneEnumValue],
          ['wpml:droneSubEnumValue', AIRCRAFT.droneSubEnumValue]
        ]
      ],
      [
        'wpml:payloadInfo',
        [
          ['wpml:payloadEnumValue', AIRCRAFT.payloadEnumValue],
          ['wpml:payloadPositionIndex', AIRCRAFT.payloadPositionIndex]
        ]
      ]
    ]
  ]
  const stamp: El[] = [
    ['name', `Safe Edge ${plan.id} (${NOT_FLIGHT_READY})`],
    ['description', notFlightReadyNotice]
  ]
  const placemarks = (fields: (w: MissionWaypoint) => El[]): El[] => {
    let groupId = 0
    return waypoints.map((w, index): El => [
      'Placemark',
      [
        ['Point', [['coordinates', `${w.lon},${w.lat}`]]],
        ['wpml:index', index],
        ...fields(w),
        [
          'wpml:waypointHeadingParam',
          [
            ['wpml:waypointHeadingMode', 'smoothTransition'],
            ['wpml:waypointHeadingAngle', w.headingDeg],
            ['wpml:waypointHeadingPathMode', 'followBadArc']
          ]
        ],
        ...(w.kind === 'station' ? [capture(groupId++, index, w)] : [])
      ]
    ])
  }
  const turn: El = [
    'wpml:waypointTurnParam',
    [
      ['wpml:waypointTurnMode', 'toPointAndStopWithDiscontinuityCurvature'],
      ['wpml:waypointTurnDampingDist', 0]
    ]
  ]

  const createdMs = Date.parse(plan.createdAt)
  const template = kml([
    ...stamp,
    ['wpml:author', 'Safe Edge planner'],
    ['wpml:createTime', createdMs],
    ['wpml:updateTime', createdMs],
    missionConfig([]),
    [
      'Folder',
      [
        ['wpml:templateType', 'waypoint'],
        ['wpml:templateId', TEMPLATE_ID],
        [
          'wpml:waylineCoordinateSysParam',
          [
            ['wpml:coordinateMode', 'WGS84'],
            ['wpml:heightMode', 'relativeToStartPoint']
          ]
        ],
        ['wpml:autoFlightSpeed', drone.cruiseSpeedMps],
        ['wpml:globalHeight', flightHeightM],
        ['wpml:gimbalPitchMode', 'usePointSetting'],
        ['wpml:globalWaypointTurnMode', 'toPointAndStopWithDiscontinuityCurvature'],
        ...placemarks((w) => [
          ['wpml:useGlobalHeight', 1],
          ['wpml:useGlobalSpeed', 1],
          ['wpml:useGlobalTurnParam', 1],
          ['wpml:gimbalPitchAngle', w.gimbalPitchDeg],
          ['wpml:useGlobalHeadingParam', 0]
        ])
      ]
    ]
  ])
  const waylines = kml([
    ...stamp,
    missionConfig([['wpml:globalRTHHeight', flightHeightM]]),
    [
      'Folder',
      [
        ['wpml:templateId', TEMPLATE_ID],
        ['wpml:executeHeightMode', 'relativeToStartPoint'],
        ['wpml:waylineId', 0],
        ['wpml:autoFlightSpeed', drone.cruiseSpeedMps],
        ...placemarks((w) => [['wpml:executeHeight', w.heightM], ['wpml:waypointSpeed', drone.cruiseSpeedMps], turn])
      ]
    ]
  ])

  return zipSync(
    { 'wpmz/template.kml': strToU8(template), 'wpmz/waylines.wpml': strToU8(waylines) },
    { mtime: plan.createdAt }
  )
}

/** At a station: pitch the gimbal, hover for the assumed capture time, take one photo named for the segment. */
function capture(groupId: number, index: number, w: MissionWaypoint): El {
  return [
    'wpml:actionGroup',
    [
      ['wpml:actionGroupId', groupId],
      ['wpml:actionGroupStartIndex', index],
      ['wpml:actionGroupEndIndex', index],
      ['wpml:actionGroupMode', 'sequence'],
      ['wpml:actionTrigger', [['wpml:actionTriggerType', 'reachPoint']]],
      action(0, 'gimbalRotate', [
        ['wpml:gimbalHeadingYawBase', 'north'],
        ['wpml:gimbalRotateMode', 'absoluteAngle'],
        ['wpml:gimbalPitchRotateEnable', 1],
        ['wpml:gimbalPitchRotateAngle', w.gimbalPitchDeg],
        ['wpml:gimbalRollRotateEnable', 0],
        ['wpml:gimbalRollRotateAngle', 0],
        ['wpml:gimbalYawRotateEnable', 0],
        ['wpml:gimbalYawRotateAngle', 0],
        ['wpml:gimbalRotateTimeEnable', 0],
        ['wpml:gimbalRotateTime', 0],
        ['wpml:payloadPositionIndex', AIRCRAFT.payloadPositionIndex]
      ]),
      action(1, 'hover', [['wpml:hoverTime', assumedEnergyModel.stationHoverS]]),
      action(2, 'takePhoto', [
        ['wpml:payloadPositionIndex', AIRCRAFT.payloadPositionIndex],
        ['wpml:fileSuffix', w.segmentId!],
        ['wpml:payloadLensIndex', 'wide'],
        ['wpml:useGlobalPayloadLensIndex', 0]
      ])
    ]
  ]
}

function action(id: number, func: string, params: El[]): El {
  return [
    'wpml:action',
    [
      ['wpml:actionId', id],
      ['wpml:actionActuatorFunc', func],
      ['wpml:actionActuatorFuncParam', params]
    ]
  ]
}

function kml(document: El[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">',
    render(['Document', document], '  '),
    '</kml>',
    ''
  ].join('\n')
}

function render([tag, body]: El, indent: string): string {
  if (typeof body !== 'object') return `${indent}<${tag}>${escapeXml(String(body))}</${tag}>`
  return [`${indent}<${tag}>`, ...body.map((el) => render(el, `${indent}  `)), `${indent}</${tag}>`].join('\n')
}

function escapeXml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
