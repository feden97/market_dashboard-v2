import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
const scope = 'https://example.com/dashboard/'
const activeCache = 'dashboard-financiero-%2Fdashboard%2F-v5-__BUILD_REVISION__'
const indexUrl = `${scope}index.html`

function worker({ fetchImpl = async () => new Response('network'), initialCaches = {} } = {}) {
  const listeners = {}
  const stores = new Map(Object.entries(initialCaches).map(([name, entries]) => [name, new Map(entries)]))
  const deleted = []
  const added = []
  let claimed = false
  const key = (request) => typeof request === 'string' ? request : request.url
  const fetch = (...args) => fetchImpl(...args)
  const cacheFor = (name) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)
    return {
      match: async (request) => store.get(key(request))?.clone(),
      put: async (request, response) => { store.set(key(request), response) },
      add: async (url) => {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        added.push(url)
        store.set(url, response)
      },
    }
  }
  const context = {
    URL, fetch,
    caches: {
      open: async (name) => cacheFor(name),
      keys: async () => [...stores.keys()],
      delete: async (name) => { deleted.push(name); return stores.delete(name) },
    },
    self: {
      registration: { scope },
      clients: { claim: async () => { claimed = true } },
      addEventListener: (name, listener) => { listeners[name] = listener },
    },
  }
  vm.runInNewContext(source, context)
  return {
    stores, deleted, added,
    get claimed() { return claimed },
    async lifecycle(name) {
      let task
      listeners[name]({ waitUntil: (promise) => { task = promise } })
      await task
    },
    request(url, overrides = {}) {
      let task
      listeners.fetch({
        request: { url, method: 'GET', mode: 'cors', ...overrides },
        respondWith: (promise) => { task = promise },
      })
      return task
    },
  }
}

test('activation removes only this app scope and known legacy caches', async () => {
  const sw = worker({ initialCaches: {
    [activeCache]: [],
    'dashboard-financiero-%2Fdashboard%2F-v4': [],
    'dashboard-financiero-%2Fother-app%2F-v4': [],
    'dashboard-financiero-v2-cache-v4': [],
    'another-application': [],
  } })
  await sw.lifecycle('activate')
  assert.deepEqual(sw.deleted.sort(), [
    'dashboard-financiero-%2Fdashboard%2F-v4', 'dashboard-financiero-v2-cache-v4',
  ])
  assert.equal(sw.claimed, true)
})

test('external APIs, other apps, and non-GET requests bypass the worker', () => {
  const sw = worker()
  for (const url of [
    'https://criptoya.com/api/dolar',
    'https://api.argentinadatos.com/v1/finanzas/rendimientos',
    'https://proxy.onrender.com/',
    'https://example.com/other-app/assets/app.js',
    `${scope}unrelated-endpoint`,
  ]) assert.equal(sw.request(url), undefined)
  assert.equal(sw.request(`${scope}data/snapshot.json`, { method: 'POST' }), undefined)
})

test('HTML navigations use fresh network content instead of a stale app shell', async () => {
  const sw = worker({ initialCaches: { [activeCache]: [[indexUrl, new Response('old')]] } })
  const response = await sw.request(`${scope}?tab=tasas`, { mode: 'navigate' })
  assert.equal(await response.text(), 'network')
  assert.equal(await sw.stores.get(activeCache).get(indexUrl).clone().text(), 'network')
})

test('offline navigation falls back to the app shell without depending on query parameters', async () => {
  const sw = worker({
    fetchImpl: async () => { throw new TypeError('offline') },
    initialCaches: { [activeCache]: [[indexUrl, new Response('cached shell')]] },
  })
  const response = await sw.request(`${scope}?tab=dolares`, { mode: 'navigate' })
  assert.equal(await response.text(), 'cached shell')
})

test('offline requests without a matching cached resource fail instead of receiving another JSON schema', async () => {
  const sw = worker({
    fetchImpl: async () => { throw new TypeError('offline') },
    initialCaches: { [activeCache]: [[`${scope}data/snapshot.json`, new Response('{"snapshot":true}')]] },
  })
  await assert.rejects(sw.request(`${scope}data/events.json`), /offline/)
})

test('snapshot requests prefer network and preserve exact query keys', async () => {
  const url = `${scope}data/snapshot.json?version=2`
  const sw = worker({ initialCaches: { [activeCache]: [[`${scope}data/snapshot.json`, new Response('old')]] } })
  const response = await sw.request(url)
  assert.equal(await response.text(), 'network')
  assert.equal(await sw.stores.get(activeCache).get(url).clone().text(), 'network')
})

test('a failed snapshot response can fall back only to that snapshot', async () => {
  const url = `${scope}data/snapshot.json`
  const sw = worker({
    fetchImpl: async () => new Response('unavailable', { status: 503 }),
    initialCaches: { [activeCache]: [[url, new Response('last snapshot')]] },
  })
  assert.equal(await (await sw.request(url)).text(), 'last snapshot')
})

test('an HTTP failure without an exact cached response stays an HTTP failure', async () => {
  const sw = worker({ fetchImpl: async () => new Response('unavailable', { status: 503 }) })
  assert.equal((await sw.request(`${scope}data/snapshot.json`)).status, 503)
})

test('hashed bundles use cache and a different hash fetches its own content', async () => {
  const oldUrl = `${scope}assets/index-old123.js`
  let fetches = 0
  const sw = worker({
    fetchImpl: async () => { fetches++; return new Response('new bundle') },
    initialCaches: { [activeCache]: [[oldUrl, new Response('old bundle')]] },
  })
  assert.equal(await (await sw.request(oldUrl)).text(), 'old bundle')
  assert.equal(fetches, 0)
  assert.equal(await (await sw.request(`${scope}assets/index-new456.js`)).text(), 'new bundle')
  assert.equal(fetches, 1)
})

test('installation precaches HTML dependencies for offline launch and ignores external scripts', async () => {
  const sw = worker({ fetchImpl: async (url) => new Response(url.endsWith('precache-manifest.json')
    ? JSON.stringify({ assets: ['assets/index-abc123.js', 'assets/index-def456.css', 'assets/lazy-tab-123.js'] }) : url === indexUrl ? `
    <script type="module" src="./assets/index-abc123.js"></script>
    <link rel="stylesheet" href="./assets/index-def456.css">
    <script src="https://external.example.com/script.js"></script>
  ` : 'asset') })
  await sw.lifecycle('install')
  assert.ok(sw.stores.get(activeCache).has(indexUrl))
  assert.ok(sw.added.includes(`${scope}assets/index-abc123.js`))
  assert.ok(sw.added.includes(`${scope}assets/index-def456.css`))
  assert.ok(sw.added.includes(`${scope}assets/lazy-tab-123.js`))
  assert.equal(sw.added.some((url) => url.includes('external.example.com')), false)
})

test('a missing mandatory app bundle rejects installation and keeps the previous worker', async () => {
  const sw = worker({ fetchImpl: async (url) => new Response(
    url.endsWith('precache-manifest.json') ? JSON.stringify({ assets: ['assets/missing.js'] })
      : url === indexUrl ? '<script src="./assets/missing.js"></script>' : '',
    { status: url.endsWith('missing.js') ? 404 : 200 },
  ) })
  await assert.rejects(sw.lifecycle('install'), /HTTP 404/)
})

test('an invalid manifest cannot cache another origin or escape the app scope', async () => {
  for (const asset of ['https://elsewhere.example.com/script.js', '../other/script.js', 'assets/not-a-bundle.json']) {
    const sw = worker({ fetchImpl: async (url) => new Response(url.endsWith('precache-manifest.json')
      ? JSON.stringify({ assets: [asset] }) : '') })
    await assert.rejects(sw.lifecycle('install'), /Precache asset outside app scope|Invalid precache asset/)
  }
})

test('an HTML/manifest deployment mismatch cannot replace the offline app shell', async () => {
  const sw = worker({ fetchImpl: async (url) => new Response(url.endsWith('precache-manifest.json')
    ? JSON.stringify({ assets: ['assets/different-release.js'] })
    : '<script src="./assets/current-release.js"></script>') })
  await assert.rejects(sw.lifecycle('install'), /do not match/)
})
