import { Placeholder } from '../../shell/Shell'

export function Retest({ workOrderId }: { workOrderId: string | null }) {
  return (
    <Placeholder
      title="Repair check"
      context={workOrderId ? `Work order ${workOrderId}` : undefined}
      heading="The repair check arrives with #82"
    />
  )
}
