const TABS = new Set(['resumen', 'dolares', 'tasas', 'tasas-cripto'])
const FIAT_KEYS = ['ccl', 'mep', 'oficial', 'blue', 'mayorista']

export function getTabFromSearch(search) {
  const tab = new URLSearchParams(search).get('tab')
  return TABS.has(tab) ? tab : 'resumen'
}

function dateKey(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value ?? '')
  return match ? `${match[3]}-${match[2]}-${match[1]}` : ''
}

function validPrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** Use the latest dated snapshot quote only when that live quote is missing. */
export function buildDashboardData(snapshot, liveData, tasas) {
  const history = Array.isArray(snapshot?.historical_fiat) ? snapshot.historical_fiat : []
  const latest = history.filter(row => dateKey(row?.date)).reduce((best, row) => (
    !best || dateKey(row.date) > dateKey(best.date) ? row : best
  ), null)
  const fiat = Object.fromEntries(FIAT_KEYS.map(key => [key,
    validPrice(liveData?.fiat?.[key]?.price)
      ? liveData.fiat[key]
      : { price: validPrice(latest?.[key]) ? latest[key] : null, var: null, historical: true },
  ]))
  const hasLiveUSDT = validPrice(liveData?.usdt?.maxVenta)
  return {
    ...liveData,
    fiat,
    usdt: {
      ...liveData?.usdt,
      maxVenta: hasLiveUSDT ? liveData.usdt.maxVenta : validPrice(latest?.usdt) ? latest.usdt : null,
      var: hasLiveUSDT ? liveData.usdt.var : null,
      historical: !hasLiveUSDT,
      exchanges: liveData?.usdt?.exchanges ?? [],
    },
    historicalDate: latest?.date ?? null,
    hasHistoricalQuotes: Object.values(fiat).some(quote => quote.historical && quote.price) || (!hasLiveUSDT && validPrice(latest?.usdt)),
    lastUpdated: liveData?.lastUpdated ?? null,
    _bestYield: tasas?.bestYield ?? null,
    _bestPF: tasas?.bestPF ?? null,
    _bestCrypto: tasas?.bestCrypto ?? null,
  }
}
