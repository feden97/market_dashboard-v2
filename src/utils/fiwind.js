import { fetchJson, finiteNumber, isRecord } from './http.js'

export const FIWIND_API = 'https://criptoya.com/api/fiwind/usdt/usd'
export const FIWIND_INTERVAL = 60 * 60 * 1000
export const FIWIND_REFRESH = 5 * 60 * 1000

/** Whole thousandths on the axis prevent duplicate labels after rounding. */
export function fiwindAxisRange(quotes) {
  if (!quotes.length) return { min: undefined, max: undefined, stepSize: undefined }
  const values = quotes.flatMap(quote => [quote.bid, quote.ask])
  const low = Math.min(...values)
  const high = Math.max(...values)
  const desired = Math.max(1, Math.ceil((high - low) * 1000 / 4 - 1e-9))
  const magnitude = 10 ** Math.floor(Math.log10(desired))
  const step = [1, 2, 5, 10].map(value => value * magnitude).find(value => value >= desired)
  return {
    min: (Math.floor(low * 1000 / step + 1e-9) - 1) * step / 1000,
    max: (Math.ceil(high * 1000 / step - 1e-9) + 1) * step / 1000,
    stepSize: step / 1000,
  }
}

export function normalizeFiwindQuote(value, now = Date.now(), fresh = false) {
  if (!isRecord(value)) return null
  const bid = finiteNumber(value.bid)
  const ask = finiteNumber(value.ask)
  const time = finiteNumber(value.time)
  if (bid == null || ask == null || time == null || !(bid > 0.5 && bid <= ask && ask < 2)) return null
  const age = now - time * 1000
  if (time < 1577836800 || age < -60_000 || (fresh && age > 180_000)) return null
  return { time: Math.floor(time), bid, ask }
}

export function normalizeFiwindHistory(value, now = Date.now()) {
  if (!isRecord(value) || value.version !== 1 || value.source !== FIWIND_API || !Array.isArray(value.quotes)) {
    throw new Error('El histórico de Fiwind tiene un formato inesperado.')
  }
  const byTime = new Map()
  for (const row of value.quotes) {
    const quote = normalizeFiwindQuote(row, now)
    if (quote) byTime.set(quote.time, quote)
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time)
}

export async function loadFiwindLive({ signal, request = fetchJson, now = Date.now() } = {}) {
  const value = await request(FIWIND_API, { signal })
  const quote = normalizeFiwindQuote(value, now, true)
  if (!quote) throw new Error('Fiwind no devolvió una cotización reciente y válida.')
  return { data: quote }
}

export async function loadFiwindHistory({ url, signal, request = fetchJson, now = Date.now() }) {
  const endpoint = new URL(url, globalThis.location?.href || 'http://localhost')
  endpoint.searchParams.set('v', String(Math.floor(now / FIWIND_REFRESH)))
  const value = await request(endpoint.href, { signal })
  return { data: normalizeFiwindHistory(value, now) }
}

export function fiwindView(history = [], live = null, hours = 24, now = Date.now()) {
  const lastStored = history.at(-1)
  const latest = live && (!lastStored || live.time >= lastStored.time) ? live : lastStored ?? null
  const cutoff = now / 1000 - hours * 3600
  // The graph contains durable observations only. Live polling never invents history.
  const quotes = history.filter(row => row.time >= cutoff && row.time <= now / 1000)
  const bids = quotes.map(row => row.bid)
  const fresh = Boolean(latest && now - latest.time * 1000 <= 180_000)
  const chartQuotes = fresh && latest === live && latest.time > (quotes.at(-1)?.time ?? 0)
    ? [...quotes, { ...latest, live: true }] : quotes
  return {
    latest, quotes, chartQuotes, fresh,
    min: bids.length ? Math.min(...bids) : null,
    max: bids.length ? Math.max(...bids) : null,
    premium: latest ? (latest.bid - 1) * 100 : null,
  }
}

export function fiwindChartPoints(quotes, key) {
  const points = []
  quotes.forEach((quote, index) => {
    const previous = quotes[index - 1]
    // Preserve visible gaps when a scheduled run is delayed or fails.
    if (previous && quote.time - previous.time > FIWIND_INTERVAL / 1000 * 1.5) {
      points.push({ x: (previous.time + quote.time) * 500, y: null })
    }
    points.push({ x: quote.time * 1000, y: quote[key], ...(quote.live ? { live: true } : {}) })
  })
  return points
}
