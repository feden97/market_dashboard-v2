import { useState, useEffect } from 'react'
import { formatLimit, formatDate } from '../utils/format'

const API = 'https://api.argentinadatos.com/v1/finanzas'

const PF_ALLOWED  = ['NACION', 'PROVINCIA', 'CIUDAD', 'SANTANDER', 'GALICIA', 'BBVA', 'MACRO', 'BRUBANK', 'DEL SOL', 'UALA', 'SUPERVIELLE']
const PF_NAME_MAP = {
  NACION: 'Banco Nación', PROVINCIA: 'Banco Provincia', CIUDAD: 'Banco Ciudad',
  SANTANDER: 'Banco Santander', 'GALICIA MAS': 'Banco Galicia Más', HSBC: 'Banco Galicia Más',
  GALICIA: 'Banco Galicia', BBVA: 'BBVA', MACRO: 'Banco Macro',
  BRUBANK: 'Brubank', 'DEL SOL': 'Banco del Sol', UALA: 'Ualá', SUPERVIELLE: 'Banco Supervielle',
}

const REMU_FILTER = ['CARREFOUR', 'FIWIND', 'NARANJA', 'UALA']
const REMU_NAMES  = {
  'UALA PLUS 2': 'Ualá Plus 2', 'UALA PLUS 1': 'Ualá Plus 1', 'UALA': 'Ualá',
  'NARANJA X': 'Naranja X', 'FIWIND': 'Fiwind', 'CARREFOUR': 'Carrefour Banco',
}

const FCI_LIST = [
  { key: 'PREX',     name: 'Prex',         desc: 'Allaria Ahorro - Clase E' },
  { key: 'PERSONAL', name: 'Personal Pay',  desc: 'Delta Pesos - Clase X' },
  { key: 'UALA',     name: 'Ualá',          desc: 'Ualintec Ahorro Pesos - Clase A' },
  { key: 'CLARO',    name: 'Claro Pay',     desc: 'SBS Ahorro Pesos - Clase A' },
  { key: 'MERCADO',  name: 'Mercado Pago',  desc: 'Mercado Fondo - Clase A' },
  { key: 'LEMON',    name: 'Lemon',         desc: 'Fima Premium - Clase P' },
  { key: 'FIWIND',   name: 'Fiwind',        desc: 'Delta Pesos - Clase A' },
]

const YIELD_ENTITIES = ['Fiwind', 'LB', 'Belo', 'LemonCash', 'Vesseo']
const YIELD_API_KEY  = { Fiwind: 'fiwind', LB: 'letsbit', Belo: 'belo', LemonCash: 'lemoncash', Vesseo: 'vesseo' }
const YIELD_DISPLAY  = { LemonCash: 'Lemon' }
const YIELD_COINS    = ['USDT', 'USDC', 'DAI']



/**
 * Returns {
 *   plazosFijos: [{name, rate, date}]
 *   cuentasRemuneradas: [{name, tna, limit, tooltip}]
 *   fci: [{name, desc, dateStr, rate}]
 *   yields: { rateMap: {entity: {coin: rate}}, bestPerCoin: {coin: rate}, tiersMap }
 *   bestYield: {name, rate}
 *   bestPF: {name, rate}
 *   bestCrypto: {name, rate, coin}
 *   loading, error
 * }
 */
export function useTasasData() {
  const [state, setState] = useState({ loading: true, error: null })

  useEffect(() => {
    Promise.all([
      fetch(`${API}/tasas/plazoFijo`).then(r => r.json()).catch(() => []),
      fetch(`${API}/fci/otros/ultimo`).then(r => r.json()).catch(() => []),
      fetch(`${API}/rendimientos`).then(r => r.json()).catch(() => []),
      fetch(`${API}/fci/mercadoDinero/ultimo`).then(r => r.json()).catch(() => []),
      fetch(`${API}/fci/mercadoDinero/penultimo`).then(r => r.json()).catch(() => []),
    ]).then(([pfData, remuData, rendData, fciUlt, fciPen]) => {

      // ── Plazos Fijos ──────────────────────────────────────────
      const seen = new Set()
      const plazosFijos = []
      for (const p of pfData) {
        const upper = (p.entidad || '').toUpperCase()
        if (!PF_ALLOWED.some(a => upper.includes(a))) continue
        let name = p.entidad
        for (const [k, v] of Object.entries(PF_NAME_MAP)) { if (upper.includes(k)) { name = v; break } }
        if (!seen.has(name)) { seen.add(name); plazosFijos.push({ name, rate: p.tnaClientes, date: p.fecha }) }
      }
      plazosFijos.sort((a, b) => (b.rate || 0) - (a.rate || 0))
      const bestPF = plazosFijos[0] ? { name: plazosFijos[0].name, rate: (plazosFijos[0].rate * 100).toFixed(2) } : null

      // ── Cuentas Remuneradas ───────────────────────────────────
      const cuentasRemuneradas = remuData
        .filter(e => REMU_FILTER.some(f => e.fondo.toUpperCase().includes(f)))
        .sort((a, b) => (b.tna || 0) - (a.tna || 0))
        .map(acc => {
          const upper = acc.fondo.toUpperCase().trim()
          const name  = Object.entries(REMU_NAMES).find(([k]) => upper.includes(k))?.[1] ?? acc.fondo.replace('BANCO', '').trim()
          
          let limitTxt = null
          if (acc.tope) {
            limitTxt = `Límite: ${formatLimit(acc.tope)}`
          } else {
            limitTxt = 'Sin Límites'
          }

          const tooltip = acc.condicionesCorto || null
          const subLabel = upper.includes('FIWIND') ? 'Billetera Virtual' : 'Cuenta Remunerada'
          
          return { name, tna: acc.tna, limit: limitTxt, tooltip, subLabel, date: acc.fecha }
        })
      const bestYield = cuentasRemuneradas[0]
        ? { name: cuentasRemuneradas[0].name, rate: (cuentasRemuneradas[0].tna * 100).toFixed(2) }
        : null

      // ── FCI ───────────────────────────────────────────────────
      const fci = FCI_LIST.flatMap(f => {
        const ult = fciUlt.find(i => i.fondo?.toUpperCase() === f.desc.toUpperCase())
        const pen = fciPen.find(i => i.fondo?.toUpperCase() === f.desc.toUpperCase())
        if (!ult?.vcp || !pen?.vcp) return []
        const days = (new Date(ult.fecha) - new Date(pen.fecha)) / 86_400_000
        if (days <= 0) return []
        const tna = ((ult.vcp / pen.vcp - 1) / days) * 365
        return [{ name: f.name, desc: f.desc, dateStr: `Entre ${formatDate(pen.fecha)} y ${formatDate(ult.fecha)}`, rate: tna }]
      }).sort((a, b) => b.rate - a.rate)

      // ── Yields ────────────────────────────────────────────────
      const rateMap = {}, tiersMap = {}
      for (const ent of YIELD_ENTITIES) {
        rateMap[ent] = {}; tiersMap[ent] = {}
        const provider = rendData.find(d => d.entidad.toLowerCase() === YIELD_API_KEY[ent].toLowerCase())
        for (const coin of YIELD_COINS) {
          tiersMap[ent][coin] = false
          if (!provider) { rateMap[ent][coin] = null; continue }
          const matches = provider.rendimientos.filter(r => r.moneda.toUpperCase() === coin && r.apy > 0)
          if (!matches.length) { rateMap[ent][coin] = null; continue }
          const best = matches.reduce((a, b) => a.apy > b.apy ? a : b)
          rateMap[ent][coin] = best.apy
          if (new Set(matches.map(r => r.apy)).size > 1) tiersMap[ent][coin] = true
        }
      }
      const bestPerCoin = {}
      for (const coin of YIELD_COINS) {
        const best = YIELD_ENTITIES.reduce((max, ent) => Math.max(max, rateMap[ent][coin] ?? -1), -1)
        bestPerCoin[coin] = best > 0 ? best : null
      }

      // ── Best crypto overall ───────────────────────────────────
      let bestCryptoRate = -1, bestCryptoName = '', bestCryptoCoin = 'USDT'
      for (const ent of YIELD_ENTITIES) {
        for (const coin of YIELD_COINS) {
          const r = rateMap[ent][coin]
          if (r !== null && r > bestCryptoRate) {
            bestCryptoRate = r
            bestCryptoName = YIELD_DISPLAY[ent] || ent
            bestCryptoCoin = coin
          }
        }
      }
      const bestCrypto = bestCryptoRate > 0
        ? { name: bestCryptoName, rate: bestCryptoRate.toFixed(2), coin: bestCryptoCoin }
        : null

      setState({
        plazosFijos, cuentasRemuneradas, fci,
        yields: { rateMap, bestPerCoin, tiersMap, entities: YIELD_ENTITIES, coins: YIELD_COINS, displayMap: YIELD_DISPLAY },
        bestYield, bestPF, bestCrypto,
        loading: false, error: null,
      })
    }).catch(err => {
      setState(s => ({ ...s, loading: false, error: err.message }))
    })
  }, [])

  return state
}
