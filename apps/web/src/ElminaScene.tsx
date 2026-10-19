import { createElminaScene, type ControlMode, type ElminaLayers, type ElminaScene as Scene } from '@safe-edge/scene'
import { useEffect, useRef, useState } from 'react'
import buildingsUrl from '../../../data/elmina/osm/buildings.geojson?url'
import parksUrl from '../../../data/elmina/osm/parks.geojson?url'
import pathsUrl from '../../../data/elmina/osm/paths.geojson?url'
import waterUrl from '../../../data/elmina/osm/water.geojson?url'

const layerUrls = { water: waterUrl, parks: parksUrl, paths: pathsUrl, buildings: buildingsUrl }

async function loadLayers(): Promise<ElminaLayers> {
  const entries = await Promise.all(
    Object.entries(layerUrls).map(async ([name, url]) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${name} layer answered ${response.status}`)
      return [name, await response.json()] as const
    })
  )
  return Object.fromEntries(entries) as unknown as ElminaLayers
}

/** The Elmina base scene from the OSM extract, with a switch between orbit and map controls. */
export function ElminaScene() {
  const container = useRef<HTMLDivElement>(null)
  const scene = useRef<Scene>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | Error>('loading')
  const [mode, setMode] = useState<ControlMode>('orbit')

  useEffect(() => {
    let disposed = false
    loadLayers().then(
      (layers) => {
        if (disposed) return
        scene.current = createElminaScene(container.current!, layers)
        setStatus('ready')
      },
      (error: Error) => setStatus(error)
    )
    return () => {
      disposed = true
      scene.current?.dispose()
      scene.current = null
    }
  }, [])

  const toggle = () => {
    const next = mode === 'orbit' ? 'map' : 'orbit'
    scene.current?.setControlMode(next)
    setMode(next)
  }

  return (
    <div ref={container} style={{ position: 'relative', width: '100%', height: '100dvh' }} data-testid="elmina-scene">
      {status === 'loading' && <p>Loading the Elmina map…</p>}
      {status instanceof Error && <p role="alert">The Elmina map did not load: {status.message}</p>}
      {status === 'ready' && (
        <button type="button" onClick={toggle} style={{ position: 'absolute', top: 8, left: 8 }}>
          {mode === 'orbit' ? 'Orbit controls' : 'Map controls'}: switch to {mode === 'orbit' ? 'map' : 'orbit'}
        </button>
      )}
    </div>
  )
}
