import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FIWIND_API, buildFiwindSeries, fiwindAxisRange, fiwindChartPoints, fiwindView, loadFiwindHistory, loadFiwindLive,
  normalizeFiwindHistory, normalizeFiwindQuote,
} from '../src/utils/fiwind.js'

const now = Date.parse('2026-11-06T15:00:00Z')
const quote = (secondsAgo = 0, bid = 1.035, ask = 1.04) => ({ time: now / 1000 - secondsAgo, bid, ask })
const history = quotes => ({ version: 1, source: FIWIND_API, interval_seconds: 900, quotes })

test('Fiwind axis covers both prices with distinct three-decimal ticks, even for flat data', () => {
  for (const [bid, ask] of [[1.055, 1.063], [1.055, 1.055], [1.0551, 1.0552], [0.8, 1.4]]) {
    const { min, max, stepSize } = fiwindAxisRange([quote(0, bid, ask)])
    assert.ok(min < bid && max > ask)
    assert.ok(stepSize >= 0.001)
    const labels = []
    for (let value = min; value <= max + 1e-9; value += stepSize) labels.push(value.toFixed(3))
    assert.equal(new Set(labels).size, labels.length)
    assert.ok(labels.length <= 7)
  }
  assert.equal(fiwindAxisRange([quote(0, 1.055, 1.063)]).stepSize, 0.005)
  const selected = fiwindAxisRange([quote(0, 1.055, 1.063)], 'bid')
  assert.deepEqual(selected, { min: 1.054, max: 1.056, stepSize: 0.001 })
  assert.equal(fiwindAxisRange([]).min, undefined)
})

test('direction summaries distinguish stored samples from the fresh current point', () => {
  const rows = [quote(25 * 3600, 1.01, 1.015), quote(3600, 1.03, 1.04), quote(900, 1.035, 1.042)]
  const current = quote(30, 1.038, 1.045)
  const bid = buildFiwindSeries(rows, current, 24, now, 'bid')
  const ask = buildFiwindSeries(rows, current, 24, now, 'ask')
  assert.equal(bid.savedCount, 2)
  assert.equal(bid.observedCount, 3)
  assert.equal(bid.savedMin, 1.03)
  assert.equal(bid.savedMax, 1.035)
  assert.equal(bid.observedMin, 1.03)
  assert.equal(bid.observedMax, 1.038)
  assert.equal(ask.observedMin, 1.04)
  assert.equal(ask.observedMax, 1.045)
  assert.ok(Math.abs(bid.change - 0.008) < 1e-12)
  assert.ok(Math.abs(ask.changePercent - (1.045 / 1.04 - 1) * 100) < 1e-12)
  assert.equal(bid.firstTime, rows[1].time)
  assert.equal(bid.lastTime, current.time)
  assert.equal(bid.lastSavedTime, rows[2].time)
  assert.equal(bid.hasLivePoint, true)
  assert.deepEqual(rows[2], quote(900, 1.035, 1.042))
})

test('sparse flat history retains gaps and never claims continuity or changes from one point', () => {
  const rows = [quote(17 * 3600), quote(9 * 3600), quote(3600)]
  const sparse = buildFiwindSeries(rows, quote(600), 24, now, 'bid')
  assert.equal(sparse.gapCount, 2)
  assert.equal(sparse.isFlat, true)
  assert.equal(sparse.savedCount, 3)
  assert.equal(sparse.observedCount, 3)
  assert.equal(sparse.change, 0)
  assert.equal(sparse.hasLivePoint, false)
  const points = fiwindChartPoints(sparse.chartQuotes, 'bid')
  assert.equal(points.filter(point => point.y === null).length, 2)
  assert.equal(points.filter(point => point.y !== null).length, 3)
  const single = buildFiwindSeries([], quote(30), 24, now)
  assert.equal(single.observedCount, 1)
  assert.equal(single.savedCount, 0)
  assert.equal(single.change, null)
  assert.equal(single.changePercent, null)
  assert.equal(single.isFlat, false)
  const empty = buildFiwindSeries([], quote(600), 24, now)
  assert.equal(empty.observedCount, 0)
  assert.equal(empty.observedMin, null)
  assert.equal(empty.firstTime, null)
})

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

test('history URL preserves custom paths and refreshes its cache key every 5 minutes', async () => {
  const controller = new AbortController()
  const result = await loadFiwindHistory({ url: 'https://data.test/fiwind.json?key=value', now, signal: controller.signal, request: async (url, options) => {
    const parsed = new URL(url)
    assert.equal(parsed.searchParams.get('key'), 'value')
    assert.equal(parsed.searchParams.get('v'), String(Math.floor(now / 300_000)))
    assert.equal(options.signal, controller.signal)
    return history([quote()])
  } })
  assert.deepEqual(result.data, [quote()])
})

test('current quote chooses the newest source but the chart contains durable samples only', () => {
  const rows = [quote(25 * 3600, 1.02), quote(3600, 1.03), quote(900, 1.036)]
  const view = fiwindView(rows, quote(30, 1.037), 24, now)
  assert.deepEqual(view.quotes, rows.slice(1))
  assert.deepEqual(view.chartQuotes.at(-1), { ...quote(30, 1.037), live: true })
  assert.equal(view.chartQuotes.length, view.quotes.length + 1)
  assert.equal(view.latest.bid, 1.037)
  assert.equal(view.min, 1.03)
  assert.equal(view.max, 1.036)
  assert.equal(view.fresh, true)
  assert.ok(Math.abs(view.premium - 3.7) < 1e-10)
  const fallback = fiwindView(rows, quote(1800), 24, now)
  assert.deepEqual(fallback.latest, rows.at(-1))
  assert.equal(fallback.fresh, false)
  assert.deepEqual(fallback.chartQuotes, fallback.quotes)
  assert.equal(fiwindView([], null, 24, now).min, null)
  assert.equal(fiwindView(rows, null, 168, now).quotes.length, 3)
})

test('time scale shows outages without interpolating across missing scheduled samples', () => {
  const rows = [quote(10800), quote(9900), quote()]
  const points = fiwindChartPoints(rows, 'bid')
  assert.equal(points.length, 4)
  assert.equal(points[2].y, null)
  assert.equal(points[3].x, now)
  assert.equal(points[3].y, rows[2].bid)
})

