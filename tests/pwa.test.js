import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { resetAppCache } from '../src/utils/pwa.js'

function browser(t, { registrations = [], cacheNames = [] } = {}) {
  const saved = Object.fromEntries(['window', 'navigator', 'caches'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  const removed = []
  const caches = { keys: async () => cacheNames, delete: async (name) => { removed.push(name); return true } }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { href: 'https://example.com/dashboard/index.html?tab=tasas' }, caches } })
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: caches })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: { getRegistrations: async () => registrations } } })
  t.after(() => {
    for (const [name, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  })
  return removed
}

test('recovery unregisters only this app worker and removes only its caches', async (t) => {
  const unregistered = []
  const removed = browser(t, {
    registrations: ['https://example.com/dashboard/', 'https://example.com/other-app/'].map((scope) => ({
      scope, unregister: async () => { unregistered.push(scope); return true },
    })),
    cacheNames: [
      'dashboard-financiero-%2Fdashboard%2F-v5',
      'dashboard-financiero-%2Fother-app%2F-v5',
      'dashboard-financiero-v2-cache-v4',
      'other-app-cache',
    ],
  })
  await resetAppCache('./')
  assert.deepEqual(unregistered, ['https://example.com/dashboard/'])
  assert.deepEqual(removed, ['dashboard-financiero-%2Fdashboard%2F-v5', 'dashboard-financiero-v2-cache-v4'])
})

test('a rejected worker unregister does not prevent removing stale app cache', async (t) => {
  const removed = browser(t, {
    registrations: [{ scope: 'https://example.com/dashboard/', unregister: async () => { throw new Error('unregister unavailable') } }],
    cacheNames: ['dashboard-financiero-%2Fdashboard%2F-v5'],
  })
  await resetAppCache('./')
  assert.equal(removed.length, 1)
})

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const themeScript = html.match(/<script>([\s\S]*?)<\/script>/)[1]

function initialTheme({ saved, blocked = false, dark = true } = {}) {
  const attributes = {}
  const style = {}
  vm.runInNewContext(themeScript, {
    localStorage: { getItem: () => { if (blocked) throw new Error('Storage blocked'); return saved } },
    window: { matchMedia: () => ({ matches: dark }) },
    document: { documentElement: { setAttribute: (name, value) => { attributes[name] = value }, style } },
  })
  return { theme: attributes['data-theme'], colorScheme: style.colorScheme }
}

test('initial theme uses saved valid preferences', () => {
  assert.deepEqual(initialTheme({ saved: 'light', dark: true }), { theme: 'light', colorScheme: 'light' })
})

test('blocked browser storage still applies the system theme without crashing', () => {
  assert.deepEqual(initialTheme({ blocked: true, dark: false }), { theme: 'light', colorScheme: 'light' })
})

test('invalid persisted themes fall back to system preference', () => {
  assert.deepEqual(initialTheme({ saved: 'invalid', dark: true }), { theme: 'dark', colorScheme: 'dark' })
})

const cleanupScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1]

async function devCleanup({ dev = true, controlled = true, ownWorker = true } = {}) {
  const removed = []
  let reloads = 0
  const scope = 'https://example.com/dashboard/'
  const registrations = [
    ...(ownWorker ? [{ scope, unregister: async () => { removed.push(scope); return true } }] : []),
    { scope: 'https://example.com/other-app/', unregister: async () => { removed.push('other'); return true } },
  ]
  vm.runInNewContext(cleanupScript.replace('%DEV%', dev ? 'true' : 'false'), {
    URL, console,
    navigator: { serviceWorker: { controller: controlled ? {} : null, getRegistrations: async () => registrations } },
    window: { location: { href: `${scope}index.html`, reload: () => { reloads++ } } },
  })
  await new Promise((resolve) => setImmediate(resolve))
  return { removed, reloads }
}

test('development bootstrap removes only its worker before importing app modules and reloads once', async () => {
  assert.deepEqual(await devCleanup(), { removed: ['https://example.com/dashboard/'], reloads: 1 })
})

test('an uncontrolled development document does not enter a reload loop', async () => {
  assert.deepEqual(await devCleanup({ controlled: false }), { removed: ['https://example.com/dashboard/'], reloads: 0 })
  assert.deepEqual(await devCleanup({ ownWorker: false }), { removed: [], reloads: 0 })
})

test('production bootstrap never unregisters its worker', async () => {
  assert.deepEqual(await devCleanup({ dev: false }), { removed: [], reloads: 0 })
})
