import './fonts'
import { Composition } from 'remotion'
import { DEMO_FRAMES, Demo } from './Demo'

export const Root = () => (
  <Composition id="Demo" component={Demo} durationInFrames={DEMO_FRAMES} fps={30} width={1920} height={1080} />
)
