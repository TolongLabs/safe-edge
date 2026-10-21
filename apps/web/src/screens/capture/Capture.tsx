import { CheckCircle, Info, Tray, WarningCircle, WifiSlash } from '@phosphor-icons/react'
import type { Segment } from '@safe-edge/contracts'
import { elminaSeed } from '@safe-edge/sdk'
import { useCallback, useEffect, useState } from 'react'
import { ROLE_WORDS } from '../fix-lens/lens'
import type { Scene } from '../../scenes'
import { Screen } from '../../shell/Shell'
import { can, client, useSignedIn } from '../../store'
import { Camera, type Shot } from './Camera'
import { capture, drain, explain, IMAGE_TYPES, loadQueue, sendsToApi, sentKey, useCapture, type Sent } from './queue'
import './capture.css'

/** Display words for the viewpoints the demo knows; core carries only an ID and a pose. */
const NAMES: Record<string, { name: string; scene: Scene }> = {
  [elminaSeed.story.s1.viewpointId]: { name: 'Playground path, fence line', scene: 'fence' },
  vp_866518980_11_1: { name: 'Lake bank, grass slope', scene: 'path' }
}
const describe = (id: string, index: number): { name: string; scene: Scene | null } =>
  NAMES[id] ?? { name: `Viewpoint ${index + 1}`, scene: null }

/** The segment number from its name ("... segment 12"), for the code plate; nothing is made up when there is none. */
const code = (name: string) => {
  const n = /segment (\d+)/i.exec(name)?.[1]
  return n ? `S${n}` : null
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const person = (name: string) => name.replace(/\s*\([^)]*\)$/, '')

function useSegments() {
  const { user } = useSignedIn()
  const [state, setState] = useState<{ segments: Segment[] } | { error: Error } | null>(null)
  const [tries, setTries] = useState(0)
  useEffect(() => {
    let live = true
    setState(null)
    client()
      .listSegments()
      .then(
        (segments) => live && setState({ segments }),
        (error: Error) => live && setState({ error })
      )
    return () => {
      live = false
    }
  }, [user.id, tries])
  return { state, retry: () => setTries(tries + 1) }
}

function useDrain() {
  const { user } = useSignedIn()
  const [online, setOnline] = useState(navigator.onLine)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(() => {
    if (!navigator.onLine) return
    setError(null)
    drain(user.id).catch((e: unknown) =>
      setError(`Could not send the photos: ${explain(e)}. They are still on this phone.`)
    )
  }, [user.id])

  useEffect(() => {
    const change = () => {
      setOnline(navigator.onLine)
      upload()
    }
    window.addEventListener('online', change)
    window.addEventListener('offline', change)
    loadQueue().then(upload)
    return () => {
      window.removeEventListener('online', change)
      window.removeEventListener('offline', change)
    }
  }, [upload])

  return { online, upload, error }
}

const Plate = ({ name }: { name: string }) => {
  const c = code(name)
  return c ? <span className="plate">{c}</span> : null
}

function Banner({
  kind,
  icon,
  children
}: {
  kind: 'info' | 'warn' | 'ok' | 'error'
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={`banner ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {icon}
      <p>{children}</p>
    </div>
  )
}

function ApiBanner() {
  if (!sendsToApi) return null
  return (
    <Banner kind="info" icon={<Info size={22} weight="bold" aria-hidden="true" />}>
      Live API mode: uploads use the configured API token, not the person signed in here.
    </Banner>
  )
}

function CrewNote() {
  if (can('recordObservation')) return null
  return (
    <Banner kind="info" icon={<Info size={22} weight="bold" aria-hidden="true" />}>
      <b>Phone capture is the walk crew&rsquo;s step.</b> You can see the viewpoints, not take photos.
    </Banner>
  )
}

function WaitingBanner({ online }: { online: boolean }) {
  const { user } = useSignedIn()
  const { waiting } = useCapture()
  if (waiting.length === 0) return null
  const offlineNow = !online
  return (
    <Banner kind="warn" icon={<WifiSlash size={22} weight="bold" aria-hidden="true" />}>
      <b>
        {offlineNow ? 'No signal. ' : ''}
        {plural(waiting.length, 'photo', 'photos')} waiting to upload.
      </b>{' '}
      Taken by {[...new Set(waiting.map((q) => q.userName))].join(', ')}. They send in order when you are back online
      {waiting.some((q) => q.userId !== user.id) && ', each by the person who took it signed in'}.
    </Banner>
  )
}

function SegmentList() {
  const { user } = useSignedIn()
  const { sent } = useCapture()
  const { state, retry } = useSegments()
  const { online, error: drainError } = useDrain()
  const context = `${person(user.name)} · ${ROLE_WORDS[user.role]}`
  return (
    <Screen title="Capture" context={context}>
      <main className="detail island capture" aria-label="Segments">
        <ApiBanner />
        <CrewNote />
        {drainError && (
          <Banner kind="error" icon={<WarningCircle size={22} weight="bold" aria-hidden="true" />}>
            {drainError}
          </Banner>
        )}
        <WaitingBanner online={online} />
        {state === null && (
          <div className="skeleton-rows" role="status">
            <i /> <i /> <i />
            <p className="hint">Loading the segments…</p>
          </div>
        )}
        {state && 'error' in state && (
          <>
            <Banner kind="error" icon={<WarningCircle size={22} weight="bold" aria-hidden="true" />}>
              <b>The segments could not load:</b> {state.error.message}. Nothing was sent or changed.
            </Banner>
            <button className="btn" onClick={retry}>
              Try again
            </button>
          </>
        )}
        {state && 'segments' in state && (
          <>
            {(() => {
              const withViewpoints = state.segments.filter((s) => s.viewpoints.length > 0)
              const without = state.segments.length - withViewpoints.length
              return (
                <>
                  <h2>Which edge are you walking?</h2>
                  {withViewpoints.length === 0 ? (
                    <p className="hint">No segment has fixed viewpoints yet, so there is nothing to photograph.</p>
                  ) : (
                    <ul className="rows">
                      {withViewpoints.map((s) => {
                        const done = s.viewpoints.filter((v) => sent[sentKey(s.id, v.id)]).length
                        return (
                          <li key={s.id}>
                            <a className="row" href={`#/capture/${s.id}`}>
                              <Plate name={s.name} />
                              <span>
                                <b>{s.name}</b>
                                <span className="sub">
                                  {plural(s.viewpoints.length, 'viewpoint', 'viewpoints')} ·{' '}
                                  {done > 0 ? `${done} sent in this session` : 'none sent yet'}
                                </span>
                              </span>
                            </a>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {without > 0 && (
                    <p className="hint">
                      {plural(without, 'other segment has', 'other segments have')} no fixed viewpoints yet.
                    </p>
                  )}
                </>
              )
            })()}
          </>
        )}
      </main>
    </Screen>
  )
}

function SegmentView({ segmentId }: { segmentId: string }) {
  const { user } = useSignedIn()
  const { waiting, sent } = useCapture()
  const { state, retry } = useSegments()
  const { online, upload, error: drainError } = useDrain()
  const [current, setCurrent] = useState<string | null>(null)
  const [last, setLast] = useState<{ viewpointId: string; sent: Sent | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState<Shot | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const mayCapture = can('recordObservation')

  const clearFailed = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setFailed(null)
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const leaveViewpoint = () => {
    clearFailed()
    setError(null)
    setCurrent(null)
  }

  const segment = state && 'segments' in state ? state.segments.find((s) => s.id === segmentId) : undefined
  const context = `${segment?.name ?? 'Loading'} · ${person(user.name)}`
  const toSegments = { label: 'All segments', href: '#/capture' }

  if (!segment)
    return (
      <Screen title="Capture" context={context} back={toSegments}>
        <main className="detail island capture" aria-label="Viewpoints">
          {state && 'error' in state ? (
            <>
              <Banner kind="error" icon={<WarningCircle size={22} weight="bold" aria-hidden="true" />}>
                <b>Could not load the viewpoints.</b> Photos already taken stay queued on this phone. (
                {state.error.message})
              </Banner>
              <button className="btn" onClick={retry}>
                Try again
              </button>
            </>
          ) : (
            <div className="skeleton-rows" role="status">
              <i /> <i /> <i />
              <p className="hint">Loading the viewpoints…</p>
            </div>
          )}
        </main>
      </Screen>
    )

  if (segment.viewpoints.length === 0)
    return (
      <Screen title="Capture" context={context} back={toSegments}>
        <main className="detail island capture" aria-label="Viewpoints">
          <div className="empty-state left">
            <span className="icon-tile">
              <Tray size={24} weight="bold" aria-hidden="true" />
            </span>
            <h2>No viewpoints for this edge</h2>
            <p>Ask the park manager to set them. An edge nobody photographed stays unknown, not safe.</p>
            <a className="btn primary" href="#/capture">
              Back to all segments
            </a>
          </div>
        </main>
      </Screen>
    )

  const views = segment.viewpoints.map((v, i) => ({ ...v, ...describe(v.id, i), n: i + 1 }))
  const mine = waiting.filter((q) => q.segmentId === segmentId)
  const statusOf = (id: string) =>
    sent[sentKey(segmentId, id)] ? 'Sent' : mine.some((q) => q.viewpointId === id) ? 'Waiting' : null
  const next = views.find((v) => !statusOf(v.id))
  const open = views.find((v) => v.id === current)

  const submit = async (shot: Shot) => {
    if (!open) return
    setBusy(true)
    setError(null)
    try {
      const mediaType = IMAGE_TYPES.find((t) => t === shot.blob.type)
      if (!mediaType) {
        throw new Error(`The photo is ${shot.blob.type || 'of unknown type'}, not JPEG, PNG or WebP.`)
      }
      const result = await capture({
        userId: user.id,
        userName: person(user.name),
        segmentId,
        viewpointId: open.id,
        capturedAt: new Date().toISOString(),
        pose: open.pose,
        sharpness: shot.sharpness,
        mediaType,
        bytes: await shot.blob.arrayBuffer(),
        simulated: segment.simulated
      })
      clearFailed()
      setLast({ viewpointId: open.id, sent: result })
      setCurrent(null)
    } catch (e) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(shot.blob))
      setFailed(shot)
      setError(`Could not send the photo: ${explain(e)}. The photo is still here.`)
    } finally {
      setBusy(false)
    }
  }

  // Camera
  if (open && mayCapture)
    return (
      <Screen
        title="Capture"
        context={`Viewpoint ${open.n} of ${views.length} · ${open.name}`}
        back={{ label: 'Back to viewpoints', onClick: leaveViewpoint }}
      >
        <main className="detail island capture" aria-label={`Viewpoint ${open.n}`}>
          {previewUrl && (
            <figure className="taken">
              <img src={previewUrl} alt="The photo you took, not yet sent" />
            </figure>
          )}
          {error && (
            <Banner kind="error" icon={<WarningCircle size={22} weight="bold" aria-hidden="true" />}>
              {error}
            </Banner>
          )}
          {failed && (
            <button className="btn" disabled={busy} onClick={() => void submit(failed)}>
              Try again
            </button>
          )}
          <Camera
            key={open.id}
            scene={open.scene}
            busy={busy}
            onShot={(shot) => void submit(shot)}
            note="Take the photo from the same spot as the baseline."
          />
        </main>
      </Screen>
    )

  // After a capture
  const lastView = last && views.find((v) => v.id === last.viewpointId)
  const offlineNow = !online

  return (
    <Screen title="Capture" context={context} back={toSegments}>
      <main className="detail island capture" aria-label="Viewpoints">
        <ApiBanner />
        <CrewNote />
        {drainError && (
          <Banner kind="error" icon={<WarningCircle size={22} weight="bold" aria-hidden="true" />}>
            {drainError}
          </Banner>
        )}
        {last?.sent && (
          <>
            <Banner kind="ok" icon={<CheckCircle size={22} weight="bold" aria-hidden="true" />}>
              <b>Sent to Edge Watch</b> at {time(last.sent.at)} by {last.sent.by}. Recorded in core as a{' '}
              {last.sent.captureSource} observation <code translate="no">{last.sent.observationId}</code>.
              {last.sent.local && ' The photo is kept on this phone, not stored in core.'}
              {sendsToApi && ' The photo was stored by the API.'}
            </Banner>
            <figure className="taken">
              <img src={last.sent.thumb} alt={`The photo you took at ${lastView?.name ?? 'the viewpoint'}`} />
            </figure>
            <p className="note">A sent photo is not a pass.</p>
          </>
        )}
        <WaitingBanner online={online} />
        <h2>
          {plural(views.length, 'viewpoint', 'viewpoints')} ·{' '}
          {views.filter((v) => sent[sentKey(segmentId, v.id)]).length} sent
        </h2>
        <ul className="rows">
          {views.map((v) => {
            const status = statusOf(v.id)
            const label = status ?? (v === next ? 'Next' : 'To do')
            const body = (
              <>
                <span className="num" aria-hidden="true">
                  {v.n}
                </span>
                <b>{v.name}</b>
                <span className={`pill ${label.toLowerCase().replace(' ', '-')}`}>{label}</span>
              </>
            )
            return (
              <li key={v.id}>
                {mayCapture ? (
                  <button
                    className="row"
                    aria-label={`Viewpoint ${v.n}: ${v.name}, ${label}`}
                    onClick={() => setCurrent(v.id)}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="row">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
        {mayCapture && (
          <div className="pinned">
            {waiting.length > 0 && (
              <button className="btn" disabled={offlineNow} onClick={upload}>
                Upload now
              </button>
            )}
            {offlineNow && waiting.length > 0 ? (
              <p className="hint">Off until the phone is online. Nothing is lost.</p>
            ) : next ? (
              <>
                <button className="btn primary" onClick={() => setCurrent(next.id)}>
                  {last ? `Next: viewpoint ${next.n}` : `Open viewpoint ${next.n}`}
                </button>
                <p className="hint">{next.name}. Same spot as the baseline photo.</p>
              </>
            ) : (
              <p className="hint">Every viewpoint has a photo.</p>
            )}
          </div>
        )}
      </main>
    </Screen>
  )
}

export function Capture({ segmentId }: { segmentId: string | null }) {
  return segmentId ? <SegmentView segmentId={segmentId} /> : <SegmentList />
}
