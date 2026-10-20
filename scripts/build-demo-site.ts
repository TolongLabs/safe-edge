// Builds the public demo for Vercel as prebuilt output (Build Output API v3): the landing page at /, the web app in
// demo mode at /demo/. It fails if any secret from the environment (Bun loads .env) appears in the files.
//
//   bun run build:demo-site <dir>
//   vercel link --yes --project safe-edge --scope <team> --cwd <dir>   (once)
//   vercel deploy --prebuilt --prod --scope <team> --cwd <dir>
//
// <dir> must be outside this repository: inside it, `vercel link --yes` also connects the GitHub repo, which then
// builds every pull request. Only the built files upload.
import { $ } from 'bun'
import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const target = process.argv[2]
if (!target) throw new Error('Usage: bun run build:demo-site <dir outside the repository>')
if (resolve(target).startsWith(process.cwd()))
  throw new Error(`${target} is inside the repository; build the demo site outside it`)
const out = join(resolve(target), '.vercel/output')
const staticDir = join(out, 'static')

await $`rm -rf ${out}`
await $`bunx vite build --outDir ${staticDir} --emptyOutDir`.cwd('apps/site')
await $`bunx vite build --base /demo/ --outDir ${join(staticDir, 'demo')} --emptyOutDir`.cwd('apps/web')

await Bun.write(
  join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/sign-in/?$', dest: '/sign-in.html' },
        // The app's own index is a placeholder until the Edge Inbox lands, so /demo/ opens the Elmina scene.
        { src: '^/demo/?$', dest: '/demo/scene.html' },
        { handle: 'filesystem' }
      ]
    },
    null,
    2
  )
)

const secrets = Object.entries(process.env).filter(
  ([name, value]) => /KEY|TOKEN|SECRET|PASSWORD/i.test(name) && value && value.length >= 8
)
const files = (await readdir(staticDir, { recursive: true, withFileTypes: true })).filter((f) => f.isFile())
for (const file of files) {
  const path = join(file.parentPath, file.name)
  const text = await Bun.file(path).text()
  for (const [name, value] of secrets) {
    if (text.includes(value!)) throw new Error(`${path} contains the value of ${name}`)
  }
  if (/sk-ant-|AIza[0-9A-Za-z_-]{30}|ghp_[0-9A-Za-z]{30}|github_pat_|-----BEGIN [A-Z ]*PRIVATE KEY/.test(text))
    throw new Error(`${path} contains something shaped like a key`)
}
console.log(`${files.length} files in ${staticDir}, checked against ${secrets.length} secrets from the environment`)
