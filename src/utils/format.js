// ── Format helpers ────────────────────────────────────────────────

export const MONTH_NAMES = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}

/** "DD-MM-YYYY" → "DD/MM/YYYY" */
export function formatDate(dStr) {
  if (!dStr) return ''
  const parts = dStr.split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dStr
}

export function formatLimit(v) {
  if (!v) return null;
  return v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(0)} M`
    : `$${(v / 1_000).toFixed(0)} K`;
}

/** Format ARS price with comma decimals */
export function formatARS(v, decimals = 2) {
  if (!v && v !== 0) return '-'
  return `$${Number(v).toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/** "2026-03" → "Mar 2026" */
export function formatYearMonth(key) {
  if (!key) return ''
  const [y, m] = key.split('-')
  return `${MONTH_NAMES[m] || m} ${y}`
}

/** Returns { cls, sign, text } for a variation value */
export function varInfo(v) {
  if (v == null) return { cls: '', sign: '', text: '-' }
  const cls  = v >= 0 ? 'badge-green' : 'badge-red'
  const sign = v > 0 ? '+' : ''
  return { cls, sign, text: `${sign}${v.toFixed(2)}%` }
}

/** Brecha percentage vs base price */
export function calcBrecha(val, basePrice) {
  if (!basePrice || !val) return null
  return ((val / basePrice) - 1) * 100
}

/** Get IPC last 12 months sorted entries [{key, pct}] */
export function getLast12IPC(ipcHistory) {
  if (!ipcHistory) return []
  const keys = Object.keys(ipcHistory).sort().slice(-12)
  return keys.map(k => ({
    key: k,
    label: MONTH_NAMES[k.split('-')[1]] || k,
    year: k.split('-')[0],
    pct: parseFloat((ipcHistory[k] * 100).toFixed(1)),
  }))
}

/** Accumulate 12m inflation */
export function calcIpcStats(last12) {
  if (!last12.length) return { lastMonth: 0, avg12m: 0, acum12m: 0 }
  let acum = 1, sum = 0
  for (const { pct } of last12) {
    acum *= (1 + pct / 100)
    sum  += pct / 100
  }
  return {
    lastMonth: last12[last12.length - 1].pct,
    avg12m:    (sum / last12.length) * 100,
    acum12m:   (acum - 1) * 100,
  }
}
