import { formatLimit, formatDate } from './format.js'
import { finiteNumber } from './http.js'
import {
  PF_ALLOWED, PF_NAME_MAP, REMU_FILTER, REMU_NAMES, FCI_LIST,
  YIELD_ENTITIES, YIELD_API_KEY, YIELD_DISPLAY, YIELD_COINS,
} from './config.js'

const asArray = value => Array.isArray(value) ? value : []
const normalizeName = value => typeof value === 'string'
  ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
  : ''
const nonnegative = value => {
  const number = finiteNumber(value)
  return number !== null && number >= 0 ? number : null
}
const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = Date.parse(value)
  return Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === value ? date : null
}

export function normalizeTasas({ pfData, remuData, rendData, fciUlt, fciPen } = {}) {
  const banks = new Map()
  for (const entry of asArray(pfData)) {
    const upper = normalizeName(entry?.entidad)
    const rate = nonnegative(entry?.tnaClientes)
    if (!PF_ALLOWED.some(allowed => upper.includes(allowed)) || rate === null) continue
    const name = Object.entries(PF_NAME_MAP).find(([key]) => upper.includes(key))?.[1] ?? entry.entidad
    // Providers can return multiple records for one entity: rank comparable numeric rates.
    if (!banks.has(name) || banks.get(name).rate < rate) {
      banks.set(name, { name, rate, date: typeof entry.fecha === 'string' ? entry.fecha : '' })
    }
  }
  const plazosFijos = [...banks.values()].sort((a, b) => b.rate - a.rate)
  const bestPF = plazosFijos[0]
    ? { name: plazosFijos[0].name, rate: (plazosFijos[0].rate * 100).toFixed(2) }
    : null

  const accounts = new Map()
  for (const entry of asArray(remuData)) {
    const upper = normalizeName(entry?.fondo)
    const tna = nonnegative(entry?.tna)
    if (!REMU_FILTER.some(filter => upper.includes(filter)) || tna === null) continue
    const name = Object.entries(REMU_NAMES).find(([key]) => upper.includes(key))?.[1]
      ?? entry.fondo.replace('BANCO', '').trim()
    const limit = finiteNumber(entry.tope)
    const account = {
      name, tna,
      limit: limit > 0 ? `Límite: ${formatLimit(limit)}` : 'Sin Límites',
      tooltip: typeof entry.condicionesCorto === 'string' ? entry.condicionesCorto : null,
      subLabel: upper.includes('FIWIND') ? 'Billetera Virtual' : 'Cuenta Remunerada',
      date: typeof entry.fecha === 'string' ? entry.fecha : '',
    }
    if (!accounts.has(name) || accounts.get(name).tna < tna) accounts.set(name, account)
  }
  const cuentasRemuneradas = [...accounts.values()].sort((a, b) => b.tna - a.tna)
  const bestYield = cuentasRemuneradas[0]
    ? { name: cuentasRemuneradas[0].name, rate: (cuentasRemuneradas[0].tna * 100).toFixed(2) }
    : null

  const fundIndex = data => new Map(asArray(data).flatMap(entry => {
    const name = normalizeName(entry?.fondo)
    return name ? [[name, entry]] : []
  }))
  const latestFunds = fundIndex(fciUlt)
  const previousFunds = fundIndex(fciPen)
  const fci = FCI_LIST.flatMap(fund => {
    const latest = latestFunds.get(normalizeName(fund.desc))
    const previous = previousFunds.get(normalizeName(fund.desc))
    const latestVcp = finiteNumber(latest?.vcp)
    const previousVcp = finiteNumber(previous?.vcp)
    const latestDate = validDate(latest?.fecha)
    const previousDate = validDate(previous?.fecha)
    if (!(latestVcp > 0) || !(previousVcp > 0) || latestDate === null || previousDate === null) return []
    const days = (latestDate - previousDate) / 86_400_000
    if (days <= 0) return []
    const rate = ((latestVcp / previousVcp - 1) / days) * 365
    if (!Number.isFinite(rate)) return []
    return [{
      name: fund.name, desc: fund.desc,
      dateStr: `Entre ${formatDate(previous.fecha)} y ${formatDate(latest.fecha)}`, rate,
    }]
  }).sort((a, b) => b.rate - a.rate)

  const rateMap = {}
  const tiersMap = {}
  for (const entity of YIELD_ENTITIES) {
    rateMap[entity] = {}
    tiersMap[entity] = {}
    const provider = asArray(rendData).find(entry => normalizeName(entry?.entidad) === normalizeName(YIELD_API_KEY[entity]))
    for (const coin of YIELD_COINS) {
      const rates = asArray(provider?.rendimientos).flatMap(entry => {
        const rate = finiteNumber(entry?.apy)
        return normalizeName(entry?.moneda) === coin && rate > 0 ? [rate] : []
      })
      rateMap[entity][coin] = rates.length ? Math.max(...rates) : null
      tiersMap[entity][coin] = new Set(rates).size > 1
    }
  }
  const bestPerCoin = Object.fromEntries(YIELD_COINS.map(coin => {
    const best = Math.max(...YIELD_ENTITIES.map(entity => rateMap[entity][coin] ?? 0))
    return [coin, best > 0 ? best : null]
  }))

  let bestCrypto = null
  let bestCryptoRate = 0
  for (const entity of YIELD_ENTITIES) {
    for (const coin of YIELD_COINS) {
      const rate = rateMap[entity][coin]
      if (rate !== null && rate > bestCryptoRate) {
        bestCryptoRate = rate
        bestCrypto = { name: YIELD_DISPLAY[entity] || entity, rate: rate.toFixed(2), coin }
      }
    }
  }
  return {
    plazosFijos, cuentasRemuneradas, fci, bestYield, bestPF, bestCrypto,
    yields: { rateMap, bestPerCoin, tiersMap, entities: YIELD_ENTITIES, coins: YIELD_COINS, displayMap: YIELD_DISPLAY },
  }
}
