import { Placeholder } from '../../../shell/Shell'

export function PassIssued({ passId }: { passId: string }) {
  return <Placeholder title="Pass issued" context={`Pass ${passId}`} heading="Pass issued arrives with #82" />
}
