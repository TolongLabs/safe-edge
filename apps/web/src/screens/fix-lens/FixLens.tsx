import { Placeholder } from '../../shell/Shell'

export function FixLens({ findingId }: { findingId: string | null }) {
  return (
    <Placeholder
      title="Fix Lens"
      context={findingId ? `Finding ${findingId}` : undefined}
      heading="Fix Lens arrives with #81"
    />
  )
}
