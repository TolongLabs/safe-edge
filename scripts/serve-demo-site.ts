// Serves a build from `bun run build:demo-site <dir>` the way Vercel routes it, for the browser tests:
// `bun scripts/serve-demo-site.ts <dir> [port]`. Each route in config.json rewrites the path when its `src` matches,
// `{ handle: 'filesystem' }` serves the file, and a path ending in / serves its index.html. A path with no file
// goes to the routes after `{ handle: 'error' }`: the first whose `src` matches answers with its file and status.
import { join } from 'node:path'

type Route = { src: string; dest: string; status?: number } | { handle: 'filesystem' | 'error' }

const [dir, port = '4173'] = process.argv.slice(2)
if (!dir) throw new Error('Usage: bun scripts/serve-demo-site.ts <dir> [port]')
const output = join(dir, '.vercel/output')
const routes = (await Bun.file(join(output, 'config.json')).json()).routes as Route[]
const errorAt = routes.findIndex((route) => 'handle' in route && route.handle === 'error')
const [found, missing] = errorAt < 0 ? [routes, []] : [routes.slice(0, errorAt), routes.slice(errorAt + 1)]
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
    for (const route of found) {
      if ('handle' in route) {
        const file = await fileFor(path)
        if (file) return new Response(file)
      } else if (new RegExp(route.src).test(path)) path = route.dest
    }
    for (const route of missing) {
      if ('handle' in route || !new RegExp(route.src).test(path)) continue
      const file = await fileFor(route.dest)
      if (!file) throw new Error(`config.json sends missing paths to ${route.dest}, which is not in the build`)
      return new Response(file, { status: route.status ?? 404 })
    }
    return new Response('Not found', { status: 404 })
  }
})
console.log(`Serving ${staticDir} on http://127.0.0.1:${port}/`)
