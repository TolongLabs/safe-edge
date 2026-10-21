import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { SafeEdgeDeniedError } from '@safe-edge/sdk'
import type { Asset } from '@safe-edge/contracts'
import { useSignedIn } from '../../store'
import { download } from './report'
import { buildPack, type HandoverPack } from './handover/pack'
import { Handover } from './handover/Handover'
import { DownloadSimple, Printer, WarningCircle } from '@phosphor-icons/react'

export function HandoverSlot() {
  const { user, client } = useSignedIn()
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [assetId, setAssetId] = useState('')
  const [pack, setPack] = useState<HandoverPack | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The sheet is in the page once the pack is set; the print dialog opens after that render.
  useEffect(() => {
    if (pack !== null) window.print()
  }, [pack])

  useEffect(() => {
    let live = true
    client
      .listAssets()
      .then((data) => {
        if (live) setAssets(data)
      })
      .catch((e: unknown) => {
        if (!live) return
        const text = e instanceof Error ? e.message : String(e)
        setError(e instanceof SafeEdgeDeniedError ? `${text} (rule: ${e.rule})` : text)
      })
    return () => {
      live = false
    }
  }, [user.id])

  /** Builds the pack as the signed-in person; a refusal (with its rule) or any other failure is shown as it is. */
  async function build(run: (p: HandoverPack) => void) {
    setBusy(true)
    setError(null)
    try {
      run(await buildPack(client, assetId, user, new Date()))
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e)
      setError(e instanceof SafeEdgeDeniedError ? `${text} (rule: ${e.rule})` : text)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="island panel" aria-labelledby="ho-h">
      <h2 id="ho-h">Handover pack</h2>
      <p className="hint">
        The asset, its edges’ passes, accepted re-tests, open findings and upkeep owner, for a receiving authority.
      </p>
      <label className="asset-field">
        Asset
        <select
          value={assetId}
          onChange={(e) => {
            setAssetId(e.target.value)
            setPack(null)
          }}
        >
          <option value="">Choose an asset</option>
          {assets?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row-actions">
        <button
          className="btn"
          type="button"
          disabled={!assetId || busy}
          aria-describedby="ho-why"
          onClick={() =>
            build((p) => download(`handover-${assetId}.json`, 'application/json', JSON.stringify(p, null, 2)))
          }
        >
          <DownloadSimple size={20} weight="bold" aria-hidden="true" /> Download JSON
        </button>
        <button
          className="btn"
          type="button"
          disabled={!assetId || busy}
          aria-describedby="ho-why"
          onClick={() => build(setPack)}
        >
          <Printer size={20} weight="bold" aria-hidden="true" /> Printable page
        </button>
      </div>
      <div className="card-foot">
        {!assetId && (
          <p className="hint" id="ho-why">
            Choose an asset first.
          </p>
        )}
        {busy && (
          <p className="hint" id="ho-why" role="status">
            Building the handover pack…
          </p>
        )}
        {error && (
          <p className="banner error" role="alert">
            <WarningCircle className="banner-icon" size={20} weight="bold" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
      {pack !== null && createPortal(<Handover pack={pack} onClose={() => setPack(null)} />, document.body)}
    </section>
  )
}
