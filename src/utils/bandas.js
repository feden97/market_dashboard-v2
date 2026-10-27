import { toFiniteNumber } from './format.js'

// Existing model: 2026-01-01 baseline, two-month IPC lag, 2% fallback.
// These parameters preserve the original calculation; they are not a live policy feed.
const INF_START = 916.275
const SUP_START = 1526.596
const FALLBACK_IPC = 0.02

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dateKey(date) {
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`
}

function parseDate(key) {
  if (typeof key !== 'string' || !/^\d{2}-\d{2}-\d{4}$/.test(key)) return null
  const [day, month, year] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year ? date : null
}

function getIPCForMonth(ipcHistory, year, month) {
  const lag = new Date(year, month - 2, 1)
  const key = `${lag.getFullYear()}-${String(lag.getMonth() + 1).padStart(2, '0')}`
  const ipc = toFiniteNumber(ipcHistory?.[key])
  // Both bases of the daily powers must stay positive.
  return ipc != null && ipc > -1 && ipc < 1 ? ipc : FALLBACK_IPC
}

/** Generate daily model values through now + 30 days (dates are calendar days). */
export function generateDatosBandas(ipcHistory, now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return []
  const result = []
  const end = startOfDay(now)
  end.setDate(end.getDate() + 30)
  let currentInf = INF_START
  let currentSup = SUP_START

  for (const date = new Date(2026, 0, 1); date <= end; date.setDate(date.getDate() + 1)) {
    const month = date.getMonth()
    const year = date.getFullYear()
    const ipc = getIPCForMonth(ipcHistory, year, month)
    const days = new Date(year, month + 1, 0).getDate()
    currentSup *= Math.pow(1 + ipc, 1 / days)
    currentInf *= Math.pow(1 - ipc, 1 / days)
    result.push({ date: dateKey(date), inf: +currentInf.toFixed(2), sup: +currentSup.toFixed(2) })
  }
  return result
}

/** Latest available entry at or before today; never substitute a future value. */
export function getBandaForToday(bandas, now = new Date()) {
  const today = startOfDay(now)
  let latest = null
  let latestTime = -Infinity
  for (const entry of Array.isArray(bandas) ? bandas : []) {
    const date = parseDate(entry?.date)
    if (date && date <= today && date.getTime() > latestTime) {
      latest = entry
      latestTime = date.getTime()
    }
  }
  return latest
}

/** Business-day history plus today's entry, including a valid live quote if supplied. */
export function buildBandasChartData(bandas, historicalFiat, fullHolidays = [], liveMayorista = 0, now = new Date()) {
  const today = startOfDay(now)
  const todayStr = dateKey(today)
  const holidays = new Set(Array.isArray(fullHolidays) ? fullHolidays : [])
  const mayoristaMap = new Map()
  for (const row of Array.isArray(historicalFiat) ? historicalFiat : []) {
    const price = toFiniteNumber(row?.mayorista)
    if (price != null && price > 0) mayoristaMap.set(row.date, price)
  }
  const rows = (Array.isArray(bandas) ? bandas : [])
    .map(entry => ({ entry, date: parseDate(entry?.date) }))
    .filter(({ entry, date }) => date && date <= today && Number.isFinite(entry.inf) && Number.isFinite(entry.sup))
    .sort((a, b) => a.date - b.date)

  const labels = [], dataSup = [], dataInf = [], dataMay = []
  for (const { entry, date } of rows) {
    const isToday = entry.date === todayStr
    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    if (!isToday && (isWeekend || holidays.has(isoDate))) continue
    labels.push(entry.date)
    dataSup.push(entry.sup)
    dataInf.push(entry.inf)
    dataMay.push(mayoristaMap.get(entry.date) ?? null)
  }

  const live = toFiniteNumber(liveMayorista)
  if (live != null && live > 0) {
    const bandaHoy = getBandaForToday(bandas, today)
    if (bandaHoy) {
      if (labels.at(-1) === todayStr) dataMay[dataMay.length - 1] = live
      else {
        labels.push(todayStr)
        dataSup.push(bandaHoy.sup)
        dataInf.push(bandaHoy.inf)
        dataMay.push(live)
      }
    }
  }
  return { labels, dataSup, dataInf, dataMay }
}

/** Gauge position in [0,100], or null when no valid quote/range is available. */
export function getGaugePosition(mayorista, inf, sup) {
  mayorista = toFiniteNumber(mayorista)
  inf = toFiniteNumber(inf)
  sup = toFiniteNumber(sup)
  if (mayorista == null || mayorista <= 0 || inf == null || sup == null || sup <= inf) return null
  return Math.max(0, Math.min(100, ((mayorista - inf) / (sup - inf)) * 100))
}

export function getZoneInfo(posPct) {
  if (!Number.isFinite(posPct)) return { label: 'Sin cotización', color: '#64748b', textColor: '#fff' }
  if (posPct <= 25) return { label: 'Zona favorable', color: '#10b981', textColor: '#fff' }
  if (posPct <= 75) return { label: 'Zona intermedia', color: '#facc15', textColor: '#111' }
  if (posPct <= 90) return { label: 'Precaución', color: '#f97316', textColor: '#fff' }
  return { label: 'Zona crítica', color: '#ef4444', textColor: '#fff' }
}
