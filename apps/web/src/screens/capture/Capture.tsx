import { Placeholder } from '../../shell/Shell'

export function Capture({ segmentId }: { segmentId: string | null }) {
  return (
    <Placeholder
      title="Capture"
      context={segmentId ? `Segment ${segmentId}` : undefined}
      heading="Phone capture arrives with #87"
    />
  )
}
