/** Empty slot for #84 (T84 replaces the body). */
export function HandoverSlot() {
  return (
    <section className="island panel slot" aria-labelledby="ho-h">
      <h2 id="ho-h">Handover pack</h2>
      <p className="hint">
        Asset, accepted tests, open findings and upkeep owner, for a receiving authority. Arrives with #84.
      </p>
      <button className="btn" disabled>
        Export handover pack
      </button>
      <p className="hint">Not built yet.</p>
    </section>
  )
}
