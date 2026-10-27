import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname } from 'node:path'
import vm from 'node:vm'

// Exercise the emitted worker against the actual production files over HTTP.
// CacheStorage is modeled in memory; this does not replace browser lifecycle QA.
const dist = new URL('../dist/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('precache-manifest.json', dist), 'utf8'))
const workerSource = await readFile(new URL('sw.js', dist), 'utf8')
assert.ok(!workerSource.includes('__BUILD_REVISION__'), 'Build must stamp a worker revision')
assert.ok(manifest.assets.length > 0, 'Build manifest must list JS/CSS')
const files = new Map()
for (const file of ['index.html', 'manifest.json', 'data/snapshot.json', 'precache-manifest.json',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png', ...manifest.assets]) {
  files.set(`/dashboard/${file}`, await readFile(new URL(file, dist)))
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' }
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  const body = files.get(path)
  response.writeHead(body ? 200 : 404, { 'Content-Type': mime[extname(path)] || 'text/plain' })
  response.end(body || 'Not found')
})
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})

try {
  const scope = `http://127.0.0.1:${server.address().port}/dashboard/`
  const stores = new Map()
  const listeners = {}
  let offline = false
  const cacheKey = (request) => typeof request === 'string' ? request : request.url
  const fetchFile = (request, options) => {
    if (offline) return Promise.reject(new TypeError('Offline integration test'))
    return fetch(cacheKey(request), options)
  }
  vm.runInNewContext(workerSource, {
    URL,
    fetch: fetchFile,
    self: {
      registration: { scope },
      clients: { claim: async () => {} },
      addEventListener: (event, listener) => { listeners[event] = listener },
    },
    caches: {
      keys: async () => [...stores.keys()],
      delete: async (name) => stores.delete(name),
      open: async (name) => {
        if (!stores.has(name)) stores.set(name, new Map())
        const store = stores.get(name)
        return {
          match: async (request) => store.get(cacheKey(request))?.clone(),
          put: async (request, response) => { store.set(cacheKey(request), response) },
          add: async (url) => {
            const response = await fetchFile(url)
            assert.equal(response.status, 200, `Precache resource missing: ${url}`)
            store.set(url, response)
          },
        }
      },
    },
  })
  let install
  listeners.install({ waitUntil: (task) => { install = task } })
  await install
  const [cache] = stores.values()
  for (const asset of manifest.assets) {
    assert.ok(cache.has(new URL(asset, scope).href), `Build chunk not precached: ${asset}`)
  }
  offline = true
  let navigation
  listeners.fetch({ request: { url: `${scope}?tab=dolares`, method: 'GET', mode: 'navigate' }, respondWith: (task) => { navigation = task } })
  const shell = await navigation
  assert.equal(await shell.text(), files.get('/dashboard/index.html').toString('utf8'))
  for (const asset of manifest.assets) {
    let task
    listeners.fetch({ request: { url: new URL(asset, scope).href, method: 'GET', mode: 'cors' }, respondWith: (response) => { task = response } })
    const response = await task
    assert.equal(response.status, 200, `Offline chunk not served: ${asset}`)
    assert.equal(await response.text(), files.get(`/dashboard/${asset}`).toString('utf8'))
  }
  console.log(`PWA production verification passed: stamped worker, ${manifest.assets.length} real JS/CSS assets cached, offline shell and every chunk served under /dashboard/.`)
} finally {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}
