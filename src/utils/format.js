// ── Format helpers ────────────────────────────────────────────────

export const MONTH_NAMES = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}

/** ISO calendar date → DD/MM/YYYY, without timezone conversion. */
export function formatDate(dStr) {
  if (typeof dStr !== 'string') return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(dStr)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : dStr
}

export function formatLimit(v) {
  v = toFiniteNumber(v)
  if (v == null || v <= 0) return null
  return v >= 1_000_000
    ? `$${(v / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} M`
    : v >= 1_000
      ? `$${(v / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} K`
      : formatARS(v, 0)
}

/** Numeric API strings are accepted; absent and non-finite values stay absent. */
export function toFiniteNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const priceFormatters = new Map()

/** Format ARS price with comma decimals */
export function formatARS(v, decimals = 2) {
  const number = toFiniteNumber(v)
  if (number == null) return '—'
  const digits = Number.isInteger(decimals) ? Math.max(0, Math.min(20, decimals)) : 2
  if (!priceFormatters.has(digits)) {
    priceFormatters.set(digits, new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }))
  }
  return `$${priceFormatters.get(digits).format(number)}`
}

/** "2026-03" → "Mar 2026" */
export function formatYearMonth(key) {
  if (typeof key !== 'string') return ''
  const [y, m] = key.split('-')
  return `${MONTH_NAMES[m] || m} ${y}`
}

/** Returns { cls, sign, text } for a variation value */
export function varInfo(v) {
  v = toFiniteNumber(v)
  if (v == null) return { cls: '', sign: '', text: '—' }
  const cls  = v >= 0 ? 'badge-green' : 'badge-red'
  const sign = v > 0 ? '+' : ''
  return { cls, sign, text: `${sign}${v.toFixed(2)}%` }
}

/** Brecha percentage vs base price */
export function calcBrecha(val, basePrice) {
  val = toFiniteNumber(val)
  basePrice = toFiniteNumber(basePrice)
  if (basePrice == null || basePrice <= 0 || val == null || val <= 0) return null
  const result = ((val / basePrice) - 1) * 100
  return Number.isFinite(result) ? result : null
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/

/** Snapshot IPC values are fractions; the inflation endpoint returns percentages. */
export function mergeIpcHistory(ipcHistory, liveInflation) {
  const merged = {}
  if (ipcHistory && typeof ipcHistory === 'object' && !Array.isArray(ipcHistory)) {
    for (const [key, value] of Object.entries(ipcHistory)) {
      const number = toFiniteNumber(value)
      if (MONTH_KEY.test(key) && number != null && number > -1) merged[key] = number
    }
  }
  if (Array.isArray(liveInflation)) {
    for (const item of liveInflation) {
      const key = typeof item?.fecha === 'string' ? item.fecha.slice(0, 7) : ''
      const number = toFiniteNumber(item?.valor)
      if (MONTH_KEY.test(key) && number != null && number > -100) merged[key] = number / 100
    }
  }
  return merged
}

/** Get IPC last 12 months sorted entries [{key, pct}] */
export function getLast12IPC(ipcHistory) {
  const validHistory = mergeIpcHistory(ipcHistory)
  const keys = Object.keys(validHistory).sort().slice(-12)
  return keys.map(k => ({
    key: k,
    label: MONTH_NAMES[k.split('-')[1]] || k,
    year: k.split('-')[0],
    // Preserve precision for compounded statistics; round only when displaying.
    pct: validHistory[k] * 100,
  }))
}

/** Accumulate 12m inflation */
export function calcIpcStats(last12) {
  const valid = Array.isArray(last12) ? last12.filter(item => Number.isFinite(item?.pct) && item.pct > -100) : []
  if (!valid.length) return { lastMonth: 0, avg12m: 0, acum12m: 0 }
  let acum = 1, sum = 0
  for (const { pct } of valid) {
    acum *= (1 + pct / 100)
    sum  += pct / 100
  }
  return {
    lastMonth: valid[valid.length - 1].pct,
    avg12m:    (sum / valid.length) * 100,
    acum12m:   (acum - 1) * 100,
  }
}
