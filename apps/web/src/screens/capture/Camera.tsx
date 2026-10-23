import { Camera as CameraIcon, Images, WarningCircle } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { SampleImage, type Scene } from '../../scenes'
import { IMAGE_TYPES } from './queue'

/** How sharp a frame is, 0 to 1: the variance of its Laplacian on a small grey copy (blurred frames score near 0). */
function sharpness(source: CanvasImageSource, w: number, h: number) {
  const width = 160
  const height = Math.round((width * h) / w)
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source, 0, 0, width, height)
  const px = ctx.getImageData(0, 0, width, height).data
  const g = (x: number, y: number) =>
    px[(y * width + x) * 4]! * 0.3 + px[(y * width + x) * 4 + 1]! * 0.59 + px[(y * width + x) * 4 + 2]! * 0.11
  let sum = 0
  let sum2 = 0
  let n = 0
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const l = 4 * g(x, y) - g(x - 1, y) - g(x + 1, y) - g(x, y - 1) - g(x, y + 1)
      sum += l
      sum2 += l * l
      n++
    }
  const variance = sum2 / n - (sum / n) ** 2
  return Math.min(1, variance / 200) // shortcut: 200 is a guess at "sharp" for a 160 px copy; tune on real phone shots
}

export type Shot = {
  blob: Blob
  sharpness: number
  source: 'camera' | 'upload'
  capturedAt?: string
  originalBytes?: ArrayBuffer
  originalDate?: Date | null
  file?: File
}

function whyOff(error: unknown) {
  if (!window.isSecureContext)
    return 'This page is not on a secure (https) connection, so the browser keeps the camera off.'
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'This browser did not allow it.'
  if (error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'OverconstrainedError'))
    return 'This phone has no camera the browser can use.'
  return 'The browser could not start it.'
}

/** The live rear camera with the baseline ghosted over it; or, where the camera is off, the gallery upload alone. */
export function Camera({
  scene,
  busy,
  onShot,
  note
}: {
  scene: Scene | null
  busy: boolean
  onShot: (shot: Shot) => void
  note: string
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [off, setOff] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [ghost, setGhost] = useState(40)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let live = true
    if (!navigator.mediaDevices?.getUserMedia) {
      setOff(whyOff(null))
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (!live) return s.getTracks().forEach((t) => t.stop())
        stream = s
        video.current!.srcObject = s
      })
      .catch((e: unknown) => live && setOff(whyOff(e)))
    return () => {
      live = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const still = () => {
    const v = video.current!
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    const s = sharpness(c, c.width, c.height)
    c.toBlob(
      (blob) =>
        blob
          ? onShot({
              blob,
              sharpness: s,
              source: 'camera',
              capturedAt: new Date().toISOString()
            })
          : setError('The browser could not make a picture from the camera.'),
      'image/jpeg',
      0.9
    )
  }

  const chosen = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError('That file is not a JPEG, PNG or WebP photo. Choose one of those.')
      return
    }
    let bitmap: ImageBitmap
    try {
      bitmap = await createImageBitmap(file)
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'InvalidStateError') {
        setError('That file is not a picture this browser can open. Choose a JPEG, PNG or WebP photo.')
        return
      }
      throw e
    }
    const originalBytes = await file.arrayBuffer()
    const originalDate = file.lastModified ? new Date(file.lastModified) : null
    try {
      onShot({
        blob: file,
        sharpness: sharpness(bitmap, bitmap.width, bitmap.height),
        source: 'upload',
        originalBytes,
        originalDate,
        file
      })
    } finally {
      bitmap.close()
    }
  }

  const gallery = (primary: boolean) => (
    <label className={`btn${primary ? ' primary' : ''} gallery`} aria-disabled={busy}>
      <Images size={22} weight="bold" aria-hidden="true" />
      Upload from gallery
      <input
        className="sr"
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={(e) => {
          void chosen(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </label>
  )

  return (
    <>
      <div className="capture-body">
        {off ? (
          <div className="banner warn" role="status">
            <WarningCircle size={22} weight="bold" aria-hidden="true" />
            <p>
              <b>The camera is off.</b> {off} You can still upload a photo you took.
            </p>
          </div>
        ) : (
          !ready && (
            <p className="hint" role="status">
              Starting the camera…
            </p>
          )
        )}
        {error && (
          <div className="banner error" role="alert">
            <WarningCircle size={22} weight="bold" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}
        <div className={`viewfinder${off ? ' off' : ''}`}>
          {!off && (
            <video ref={video} aria-label="Live camera" autoPlay playsInline muted onPlaying={() => setReady(true)} />
          )}
          {scene && (
            <div className="ghost" style={{ opacity: off ? 1 : ghost / 100 }}>
              <SampleImage
                scene={scene}
                variant="before"
                focus={off ? undefined : { x: 0, y: 0, w: 100, h: 100 }}
                name="Baseline picture of this viewpoint"
              />
            </div>
          )}
          {!off && scene && (
            <label className="ghost-slider">
              <span>Ghost</span>
              <input
                type="range"
                min={0}
                max={100}
                value={ghost}
                onChange={(e) => setGhost(Number(e.target.value))}
                aria-valuetext={`${ghost} percent`}
              />
              <output>{ghost}%</output>
            </label>
          )}
          <p className="caption">
            {scene
              ? `${off ? 'Baseline picture' : 'Baseline ghost'} of this viewpoint`
              : 'No baseline picture for this viewpoint yet'}
          </p>
        </div>
        <p className="hint">
          {off ? 'Stand where the baseline was taken, take the photo with your phone, then choose it.' : note}
        </p>
      </div>
      {/* The status line says why a button is off while the camera starts or a photo is sending. */}
      <div className="pinned">
        {off ? (
          <>
            {gallery(true)}
            <p className="hint">{busy ? 'Sending the photo…' : 'Photos are recorded as taken on a phone.'}</p>
          </>
        ) : (
          <>
            {gallery(false)}
            <button className="btn primary" disabled={!ready || busy} aria-describedby="take-status" onClick={still}>
              <CameraIcon size={22} weight="bold" aria-hidden="true" />
              Take photo
            </button>
            <p className="hint" id="take-status">
              {busy
                ? 'Sending the photo…'
                : ready
                  ? 'Photos are recorded as taken on a phone.'
                  : 'Take photo unlocks once the camera has started.'}
            </p>
          </>
        )}
      </div>
    </>
  )
}
