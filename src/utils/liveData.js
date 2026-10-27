import { fetchJson, finiteNumber, isRecord } from './http.js'

const CRYPTO_BASE = 'https://criptoya.com/api'
const ARG_BASE = 'https://api.argentinadatos.com/v1'
const FIAT_KEYS = ['ccl', 'mep', 'oficial', 'blue', 'mayorista']
const EXCHANGES = [
  ['fiwind', 'Fiwind'], ['lemoncash', 'Lemoncash'],
  ['bybitp2p', 'BybitP2P'], ['letsbit', 'LB Finanzas'], ['p2p', 'BinanceP2P'],
]

const positiveNumber = value => {
  const number = finiteNumber(value)
  return number !== null && number > 0 ? number : null
}

export function normalizeFiatQuote(value) {
  const quote = value?.al30?.['24hs'] ?? value?.al30?.ci ?? value
  return {
    price: positiveNumber(quote?.price) ?? positiveNumber(quote?.ask),
    var: finiteNumber(quote?.variation),
  }
}

const validCrypto = value => isRecord(value) && EXCHANGES.some(([id]) => id !== 'p2p'
  && (positiveNumber(value[id]?.totalAsk) !== null || positiveNumber(value[id]?.totalBid) !== null))
const validP2p = value => isRecord(value)
  && (positiveNumber(value.totalAsk) !== null || positiveNumber(value.totalBid) !== null)
const validFiat = value => isRecord(value) && FIAT_KEYS.some(key => normalizeFiatQuote(value[key]).price !== null)
const validInflation = value => Array.isArray(value) && value.some(item =>
  typeof item?.fecha === 'string' && finiteNumber(item.valor) !== null,
)

/** Merge only usable prices. A failed provider must never replace a quote with 0/Infinity. */
export function mergeLiveData(previous, raw, now = new Date()) {
  const fiat = Object.fromEntries(FIAT_KEYS.map(key => {
    const quote = normalizeFiatQuote(raw.fiat?.[key])
    return [key, quote.price === null ? (previous?.fiat?.[key] ?? quote) : quote]
  }))

  const previousExchanges = new Map((previous?.usdt?.exchanges ?? []).map(exchange => [exchange.id, exchange]))
  const exchanges = EXCHANGES.flatMap(([id, name]) => {
    const quote = id === 'p2p' ? raw.p2p : raw.crypto?.[id]
    const old = previousExchanges.get(id)
    const compra_a = positiveNumber(quote?.totalAsk) ?? old?.compra_a ?? null
    const venta_a = positiveNumber(quote?.totalBid) ?? old?.venta_a ?? null
    return compra_a !== null || venta_a !== null ? [{ id, name, compra_a, venta_a }] : []
  })
  // Keep the existing comparison policy: Bybit P2P is displayed but not ranked.
  const comparable = exchanges.filter(exchange => exchange.id !== 'bybitp2p')
  const bids = comparable.map(exchange => exchange.venta_a).filter(value => value > 0)
  const asks = comparable.map(exchange => exchange.compra_a).filter(value => value > 0)
  const maxVenta = bids.length ? Math.max(...bids) : null
  const minCompra = asks.length ? Math.min(...asks) : null

  const liveInflation = Array.isArray(raw.inflation)
    ? raw.inflation.filter(item => typeof item?.fecha === 'string' && finiteNumber(item.valor) !== null)
    : previous?.liveInflation ?? null
  const hasFreshPrices = FIAT_KEYS.some(key => normalizeFiatQuote(raw.fiat?.[key]).price !== null)
    || EXCHANGES.some(([id]) => {
      const quote = id === 'p2p' ? raw.p2p : raw.crypto?.[id]
      return positiveNumber(quote?.totalAsk) !== null || positiveNumber(quote?.totalBid) !== null
    })

  if (!hasFreshPrices && !liveInflation?.length && !previous) return null
  const sourceDate = raw.updatedAt ? new Date(raw.updatedAt) : now
  return {
    fiat,
    usdt: {
      maxVenta, minCompra, exchanges,
      var: finiteNumber(raw.fiat?.cripto?.usdt?.variation) ?? previous?.usdt?.var ?? null,
    },
    liveInflation,
    // An inflation-only refresh does not make an old quote fresh again.
    lastUpdated: hasFreshPrices
      ? (Number.isFinite(sourceDate.getTime()) && sourceDate <= now ? sourceDate : now)
      : previous?.lastUpdated ?? null,
  }
}

export async function loadLiveData({ proxyUrl, signal, request = fetchJson, now } = {}) {
  if (proxyUrl) {
    try {
      const response = await request(proxyUrl, { signal, validate: isRecord })
      if (response.status !== 'ok' || response.stale === true || !isRecord(response.fiat) || !isRecord(response.usdt_raw)) {
        throw new Error('El proxy todavía no tiene datos.')
      }
      const age = (now ?? new Date()).getTime() - new Date(response.last_updated).getTime()
      // The proxy refreshes every 10s. Do not present a crashed worker's last payload as live.
      if (!Number.isFinite(age) || age < 0 || age > 120_000) {
        throw new Error('Los datos del proxy están desactualizados.')
      }
      const raw = {
        fiat: response.fiat,
        crypto: response.usdt_raw.exchanges,
        p2p: response.usdt_raw.p2p,
        inflation: response.live_inflation,
        updatedAt: response.last_updated,
      }
      if (!validFiat(raw.fiat) && !validCrypto(raw.crypto) && !validP2p(raw.p2p)) {
        throw new Error('El proxy no devolvió cotizaciones válidas.')
      }
      const failedSources = [
        [validFiat(raw.fiat), 'cotizaciones del dólar'],
        [validCrypto(raw.crypto), 'exchanges USDT'],
        [validP2p(raw.p2p), 'Binance P2P'],
        [validInflation(raw.inflation), 'inflación'],
      ].filter(([valid]) => !valid).map(([, label]) => label)
      return { raw, failedSources }
    } catch (error) {
      // A proxy outage should still allow direct API requests; cancellation should not.
      if (signal?.aborted) throw error
    }
  }

  const sources = [
    ['crypto', 'exchanges USDT', `${CRYPTO_BASE}/usdt/ars/0.1`, validCrypto],
    ['p2p', 'Binance P2P', `${CRYPTO_BASE}/binancep2p/usdt/ars/0.1`, validP2p],
    ['fiat', 'cotizaciones del dólar', `${CRYPTO_BASE}/dolar`, validFiat],
    ['inflation', 'inflación', `${ARG_BASE}/finanzas/indices/inflacion`, validInflation],
  ]
  const outcomes = await Promise.allSettled(sources.map(([, , url, validate]) => request(url, { signal, validate })))
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
  const raw = {}
  const failedSources = []
  outcomes.forEach((result, index) => {
    const [key, label] = sources[index]
    if (result.status === 'fulfilled') raw[key] = result.value
    else failedSources.push(label)
  })
  return { raw, failedSources }
}
