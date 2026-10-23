import { loadFont } from '@remotion/fonts'
import { staticFile } from 'remotion'

for (const weight of ['400', '600', '700'])
  loadFont({
    family: 'Atkinson Hyperlegible Next',
    url: staticFile(`fonts/atkinson-hyperlegible-next-latin-${weight}-normal.woff2`),
    weight
  })
