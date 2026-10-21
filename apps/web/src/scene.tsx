// The scene's weights, self-hosted like the app's: the demo runs offline (PRD NFR-1).
import '@fontsource/atkinson-hyperlegible-next/400.css'
import '@fontsource/atkinson-hyperlegible-next/600.css'
import '@fontsource/atkinson-hyperlegible-next/700.css'
import '@fontsource/atkinson-hyperlegible-next/800.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ElminaScene } from './ElminaScene.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <ElminaScene />
  </StrictMode>
)
