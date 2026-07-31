import { useState, useEffect, useCallback, useRef } from 'react'

const CRYPTO_BASE = 'https://criptoya.com/api'
const ARG_BASE    = 'https://api.argentinadatos.com/v1'

const USDT_EXCHANGES = ['fiwind', 'lemoncash', 'bybitp2p', 'letsbit']

function getDolarData(obj) {
  if (!obj) return { price: 0, var: 0 }
  const src = obj.al30?.['24hs'] ?? obj.al30?.ci ?? obj
  return { price: src.price ?? src.ask ?? 0, var: src.variation ?? 0 }
}

/**
 * Hook that fetches live exchange rates every 60 seconds.
 * Returns {
 *   fiat: { ccl, mep, oficial, blue, mayorista } — each { price, var }
 *   usdt: { maxVenta, minCompra, exchanges: [{id, name, compra_a, venta_a}], var }
 *   lastUpdated: Date
 *   secondsToNext: number
 *   loading: bool
 * }
 */
export function useLiveData() {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const timerRef = useRef(null)

  const fetchAll = useCallback(async () => {
    try {
      // 🚀 Scalability: Option to use a centralized Proxy (BFF)
      // Set VITE_PROXY_URL in .env to your Render/Railway proxy address
      const PROXY_URL = import.meta.env.VITE_PROXY_URL || null

      if (PROXY_URL) {
        const resp = await fetch(PROXY_URL).then(r => r.json())
        if (resp && resp.status === 'ok') {
          setData({
            fiat: {
              ccl:       getDolarData(resp.fiat.ccl),
              mep:       getDolarData(resp.fiat.mep),
              oficial:   getDolarData(resp.fiat.oficial),
              blue:      getDolarData(resp.fiat.blue),
              mayorista: getDolarData(resp.fiat.mayorista),
            },
            usdt: {
              maxVenta:  resp.usdt_raw?.p2p?.totalBid || 0, // approximation
              minCompra: resp.usdt_raw?.p2p?.totalAsk || 0,
              exchanges: [], // you could map these if needed
              var: 0
            },
            liveInflation: resp.live_inflation,
            lastUpdated: new Date()
          })
          setLoading(false)
          return
        }
      }

      // Fallback or Direct Mode (Default)
      const [cryptoData, p2pData, criptoYaDolar, liveInflation] = await Promise.all([
        fetch(`${CRYPTO_BASE}/usdt/ars/0.1`).then(r => r.json()).catch(() => ({})),
        fetch(`${CRYPTO_BASE}/binancep2p/usdt/ars/0.1`).then(r => r.json()).catch(() => null),
        fetch(`${CRYPTO_BASE}/dolar`).then(r => r.json()).catch(() => ({})),
        fetch(`${ARG_BASE}/finanzas/indices/inflacion`).then(r => r.json()).catch(() => null),
      ])

      // ── USDT exchanges ──────────────────────────────────────────
      let maxVenta = 0, minCompra = Infinity
      const exchanges = []

      for (const ex of USDT_EXCHANGES) {
        const d = cryptoData[ex]
        if (!d) continue
        if (ex !== 'bybitp2p') {
          if (d.totalBid > maxVenta) maxVenta = d.totalBid
          if (d.totalAsk < minCompra) minCompra = d.totalAsk
        }
        const name = ex === 'bybitp2p' ? 'BybitP2P' : ex === 'letsbit' ? 'LB Finanzas' : ex.charAt(0).toUpperCase() + ex.slice(1)
        exchanges.push({ id: ex, name, compra_a: d.totalAsk, venta_a: d.totalBid })
      }
      if (p2pData) {
        if (p2pData.totalBid > maxVenta) maxVenta = p2pData.totalBid
        if (p2pData.totalAsk < minCompra) minCompra = p2pData.totalAsk
        exchanges.push({ id: 'p2p', name: 'BinanceP2P', compra_a: p2pData.totalAsk, venta_a: p2pData.totalBid })
      }

      const usdtVar = criptoYaDolar?.cripto?.usdt?.variation ?? 0

      // ── Fiat ────────────────────────────────────────────────────
      const fiat = {
        ccl:       getDolarData(criptoYaDolar.ccl),
        mep:       getDolarData(criptoYaDolar.mep),
        oficial:   getDolarData(criptoYaDolar.oficial),
        blue:      getDolarData(criptoYaDolar.blue),
        mayorista: getDolarData(criptoYaDolar.mayorista),
      }

      setData({
        fiat,
        usdt: { maxVenta, minCompra, exchanges, var: usdtVar },
        liveInflation,
        lastUpdated: new Date(),
      })
      setLoading(false)

      // Schedule next update in 60s
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        fetchAll()
      }, 60000)

    } catch (err) {
      console.error('useLiveData error:', err)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    return () => clearTimeout(timerRef.current)
  }, [fetchAll])

  return { data, loading }
}
