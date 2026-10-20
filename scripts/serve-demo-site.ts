// Serves a build from `bun run build:demo-site <dir>` the way Vercel routes it, for the browser tests:
// `bun scripts/serve-demo-site.ts <dir> [port]`. Each route in config.json rewrites the path when its `src` matches,
// `{ handle: 'filesystem' }` serves the file, a path ending in / serves its index.html, and anything else is a 404.
import { join } from 'node:path'

const [dir, port = '4173'] = process.argv.slice(2)
if (!dir) throw new Error('Usage: bun scripts/serve-demo-site.ts <dir> [port]')
const output = join(dir, '.vercel/output')
const routes = (await Bun.file(join(output, 'config.json')).json()).routes as Array<
  { src: string; dest: string } | { handle: 'filesystem' }
>
const staticDir = join(output, 'static')

const fileFor = async (path: string) => {
  const file = Bun.file(join(staticDir, path.endsWith('/') ? `${path}index.html` : path))
  return (await file.exists()) ? file : null
}

Bun.serve({
  hostname: '127.0.0.1',
  port: Number(port),
  async fetch(request) {
    let path = decodeURIComponent(new URL(request.url).pathname)
    for (const route of routes) {
      if ('handle' in route) {
        const file = await fileFor(path)
        if (file) return new Response(file)
      } else if (new RegExp(route.src).test(path)) path = route.dest
    }
    return new Response('Not found', { status: 404 })
  }
})
console.log(`Serving ${staticDir} on http://127.0.0.1:${port}/`)
