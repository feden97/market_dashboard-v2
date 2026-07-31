import { useState, useEffect } from 'react'
import { formatLimit, formatDate } from '../utils/format'
import {
  PF_ALLOWED, PF_NAME_MAP,
  REMU_FILTER, REMU_NAMES,
  FCI_LIST,
  YIELD_ENTITIES, YIELD_API_KEY, YIELD_DISPLAY, YIELD_COINS,
} from '../utils/config'

const API = 'https://api.argentinadatos.com/v1/finanzas'

export function useTasasData() {
  const [state, setState] = useState({ loading: true, error: null })

  useEffect(() => {
    Promise.all([
      fetch(`${API}/tasas/plazoFijo`).then(r => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API}/fci/otros/ultimo`).then(r => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API}/rendimientos`).then(r => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API}/fci/mercadoDinero/ultimo`).then(r => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API}/fci/mercadoDinero/penultimo`).then(r => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([pfDataRaw, remuDataRaw, rendDataRaw, fciUltRaw, fciPenRaw]) => {
      const pfData   = Array.isArray(pfDataRaw) ? pfDataRaw : []
      const remuData = Array.isArray(remuDataRaw) ? remuDataRaw : []
      const rendData = Array.isArray(rendDataRaw) ? rendDataRaw : []
      const fciUlt   = Array.isArray(fciUltRaw) ? fciUltRaw : []
      const fciPen   = Array.isArray(fciPenRaw) ? fciPenRaw : []

      // ── Plazos Fijos ──────────────────────────────────────────
      const seen = new Set()
      const plazosFijos = []
      for (const p of pfData) {
        if (!p || typeof p !== 'object') continue
        const upper = (p.entidad || '').toUpperCase()
        if (!PF_ALLOWED.some(a => upper.includes(a))) continue
        let name = p.entidad || 'Banco'
        for (const [k, v] of Object.entries(PF_NAME_MAP)) {
          if (upper.includes(k)) { name = v; break }
        }
        if (!seen.has(name)) {
          seen.add(name)
          plazosFijos.push({ name, rate: p.tnaClientes ?? 0, date: p.fecha || '' })
        }
      }
      plazosFijos.sort((a, b) => (b.rate || 0) - (a.rate || 0))
      const bestPF = plazosFijos[0] ? { name: plazosFijos[0].name, rate: (plazosFijos[0].rate * 100).toFixed(2) } : null

      // ── Cuentas Remuneradas ───────────────────────────────────
      const cuentasRemuneradas = remuData
        .filter(acc => acc?.fondo && typeof acc.fondo === 'string' && REMU_FILTER.some(f => acc.fondo.toUpperCase().includes(f)))
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
          
          return { name, tna: acc.tna ?? 0, limit: limitTxt, tooltip, subLabel, date: acc.fecha || '' }
        })
      const bestYield = cuentasRemuneradas[0]
        ? { name: cuentasRemuneradas[0].name, rate: (cuentasRemuneradas[0].tna * 100).toFixed(2) }
        : null

      // ── FCI ───────────────────────────────────────────────────
      const fci = FCI_LIST.flatMap(f => {
        const ult = fciUlt.find(i => i?.fondo && typeof i.fondo === 'string' && i.fondo.toUpperCase() === f.desc.toUpperCase())
        const pen = fciPen.find(i => i?.fondo && typeof i.fondo === 'string' && i.fondo.toUpperCase() === f.desc.toUpperCase())
        if (!ult?.vcp || !pen?.vcp || !ult.fecha || !pen.fecha) return []
        const days = (new Date(ult.fecha) - new Date(pen.fecha)) / 86_400_000
        if (days <= 0) return []
        const tna = ((ult.vcp / pen.vcp - 1) / days) * 365
        return [{ name: f.name, desc: f.desc, dateStr: `Entre ${formatDate(pen.fecha)} y ${formatDate(ult.fecha)}`, rate: tna }]
      }).sort((a, b) => b.rate - a.rate)

      // ── Yields ────────────────────────────────────────────────
      const rateMap = {}, tiersMap = {}
      for (const ent of YIELD_ENTITIES) {
        rateMap[ent] = {}; tiersMap[ent] = {}
        const providerKey = YIELD_API_KEY[ent]?.toLowerCase() || ''
        const provider = rendData.find(d => d?.entidad && typeof d.entidad === 'string' && d.entidad.toLowerCase() === providerKey)
        for (const coin of YIELD_COINS) {
          tiersMap[ent][coin] = false
          if (!provider || !Array.isArray(provider.rendimientos)) { rateMap[ent][coin] = null; continue }
          const matches = provider.rendimientos.filter(r => r?.moneda && typeof r.moneda === 'string' && r.moneda.toUpperCase() === coin && r.apy > 0)
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
      console.warn('useTasasData processing warning:', err)
      setState({
        plazosFijos: [], cuentasRemuneradas: [], fci: [],
        yields: { rateMap: {}, bestPerCoin: {}, tiersMap: {}, entities: YIELD_ENTITIES, coins: YIELD_COINS, displayMap: YIELD_DISPLAY },
        bestYield: null, bestPF: null, bestCrypto: null,
        loading: false, error: err.message
      })
    })
  }, [])

  return state
}
