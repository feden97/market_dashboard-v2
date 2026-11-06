import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FIWIND_API, fiwindChartPoints, fiwindView, loadFiwindHistory, loadFiwindLive,
  normalizeFiwindHistory, normalizeFiwindQuote,
} from '../src/utils/fiwind.js'

const now = Date.parse('2026-11-06T15:00:00Z')
const quote = (secondsAgo = 0, bid = 1.035, ask = 1.04) => ({ time: now / 1000 - secondsAgo, bid, ask })
const history = quotes => ({ version: 1, source: FIWIND_API, interval_seconds: 900, quotes })

test('Fiwind uses USD bid/ask as in the bot, without inverting them or using ARS/total prices', async () => {
  const result = await loadFiwindLive({ now, request: async url => {
    assert.equal(url, FIWIND_API)
    return { ...quote(), bid: '1.035', ask: '1.04', totalBid: 1.03, totalAsk: 1.05 }
  } })
  assert.deepEqual(result.data, quote())
})

test('Fiwind rejects corrupt and stale quotes instead of reporting live success', async () => {
  for (const value of [null, {}, quote(181), quote(-61), quote(0, true), quote(0, null), quote(0, 1.1, 1.0), quote(0, 0.5), quote(0, 1, Infinity)]) {
    assert.equal(normalizeFiwindQuote(value, now, true), null)
  }
  assert.ok(normalizeFiwindQuote(quote(180), now, true))
  await assert.rejects(loadFiwindLive({ now, request: async () => quote(181) }), /reciente/)
})

test('history validates provenance and sorts/deduplicates observations while keeping real timestamps', () => {
  assert.deepEqual(normalizeFiwindHistory(history([quote(), quote(900), quote(), null, quote(-120)]), now), [quote(900), quote()])
  assert.throws(() => normalizeFiwindHistory({ ...history([]), source: 'ARS endpoint' }, now), /formato/)
  assert.throws(() => normalizeFiwindHistory({}, now), /formato/)
})

test('history URL preserves custom paths and refreshes its cache key every 15 minutes', async () => {
  const controller = new AbortController()
  const result = await loadFiwindHistory({ url: 'https://data.test/fiwind.json?key=value', now, signal: controller.signal, request: async (url, options) => {
    const parsed = new URL(url)
    assert.equal(parsed.searchParams.get('key'), 'value')
    assert.equal(parsed.searchParams.get('v'), String(Math.floor(now / 900_000)))
    assert.equal(options.signal, controller.signal)
    return history([quote()])
  } })
  assert.deepEqual(result.data, [quote()])
})

test('current quote chooses the newest source but the chart contains durable samples only', () => {
  const rows = [quote(25 * 3600, 1.02), quote(3600, 1.03), quote(900, 1.036)]
  const view = fiwindView(rows, quote(30, 1.037), 24, now)
  assert.deepEqual(view.quotes, rows.slice(1))
  assert.equal(view.latest.bid, 1.037)
  assert.equal(view.min, 1.03)
  assert.equal(view.max, 1.036)
  assert.equal(view.fresh, true)
  assert.ok(Math.abs(view.premium - 3.7) < 1e-10)
  const fallback = fiwindView(rows, quote(1800), 24, now)
  assert.deepEqual(fallback.latest, rows.at(-1))
  assert.equal(fallback.fresh, false)
  assert.equal(fiwindView([], null, 24, now).min, null)
  assert.equal(fiwindView(rows, null, 168, now).quotes.length, 3)
})

test('time scale shows outages without interpolating across missing scheduled samples', () => {
  const rows = [quote(4500), quote(3600), quote()]
  const points = fiwindChartPoints(rows, 'bid')
  assert.equal(points.length, 4)
  assert.equal(points[2].y, null)
  assert.equal(points[3].x, now)
  assert.equal(points[3].y, rows[2].bid)
})

