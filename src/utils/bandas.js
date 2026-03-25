// ── Bandas de flotación BCRA ──────────────────────────────────────
// Starting values as of 2026-01-01 (matching original app.js)

const INF_START = 916.275
const SUP_START = 1526.596

function getDaysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate()
}

function getIPCForMonth(ipcHistory, y, m) {
  // Use IPC from 2 months prior (same logic as original)
  let tM = m - 2, tY = y
  if (tM < 0) { tM += 12; tY -= 1 }
  const key = `${tY}-${String(tM + 1).padStart(2, '0')}`
  return parseFloat(ipcHistory?.[key] ?? '0.02')
}

/**
 * Generate daily banda data from 2026-01-01 to today + 30 days.
 * Returns [{date: "DD-MM-YYYY", inf: number, sup: number}]
 */
export function generateDatosBandas(ipcHistory) {
  const result = []
  const dStart = new Date(2026, 0, 1)
  const dEnd   = new Date()
  dEnd.setDate(dEnd.getDate() + 30)

  let currentInf = INF_START
  let currentSup = SUP_START

  for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
    const m = d.getMonth()
    const y = d.getFullYear()
    const ipc  = getIPCForMonth(ipcHistory, y, m)
    const days = getDaysInMonth(y, m)

    currentSup *= Math.pow(1 + ipc, 1 / days)
    currentInf *= Math.pow(1 - ipc, 1 / days)

    result.push({
      date: `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`,
      inf: +currentInf.toFixed(2),
      sup: +currentSup.toFixed(2),
    })
  }

  return result
}

/** Find today's banda entry */
export function getBandaForToday(bandas) {
  const today = new Date()
  const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`
  return (
    bandas.find(b => b.date === todayStr) ??
    [...bandas].reverse().find(b => {
      const [dd, mm, yyyy] = b.date.split('-')
      return new Date(+yyyy, +mm - 1, +dd) <= today
    }) ??
    bandas[0] ??
    null
  )
}

/** Build chart-ready arrays (business days only, up to today) */
export function buildBandasChartData(bandas, historicalFiat, fullHolidays = [], liveMayorista = 0) {
  const today    = new Date()
  const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`

  const mayoristaMap = Object.fromEntries(
    (historicalFiat || []).filter(d => d.mayorista).map(d => [d.date, d.mayorista])
  )

  const labels = [], dataSup = [], dataInf = [], dataMay = []

  for (const b of bandas) {
    const [dd, mm, yyyy] = b.date.split('-')
    const bDate   = new Date(+yyyy, +mm - 1, +dd)
    const isWknd  = bDate.getDay() === 0 || bDate.getDay() === 6
    const isoDate = `${yyyy}-${mm}-${dd}`
    const isHoliday = fullHolidays.includes(isoDate)

    if (bDate > today && b.date !== todayStr) continue
    if ((isWknd || isHoliday) && bDate < today && b.date !== todayStr) continue

    labels.push(b.date)
    dataSup.push(b.sup)
    dataInf.push(b.inf)
    dataMay.push(mayoristaMap[b.date] ?? null)
  }

  // Inject live mayorista
  if (liveMayorista > 0) {
    const bandaHoy = getBandaForToday(bandas)
    if (bandaHoy) {
      if (labels.at(-1) === todayStr) {
        dataMay[dataMay.length - 1] = liveMayorista
      } else {
        labels.push(todayStr)
        dataSup.push(bandaHoy.sup)
        dataInf.push(bandaHoy.inf)
        dataMay.push(liveMayorista)
      }
    }
  }

  return { labels, dataSup, dataInf, dataMay }
}

/** Get gauge position 0-100% within the band */
export function getGaugePosition(mayorista, inf, sup) {
  const rango = Math.max(1, sup - inf)
  return Math.max(0, Math.min(100, ((mayorista - inf) / rango) * 100))
}

/** Get zone label and color for a position 0-100 */
export function getZoneInfo(posPct) {
  if (posPct <= 25)  return { label: 'Zona favorable',  color: '#10b981', textColor: '#fff' }
  if (posPct <= 75)  return { label: 'Zona intermedia', color: '#facc15', textColor: '#111' }
  if (posPct <= 90)  return { label: 'Precaución',      color: '#f97316', textColor: '#fff' }
  return                    { label: 'Zona crítica',    color: '#ef4444', textColor: '#fff' }
}
