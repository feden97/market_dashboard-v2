import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchJson, finiteNumber } from '../src/utils/http.js'
import { normalizeFiatQuote, mergeLiveData, loadLiveData } from '../src/utils/liveData.js'
import { normalizeTasas } from '../src/utils/tasasData.js'
import { createResourcePoller } from '../src/utils/polling.js'

test('HTTP 200 error objects cannot masquerade as usable live data', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'upstream unavailable' }))
  const result = await loadLiveData()
  assert.equal(result.failedSources.length, 4)
  assert.deepEqual(result.raw, {})
  assert.equal(mergeLiveData(null, result.raw), null)
})

test('numeric inputs reject absent, non-finite and non-numeric financial values', () => {
  for (const value of [null, undefined, true, false, '', ' ', NaN, Infinity, 'Infinity', {}, []]) {
    assert.equal(finiteNumber(value), null)
  }
  assert.equal(finiteNumber('0.25'), 0.25)
  assert.equal(finiteNumber(0), 0)
})

test('fiat normalization accepts numeric strings and keeps missing variations unknown', () => {
  assert.deepEqual(normalizeFiatQuote({ al30: { '24hs': { price: '1250.25', variation: '-0.5' } } }), {
    price: 1250.25, var: -0.5,
  })
  assert.deepEqual(normalizeFiatQuote({ ask: 1200 }), { price: 1200, var: null })
  assert.deepEqual(normalizeFiatQuote({ price: -1, variation: 'oops' }), { price: null, var: null })
})

test('USDT ranks only usable quotes and never exposes Infinity when asks are missing', () => {
  const data = mergeLiveData(null, {
    crypto: {
      fiwind: { totalBid: '1210', totalAsk: '1230' },
      lemoncash: { totalBid: null, totalAsk: 0 },
      bybitp2p: { totalBid: 9999, totalAsk: 1 },
    },
    p2p: { totalBid: 1220, totalAsk: 1240 },
  })
  assert.equal(data.usdt.maxVenta, 1220)
  assert.equal(data.usdt.minCompra, 1230)
  assert.equal(data.usdt.exchanges.length, 3)
  assert.equal(mergeLiveData(null, { p2p: { totalBid: 1200 } }).usdt.minCompra, null)
  assert.equal(mergeLiveData(null, {}), null)
})

test('partial refresh keeps last valid quotes and old timestamps for inflation-only updates', () => {
  const oldTime = new Date('2026-10-26T12:00:00Z')
  const previous = mergeLiveData(null, {
    fiat: { ccl: { price: 1300, variation: 1 } },
    crypto: { fiwind: { totalAsk: 1250, totalBid: 1240 } },
  }, oldTime)
  const inflationOnly = mergeLiveData(previous, { inflation: [{ fecha: '2026-09-30', valor: 0.5 }] })
  assert.equal(inflationOnly.lastUpdated, oldTime)
  assert.deepEqual(inflationOnly.fiat.ccl, previous.fiat.ccl)
  assert.equal(inflationOnly.usdt.maxVenta, 1240)

  const refreshed = mergeLiveData(previous, {
    fiat: { mep: { price: 1280 }, ccl: { price: null } },
    p2p: { totalAsk: 1260, totalBid: 1250 },
  })
  assert.equal(refreshed.fiat.ccl.price, 1300)
  assert.equal(refreshed.fiat.mep.price, 1280)
  assert.equal(refreshed.usdt.exchanges.find(exchange => exchange.id === 'fiwind').venta_a, 1240)
})

test('proxy mode normalizes every exchange and keeps the upstream observation time', async () => {
  let calls = 0
  const result = await loadLiveData({
    proxyUrl: 'https://proxy.test/data',
    now: new Date('2026-10-27T12:00:30Z'),
    request: async () => {
      calls++
      return {
        status: 'ok', last_updated: '2026-10-27T12:00:00Z',
        fiat: { blue: { ask: 1300 } },
        usdt_raw: { exchanges: { fiwind: { totalAsk: 1250, totalBid: 1240 } }, p2p: { totalAsk: 1260 } },
        live_inflation: [{ fecha: '2026-09-30', valor: 0.5 }],
      }
    },
  })
  assert.equal(calls, 1)
  assert.deepEqual(result.failedSources, [])
  const data = mergeLiveData(null, result.raw)
  assert.equal(data.usdt.exchanges.length, 2)
  assert.equal(data.usdt.minCompra, 1250)
  assert.equal(data.lastUpdated.toISOString(), '2026-10-27T12:00:00.000Z')
})

test('a proxy outage falls back to direct providers and isolated failures remain visible', async () => {
  const urls = []
  const result = await loadLiveData({
    proxyUrl: 'https://proxy.test/data',
    request: async url => {
      urls.push(url)
      if (url === 'https://proxy.test/data' || url.includes('binancep2p')) throw new Error('offline')
      if (url.endsWith('/dolar')) return { ccl: { price: 1200 } }
      if (url.endsWith('/inflacion')) return [{ fecha: '2026-09-30', valor: 1.5 }]
      return { fiwind: { totalBid: 1250 } }
    },
  })
  assert.equal(urls.length, 5)
  assert.deepEqual(result.failedSources, ['Binance P2P'])
  assert.equal(mergeLiveData(null, result.raw).fiat.ccl.price, 1200)
})

test('cancellation never triggers fallback requests after a proxy request is aborted', async () => {
  const controller = new AbortController()
  let calls = 0
  await assert.rejects(loadLiveData({
    proxyUrl: 'https://proxy.test/data', signal: controller.signal,
    request: async () => {
      calls++
      controller.abort()
      throw controller.signal.reason
    },
  }), { name: 'AbortError' })
  assert.equal(calls, 1)
})

test('a proxy with expired, missing or future observation times falls back to live providers', async () => {
  const now = new Date('2026-10-27T12:00:00Z')
  for (const last_updated of ['2026-10-27T11:55:00Z', '2026-10-27T12:01:00Z', undefined, 'invalid']) {
    let calls = 0
    const result = await loadLiveData({
      proxyUrl: 'https://proxy.test/data', now,
      request: async url => {
        calls++
        if (url === 'https://proxy.test/data') return {
          status: 'ok', last_updated, fiat: { ccl: { price: 1 } }, usdt_raw: {},
        }
        if (url.endsWith('/dolar')) return { ccl: { price: 1300 } }
        return {}
      },
    })
    assert.equal(calls, 5)
    assert.equal(result.raw.fiat.ccl.price, 1300)
  }
})

test('degraded or explicitly stale proxy payloads use direct providers', async () => {
  for (const metadata of [{ status: 'degraded' }, { status: 'ok', stale: true }]) {
    let calls = 0
    const result = await loadLiveData({
      proxyUrl: 'https://proxy.test/data', now: new Date('2026-10-27T12:00:00Z'),
      request: async url => {
        calls++
        if (url === 'https://proxy.test/data') return {
          ...metadata, last_updated: '2026-10-27T11:59:50Z', fiat: { ccl: { price: 1 } }, usdt_raw: {},
        }
        if (url.endsWith('/dolar')) return { ccl: { price: 1300 } }
        return {}
      },
    })
    assert.equal(calls, 5)
    assert.equal(result.raw.fiat.ccl.price, 1300)
  }
})

test('bank and account normalization handles accents, numeric strings, duplicates and invalid rates', () => {
  const data = normalizeTasas({
    pfData: [
      { entidad: 'BANCO NACIÓN', tnaClientes: '0.25' },
      { entidad: 'BANCO NACION', tnaClientes: 0.3 },
      { entidad: 'BBVA', tnaClientes: 'oops' },
      { entidad: 123, tnaClientes: 0.5 },
      { entidad: 'MACRO', tnaClientes: -1 },
      null,
    ],
    remuData: [
      { fondo: 'Ualá Plus 1', tna: '0.4', tope: '1000000' },
      { fondo: 'UALA PLUS 1', tna: 0.35 },
      { fondo: 'FIWIND', tna: Infinity },
    ],
  })
  assert.equal(data.plazosFijos.length, 1)
  assert.deepEqual(data.bestPF, { name: 'Banco Nación', rate: '30.00' })
  assert.equal(data.cuentasRemuneradas.length, 1)
  assert.equal(data.cuentasRemuneradas[0].name, 'Ualá Plus 1')
  assert.equal(data.cuentasRemuneradas[0].limit, 'Límite: $1 M')
  assert.deepEqual(data.bestYield, { name: 'Ualá Plus 1', rate: '40.00' })
})

test('FCI annualization accounts for elapsed days and rejects invalid or identical dates', () => {
  const previous = { fondo: 'Allaria Ahorro - Clase E', fecha: '2026-10-23', vcp: '100' }
  const latest = { ...previous, fecha: '2026-10-26', vcp: '100.3' }
  const data = normalizeTasas({ fciUlt: [latest], fciPen: [previous] })
  assert.equal(data.fci.length, 1)
  assert.ok(Math.abs(data.fci[0].rate - 0.365) < 1e-10)
  for (const fecha of ['2026-10-23', 'invalid', '2026-02-30']) {
    assert.equal(normalizeTasas({ fciUlt: [{ ...latest, fecha }], fciPen: [previous] }).fci.length, 0)
  }
  assert.equal(normalizeTasas({ fciUlt: [latest], fciPen: [{ ...previous, vcp: 0 }] }).fci.length, 0)
})

test('yield rankings compare numbers rather than lexicographic strings and ignore invalid APYs', () => {
  const data = normalizeTasas({ rendData: [{ entidad: 'fiwind', rendimientos: [
    { moneda: 'USDT', apy: '9' }, { moneda: 'USDT', apy: '10' },
    { moneda: 'USDT', apy: Infinity }, { moneda: 'USDC', apy: 'not-a-number' },
  ] }] })
  assert.equal(data.yields.rateMap.Fiwind.USDT, 10)
  assert.equal(data.yields.tiersMap.Fiwind.USDT, true)
  assert.equal(data.yields.rateMap.Fiwind.USDC, null)
  assert.deepEqual(data.bestCrypto, { name: 'Fiwind', rate: '10.00', coin: 'USDT' })
})

test('malformed rate payloads produce safe complete empty structures', () => {
  const result = normalizeTasas({ pfData: {}, remuData: null, rendData: 'invalid', fciUlt: [{}] })
  assert.deepEqual(result.plazosFijos, [])
  assert.deepEqual(result.fci, [])
  assert.equal(result.bestCrypto, null)
  assert.equal(result.yields.rateMap.Fiwind.USDT, null)
})

test('JSON requests reject HTTP failures and malformed payloads', async context => {
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 503 }))
  await assert.rejects(fetchJson('https://example.test'), /HTTP 503/)
  fetchMock.mock.mockImplementation(async () => new Response('{}', { status: 200 }))
  await assert.rejects(fetchJson('https://example.test', { validate: Array.isArray }), /formato inesperado/)
})

test('JSON requests time out and propagate caller cancellation', async context => {
  context.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) reject(signal.reason)
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }))
  await assert.rejects(fetchJson('https://example.test', { timeoutMs: 5 }), /tardó demasiado/)
  const controller = new AbortController()
  const request = fetchJson('https://example.test', { signal: controller.signal })
  controller.abort()
  await assert.rejects(request, { name: 'AbortError' })
})

function pollingHarness(load) {
  const pendingTimers = new Map()
  const listeners = new Set()
  const results = []
  const errors = []
  let nextTimer = 0
  const visibility = {
    visibilityState: 'visible',
    addEventListener: (_name, listener) => listeners.add(listener),
    removeEventListener: (_name, listener) => listeners.delete(listener),
  }
  const timers = {
    setTimeout: (callback, ms) => { pendingTimers.set(++nextTimer, { callback, ms }); return nextTimer },
    clearTimeout: id => pendingTimers.delete(id),
  }
  const poller = createResourcePoller({
    load, intervalMs: 60_000, visibility, timers,
    onResult: result => results.push(result), onError: error => errors.push(error),
  })
  return { poller, pendingTimers, listeners, visibility, results, errors }
}

test('polling deduplicates requests and schedules again after success and synchronous failure', async () => {
  let calls = 0
  const harness = pollingHarness(() => {
    calls++
    if (calls === 2) throw new Error('provider offline')
    return { status: 'ok' }
  })
  const first = harness.poller.refresh()
  assert.equal(harness.poller.refresh(), first)
  await first
  assert.equal(calls, 1)
  assert.equal(harness.results.length, 1)
  assert.equal([...harness.pendingTimers.values()][0].ms, 60_000)

  const timer = [...harness.pendingTimers.values()][0]
  await timer.callback()
  assert.equal(calls, 2)
  assert.equal(harness.errors[0].message, 'provider offline')
  assert.equal(harness.pendingTimers.size, 1)

  await harness.poller.refresh()
  assert.equal(calls, 3)
  assert.equal(harness.results.length, 2)
  harness.poller.stop()
  assert.equal(harness.pendingTimers.size, 0)
})

test('polling pauses while hidden and refreshes immediately when visible again', async () => {
  let calls = 0
  const harness = pollingHarness(async () => ++calls)
  await harness.poller.refresh()
  assert.equal(harness.pendingTimers.size, 1)
  harness.visibility.visibilityState = 'hidden'
  for (const listener of harness.listeners) listener()
  assert.equal(harness.pendingTimers.size, 0)
  harness.visibility.visibilityState = 'visible'
  for (const listener of harness.listeners) listener()
  await harness.poller.refresh()
  assert.equal(calls, 2)
  assert.equal(harness.pendingTimers.size, 1)
  harness.poller.stop()
  assert.equal(harness.listeners.size, 0)
})

test('polling cleanup aborts pending work, suppresses late updates and removes listeners', async () => {
  let resolve
  let signal
  const harness = pollingHarness(options => {
    signal = options.signal
    return new Promise(done => { resolve = done })
  })
  const request = harness.poller.refresh()
  await Promise.resolve()
  harness.poller.stop()
  assert.equal(signal.aborted, true)
  resolve({ status: 'ok' })
  await request
  assert.deepEqual(harness.results, [])
  assert.deepEqual(harness.errors, [])
  assert.equal(harness.pendingTimers.size, 0)
  assert.equal(harness.listeners.size, 0)
})

test('an immediately disposed polling effect starts no network request', async () => {
  let calls = 0
  const harness = pollingHarness(async () => ++calls)
  const request = harness.poller.refresh()
  harness.poller.stop()
  await request
  assert.equal(calls, 0)
  assert.equal(harness.pendingTimers.size, 0)
})
