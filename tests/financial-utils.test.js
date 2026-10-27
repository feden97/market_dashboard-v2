import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calcBrecha, calcIpcStats, formatARS, formatDate, formatLimit,
  getLast12IPC, mergeIpcHistory, toFiniteNumber, varInfo,
} from '../src/utils/format.js'
import {
  buildBandasChartData, generateDatosBandas, getBandaForToday,
  getGaugePosition, getZoneInfo,
} from '../src/utils/bandas.js'
import { buildSpreadData } from '../src/utils/spread.js'

test('missing or corrupt market values never render as zero, NaN or Infinity', () => {
  for (const value of [null, undefined, '', ' ', 'bad', NaN, Infinity, -Infinity, {}, true]) {
    assert.equal(toFiniteNumber(value), null)
    assert.equal(formatARS(value), '—')
    assert.equal(varInfo(value).text, '—')
    assert.equal(calcBrecha(value, 100), null)
  }
  assert.equal(formatARS(0), '$0,00')
  assert.equal(formatARS('1234.5'), '$1.234,50')
  assert.equal(varInfo('2.5').text, '+2.50%')
  assert.ok(Math.abs(calcBrecha(110, 100) - 10) < 1e-10)
  assert.equal(calcBrecha(100, 0), null)
  assert.equal(calcBrecha(-1, 100), null)
  assert.equal(calcBrecha(Number.MAX_VALUE, Number.MIN_VALUE), null)
})

test('limits preserve meaningful fractions and calendar dates do not shift timezones', () => {
  assert.equal(formatLimit(1_500_000), '$1,5 M')
  assert.equal(formatLimit(500), '$500')
  assert.equal(formatLimit(0), null)
  assert.equal(formatDate('2026-03-25'), '25/03/2026')
  assert.equal(formatDate('2026-03-25T00:00:00Z'), '25/03/2026')
  assert.equal(formatDate(null), '')
})

test('API inflation percentages are converted consistently below, equal to and above one', () => {
  const snapshot = { '2026-01': 0.02, '2026-02': 0.025, '2026-03': 0.03 }
  const merged = mergeIpcHistory(snapshot, [
    { fecha: '2026-02-28', valor: 0.5 },
    { fecha: '2026-03-31', valor: 1 },
    { fecha: '2026-04-30', valor: '2.5' },
    { fecha: '2026-05-31', valor: 0 },
    { fecha: '2026-06-30', valor: -0.5 },
    { fecha: '2026-07-31', valor: Infinity },
    { fecha: '2026-13-01', valor: 2 },
  ])
  assert.deepEqual(merged, {
    '2026-01': 0.02, '2026-02': 0.005, '2026-03': 0.01,
    '2026-04': 0.025, '2026-05': 0, '2026-06': -0.005,
  })
  assert.equal(snapshot['2026-02'], 0.025, 'input remains immutable')
})

test('IPC selects twelve valid chronological months and compounds without early rounding', () => {
  const history = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`2025-${String(i + 1).padStart(2, '0')}`, 0.01234]))
  history['2026-01'] = 0.02
  history['2026-02'] = null
  history.bad = 0.5
  const months = getLast12IPC(history)
  assert.equal(months.length, 12)
  assert.equal(months[0].key, '2025-02')
  assert.equal(months.at(-1).key, '2026-01')
  assert.equal(months[0].pct, 1.234)
  const stats = calcIpcStats(months)
  assert.ok(Math.abs(stats.acum12m - ((1.01234 ** 11 * 1.02 - 1) * 100)) < 1e-9)
  assert.deepEqual(getLast12IPC(null), [])
})

test('spread sorts and deduplicates YTD history, replaces today with live and counts same series', () => {
  const now = new Date(2026, 2, 25)
  const history = [
    { date: '25-03-2026', ccl: 90, usdt: 100 },
    { date: '24-03-2026', ccl: 90, usdt: 100 },
    { date: '24-03-2026', ccl: 95, usdt: 100 },
    { date: '31-12-2025', ccl: 110, usdt: 100 },
    { date: '26-03-2026', ccl: 110, usdt: 100 },
    { date: '31-02-2026', ccl: 110, usdt: 100 },
    { date: '23-03-2026', ccl: NaN, usdt: 100 },
  ]
  const live = { fiat: { ccl: { price: 110 } }, usdt: { maxVenta: 100 } }
  const series = buildSpreadData(history, live, 'usdt', now)
  assert.deepEqual(series.labels, ['24-03-2026', '25-03-2026'])
  assert.deepEqual(series.data, [-5, 10])
  assert.deepEqual(series.summary, { cclWins: 1, baseWins: 1 })
  assert.equal(history[0].ccl, 90)
})

test('spread works with live-only fiat and no USDT; invalid live preserves history', () => {
  const now = new Date(2026, 2, 25)
  assert.deepEqual(buildSpreadData(null, { fiat: { ccl: { price: 110 }, mep: { price: 100 } } }, 'mep', now).data, [10])
  assert.deepEqual(buildSpreadData([{ date: '25-03-2026', ccl: 90, usdt: 100 }], { fiat: { ccl: { price: Infinity } }, usdt: { maxVenta: 100 } }, 'usdt', now).data, [-10])
})

test('historical fallback quotes are never relabeled as a live observation for today', () => {
  const now = new Date(2026, 2, 25)
  const history = [{ date: '24-03-2026', ccl: 110, usdt: 100, mep: 100 }]
  const fallback = {
    fiat: { ccl: { price: 110, historical: true }, mep: { price: 100 } },
    usdt: { maxVenta: 100 },
  }
  assert.deepEqual(buildSpreadData(history, fallback, 'usdt', now).labels, ['24-03-2026'])
  fallback.fiat.ccl.historical = false
  fallback.usdt.historical = true
  assert.deepEqual(buildSpreadData(history, fallback, 'usdt', now).labels, ['24-03-2026'])
  fallback.fiat.mep.historical = true
  assert.deepEqual(buildSpreadData(history, fallback, 'mep', now).labels, ['24-03-2026'])
})

test('band model retains original baseline, daily compounding, IPC lag and finite fallback', () => {
  const now = new Date(2026, 0, 1)
  const history = { '2025-11': 0.03, '2025-12': 0.04 }
  const bands = generateDatosBandas(history, now)
  assert.equal(bands.length, 31)
  assert.equal(bands[0].date, '01-01-2026')
  assert.equal(bands[0].sup, +(1526.596 * 1.03 ** (1 / 31)).toFixed(2))
  assert.equal(bands.at(-1).sup, +(1526.596 * 1.03).toFixed(2))
  assert.equal(bands.at(-1).inf, +(916.275 * 0.97).toFixed(2))
  const invalid = generateDatosBandas({ '2025-11': 'bad', '2025-12': Infinity }, now)
  assert.ok(invalid.every(row => Number.isFinite(row.inf) && Number.isFinite(row.sup)))
  assert.deepEqual(generateDatosBandas({}, new Date('invalid')), [])
})

test('today lookup ignores future bands and handles unordered data', () => {
  const rows = [
    { date: '25-03-2026', inf: 10, sup: 20 },
    { date: '24-03-2026', inf: 9, sup: 19 },
    { date: '26-03-2026', inf: 11, sup: 21 },
  ]
  assert.equal(getBandaForToday(rows, new Date(2026, 2, 25)), rows[0])
  assert.equal(getBandaForToday(rows, new Date(2026, 2, 23)), null)
  assert.equal(getBandaForToday(null), null)
})

test('band chart filters weekends, holidays and future dates but retains today; live overwrites today only', () => {
  const rows = ['23', '24', '25', '26', '27', '28'].map(day => ({ date: `${day}-10-2026`, inf: 10, sup: 20 }))
  const history = [{ date: '23-10-2026', mayorista: 15 }, { date: '27-10-2026', mayorista: 16 }]
  const series = buildBandasChartData(rows, history, ['2026-10-26'], 17, new Date(2026, 9, 27))
  assert.deepEqual(series.labels, ['23-10-2026', '27-10-2026'])
  assert.deepEqual(series.dataMay, [15, 17])
  assert.equal(history.at(-1).mayorista, 16)
  const weekend = buildBandasChartData(rows, history, [], 0, new Date(2026, 9, 25))
  assert.deepEqual(weekend.labels, ['23-10-2026', '25-10-2026'])
  assert.equal(weekend.dataMay.at(-1), null)
})

test('gauge has no favorable signal for a missing quote and clamps valid outliers', () => {
  assert.equal(getGaugePosition(null, 10, 20), null)
  assert.equal(getGaugePosition(Infinity, 10, 20), null)
  assert.equal(getGaugePosition(15, 20, 10), null)
  assert.equal(getGaugePosition(5, 10, 20), 0)
  assert.equal(getGaugePosition(25, 10, 20), 100)
  assert.equal(getGaugePosition(15, 10, 20), 50)
  assert.equal(getZoneInfo(null).label, 'Sin cotización')
})
