import exifr from 'exifr/dist/lite.esm.mjs'
import type { Pose } from '@safe-edge/contracts'
import type { Shot } from './Camera'

export const ISSUE_TYPES = [
  'fence_missing',
  'fence_damaged',
  'path_broken',
  'path_worn',
  'sign_missing',
  'ring_buoy_missing',
  'cover_moved',
  'grating_blocked',
  'debris',
  'other'
] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

export const ISSUE_LABELS: Record<IssueType, string> = {
  fence_missing: 'Fence or barrier missing',
  fence_damaged: 'Fence or barrier damaged',
  path_broken: 'Path broken',
  path_worn: 'Worn path',
  sign_missing: 'Sign down or missing',
  ring_buoy_missing: 'Ring buoy missing',
  cover_moved: 'Cover moved',
  grating_blocked: 'Grating blocked',
  debris: 'Debris',
  other: 'Other'
}

export const ACTIONS = ['replace', 'repair', 'clear', 'cordon', 'not_sure'] as const
export type Action = (typeof ACTIONS)[number]

export const ACTION_LABELS: Record<Action, string> = {
  replace: 'Replace a part',
  repair: 'Repair',
  clear: 'Clear or remove',
  cordon: 'Cordon off now',
  not_sure: 'Not sure'
}

export const URGENCIES = ['low', 'medium', 'high'] as const
export type Urgency = (typeof URGENCIES)[number]

export const URGENCY_DETAILS: Record<Urgency, { label: string; hint: string }> = {
  low: { label: 'Low', hint: 'One bar of a fence missing, no way through.' },
  medium: { label: 'Medium', hint: 'A panel is loose or a sign is down. No way through yet.' },
  high: { label: 'High', hint: 'A gap someone could walk through to the water.' }
}

export const CAUSES = ['unknown', 'stolen', 'vandalism', 'weather', 'wear', 'accident'] as const
export type Cause = (typeof CAUSES)[number]

export const CAUSE_LABELS: Record<Cause, string> = {
  unknown: "Don't know",
  stolen: 'Stolen',
  vandalism: 'Vandalism',
  weather: 'Weather',
  wear: 'Wear',
  accident: 'Accident'
}

export type WhereSource = 'photo' | 'phone' | 'viewpoint' | 'manual'

export type WhereValue = {
  lat: number | null
  lon: number | null
  accuracyM: number | null
  source: WhereSource
  note: string | null
}

export type TimeSource = 'photo' | 'capture' | 'manual'

export type WhenValue = {
  observedAt: string
  timeSource: TimeSource
}

export type DamageReportInput = {
  description: string
  viewpointId: string
  where: {
    lat: number
    lon: number
    accuracyM: number | null
    source: WhereSource
    note: string | null
  } | null
  observedAt: string
  timeSource: TimeSource
  issueType: IssueType
  issueTypeOther: string | null
  action: Action | null
  actionNote: string | null
  urgency: Urgency
  cause: Cause
}

export type ExifMetadata = {
  latitude?: number
  longitude?: number
  dateTimeOriginal?: Date | null
}

export async function parseExif(input: Blob | ArrayBuffer | File): Promise<ExifMetadata> {
  try {
    const data = await exifr.parse(input)
    let latitude = typeof data?.latitude === 'number' && !Number.isNaN(data.latitude) ? data.latitude : undefined
    let longitude = typeof data?.longitude === 'number' && !Number.isNaN(data.longitude) ? data.longitude : undefined
    if (latitude === undefined || longitude === undefined) {
      try {
        const g = await exifr.gps(input)
        if (g && typeof g.latitude === 'number' && typeof g.longitude === 'number') {
          latitude = g.latitude
          longitude = g.longitude
        }
      } catch {
        // ignore gps failure
      }
    }
    let dateTimeOriginal: Date | null = null
    if (data?.DateTimeOriginal instanceof Date && !Number.isNaN(data.DateTimeOriginal.getTime())) {
      dateTimeOriginal = data.DateTimeOriginal
    } else if (typeof data?.DateTimeOriginal === 'string') {
      const d = new Date(data.DateTimeOriginal)
      if (!Number.isNaN(d.getTime())) dateTimeOriginal = d
    }
    return { latitude, longitude, dateTimeOriginal }
  } catch {
    return {}
  }
}

export function getPhoneLocation(timeoutMs = 4000): Promise<GeolocationCoordinates | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    )
  })
}

export async function resolveInitialWhere(shot: Shot, pose?: Pose | null): Promise<WhereValue> {
  // 1. EXIF GPS
  if (shot.source === 'upload') {
    const exif = await parseExif(shot.originalBytes ?? shot.blob)
    if (exif.latitude !== undefined && exif.longitude !== undefined) {
      return {
        lat: exif.latitude,
        lon: exif.longitude,
        accuracyM: null,
        source: 'photo',
        note: null
      }
    }
  }

  // 2. Native navigator.geolocation
  const phone = await getPhoneLocation()
  if (phone) {
    return {
      lat: phone.latitude,
      lon: phone.longitude,
      accuracyM: Math.round(phone.accuracy),
      source: 'phone',
      note: null
    }
  }

  // 3. Selected viewpoint pose
  if (pose && typeof pose.lat === 'number' && typeof pose.lon === 'number') {
    return {
      lat: pose.lat,
      lon: pose.lon,
      accuracyM: null,
      source: 'viewpoint',
      note: null
    }
  }

  // 4. Manual empty
  return {
    lat: null,
    lon: null,
    accuracyM: null,
    source: 'manual',
    note: null
  }
}

export async function resolveInitialWhen(shot: Shot): Promise<WhenValue> {
  if (shot.source === 'camera') {
    return {
      observedAt: shot.capturedAt ?? new Date().toISOString(),
      timeSource: 'capture'
    }
  }

  // upload
  const exif = await parseExif(shot.originalBytes ?? shot.blob)
  if (exif.dateTimeOriginal) {
    return {
      observedAt: exif.dateTimeOriginal.toISOString(),
      timeSource: 'photo'
    }
  }

  // upload without EXIF DateTimeOriginal: blank until human supplies
  return {
    observedAt: '',
    timeSource: 'manual'
  }
}

export function whereSourceLabel(source: WhereSource): string {
  switch (source) {
    case 'photo':
      return 'From the photo'
    case 'phone':
      return 'From your phone'
    case 'viewpoint':
      return 'From the viewpoint'
    case 'manual':
      return 'Manual'
  }
}

export function timeSourceLabel(source: TimeSource): string {
  switch (source) {
    case 'photo':
      return 'From the photo'
    case 'capture':
      return 'From the camera'
    case 'manual':
      return 'Manual'
  }
}

export function itemStatusMapping(issueType: IssueType): 'missing' | 'changed' | null {
  switch (issueType) {
    case 'fence_missing':
    case 'sign_missing':
    case 'ring_buoy_missing':
      return 'missing'
    case 'fence_damaged':
    case 'path_broken':
    case 'path_worn':
    case 'cover_moved':
    case 'grating_blocked':
      return 'changed'
    case 'debris':
    case 'other':
    default:
      return null
  }
}

export function classMapping(issueType: IssueType): 'inventory_item' | 'worn_path' | 'floating_debris' | 'other' {
  switch (issueType) {
    case 'path_worn':
      return 'worn_path'
    case 'debris':
      return 'floating_debris'
    case 'other':
      return 'other'
    default:
      return 'inventory_item'
  }
}
