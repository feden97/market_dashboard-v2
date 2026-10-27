import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDashboardData, getTabFromSearch } from '../src/utils/dashboard.js'

test('historical fallback uses newest dated row, never invents a live timestamp or variation', () => {
  const result = buildDashboardData({ historical_fiat: [
    { date: '02-10-2026', ccl: 1500 },
    { date: '30-09-2026', ccl: 1400 },
  ] }, null, { bestPF: { name: 'Banco', rate: '10.00' } })
  assert.equal(result.fiat.ccl.price, 1500)
  assert.equal(result.fiat.ccl.var, null)
  assert.equal(result.fiat.ccl.historical, true)
  assert.equal(result.lastUpdated, null)
  assert.equal(result.historicalDate, '02-10-2026')
  assert.equal(result._bestPF.name, 'Banco')
})

test('live quotes win individually, unavailable prices remain absent, snapshot is unchanged', () => {
  const snapshot = { historical_fiat: [{ date: '02-10-2026', ccl: 1500, mep: 1450, usdt: 1510 }] }
  const result = buildDashboardData(snapshot, { fiat: { ccl: { price: 1550, var: 2 } } })
  assert.equal(result.fiat.ccl.price, 1550)
  assert.equal(result.fiat.mep.price, 1450)
  assert.equal(result.usdt.maxVenta, 1510)
  assert.equal(result.fiat.oficial.price, null)
  assert.equal(result.hasHistoricalQuotes, true)
  assert.equal(snapshot.historical_fiat[0].ccl, 1500)
  assert.deepEqual(buildDashboardData(null, null).usdt.exchanges, [])
})

test('invalid live prices cannot suppress a usable fallback', () => {
  for (const price of [null, 0, -1, NaN, Infinity]) {
    assert.equal(buildDashboardData({ historical_fiat: [{ date: '02-10-2026', ccl: 1500 }] }, { fiat: { ccl: { price } } }).fiat.ccl.price, 1500)
  }
})

test('query tabs accept PWA shortcuts and reject unknown sections', () => {
  assert.equal(getTabFromSearch('?tab=tasas-cripto&other=1'), 'tasas-cripto')
  assert.equal(getTabFromSearch('?tab=unknown'), 'resumen')
  assert.equal(getTabFromSearch(''), 'resumen')
})
