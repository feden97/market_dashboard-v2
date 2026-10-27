import { calcBrecha } from './format.js'

function calendarDate(key) {
  if (typeof key !== 'string' || !/^\d{2}-\d{2}-\d{4}$/.test(key)) return null
  const [day, month, year] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year ? date : null
}

/** One observation per calendar day, including today's live value when valid. */
export function buildSpreadData(historicalFiat, liveData, base, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const observations = new Map()
  for (const row of Array.isArray(historicalFiat) ? historicalFiat : []) {
    const date = calendarDate(row?.date)
    const spread = calcBrecha(row?.ccl, row?.[base])
    if (date && date <= today && date.getFullYear() === today.getFullYear() && spread != null) {
      observations.set(row.date, { time: date.getTime(), value: +spread.toFixed(2) })
    }
  }
  const liveBase = base === 'usdt' ? liveData?.usdt?.maxVenta : liveData?.fiat?.[base]?.price
  const historicalBase = base === 'usdt' ? liveData?.usdt?.historical : liveData?.fiat?.[base]?.historical
  const liveSpread = liveData?.fiat?.ccl?.historical || historicalBase
    ? null : calcBrecha(liveData?.fiat?.ccl?.price, liveBase)
  if (liveSpread != null) {
    const key = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`
    observations.set(key, { time: today.getTime(), value: +liveSpread.toFixed(2) })
  }
  const sorted = [...observations].sort((a, b) => a[1].time - b[1].time)
  const data = sorted.map(([, entry]) => entry.value)
  return {
    labels: sorted.map(([date]) => date), data,
    summary: {
      cclWins: data.filter(value => value > 0).length,
      baseWins: data.filter(value => value < 0).length,
    },
  }
}
