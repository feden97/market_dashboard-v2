import React, { useState, useEffect } from 'react'
import { formatARS, varInfo, calcBrecha } from '../utils/format'
import { EntityIcon, QUESTION_MARK_SVG } from '../utils/icons'
import SpreadChart from '../charts/SpreadChart'
import BandasChart from '../charts/BandasChart'

function UpdateBar({ lastUpdated }) {
  const [secs, setSecs] = useState(60)

  useEffect(() => {
    setSecs(60)
    const interval = setInterval(() => {
      setSecs(s => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  return (
    <div className="update-bar-wrapper">
      <div className="progress-bar-bg" style={{ overflow: 'hidden' }}>
        <div
          className="progress-bar-fill"
          id="update-progress-bar"
          style={{
            width: '100%',
            transformOrigin: 'left',
            transform: `scaleX(${secs / 60})`,
            transition: 'transform 1s linear'
          }}
        />
      </div>
      <div className="update-time-container">
        <span className="live-dot" />
        <span id="last-updated-time" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {lastUpdated
            ? lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
            : '--:--:--'}
        </span>
      </div>
    </div>
  )
}

function VarBadge({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const { cls, text } = varInfo(value)
  return <span className={`badge ${cls}`}>{text}</span>
}

function BrechaBadge({ val, basePrice }) {
  if (!val || !basePrice) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const pct = calcBrecha(val, basePrice)
  if (pct == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const { cls, text } = varInfo(pct)
  return <span className={`badge ${cls}`}>{text}</span>
}

const DOLAR_ROWS = [
  { key: 'ccl',     name: 'CCL',     color: '#EF9F27' },
  { key: 'mep',     name: 'MEP',     color: '#1D9E75' },
  { key: 'oficial', name: 'Oficial', color: '#378ADD' },
  { key: 'blue',    name: 'Blue',    color: '#D85A30' },
]

const BASE_LABELS = { usdt: 'USDT', oficial: 'Oficial', mep: 'MEP', ccl: 'CCL', blue: 'Blue' }

export default function TabDolares({ snapshot, liveData, bandas, historicalFiat }) {
  // ── Lifted from SpreadChart so the table brecha can react ──
  const [base, setBase] = useState('usdt')

  const fiat = liveData?.fiat
  const usdt = liveData?.usdt

  const fullHolidays = snapshot?.argentina_macro?.full_holidays ?? []
  const liveMay = fiat?.mayorista?.price ?? 0

  const usdtRows = usdt?.exchanges ?? []
  const bestVenta  = usdtRows.filter(e => e.id !== 'bybitp2p').reduce((max, e) => e.venta_a > max ? e.venta_a : max, 0)
  const bestCompra = usdtRows.filter(e => e.id !== 'bybitp2p').reduce((min, e) => e.compra_a < min ? e.compra_a : min, Infinity)

  // The base price used for the brecha column — mirrors SpreadChart logic
  const basePrice = base === 'usdt'
    ? usdt?.maxVenta
    : fiat?.[base]?.price

  return (
    <div className="panel-ancho">
      <div className="macro-card">
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: 0 }}>Dólares y Cotizaciones</h2>
          <UpdateBar lastUpdated={liveData?.lastUpdated} />
        </div>

        <div className="tables-grid">
          {/* ── Left Table (Fiat) ── */}
          <div className="tables-grid-item">
            <h2 className="macro-title">Panel de Cotizaciones</h2>
            <div className="data-table-wrapper">
              <table className="data-table">
              <thead>
                <tr>
                  <th className="col-name">Dólar</th>
                  <th className="col-price">Precio</th>
                  <th className="col-var">Var.</th>
                  <th className="col-brecha">vs {BASE_LABELS[base]}</th>
                </tr>
              </thead>
              <tbody>
                {DOLAR_ROWS.map(({ key, name, color }) => {
                  const d = fiat?.[key]
                  const showBrecha = key !== base
                  return (
                    <tr key={name}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span style={{
                            width: 3, height: 16, borderRadius: 2, flexShrink: 0,
                            background: color, display: 'inline-block'
                          }} />
                          <span className="terminal-name">{name}</span>
                        </div>
                      </td>
                      <td className="r">
                        {d?.price ? formatARS(d.price) : '...'}
                      </td>
                      <td className="r"><VarBadge value={d?.var} /></td>
                      <td className="r">
                        {showBrecha
                          ? <BrechaBadge val={d?.price} basePrice={basePrice} />
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
                {/* USDT row */}
                <tr>
                  <td>
                    <div className="flex items-center gap-2">
                      <span style={{ width: 3, height: 16, borderRadius: 2, flexShrink: 0, background: '#7081FF', display: 'inline-block' }} />
                      <div className="flex items-center gap-1.5">
                        <span className="terminal-name">USDT</span>
                        <div className="tooltip-container tooltip-right" style={{ cursor: 'help' }}>
                          {QUESTION_MARK_SVG}
                          <div className="tooltip-text" style={{ fontWeight: 600, textAlign: 'left', minWidth: '200px' }}>
                            Es el dólar cripto que cotiza las 24 horas TODOS los días. Es el precio para comprar USDT en Binance p2p más aproximado posible sin la opción "comerciantes verificados"
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="r">
                    {usdt?.maxVenta ? formatARS(usdt.maxVenta) : '...'}
                  </td>
                  <td className="r"><VarBadge value={usdt?.var} /></td>
                  <td className="r">
                    {base !== 'usdt'
                      ? <BrechaBadge val={usdt?.maxVenta} basePrice={basePrice} />
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>

          {/* ── Right Table (Exchanges) ── */}
          <div className="tables-grid-item">
            <h2 className="macro-title">Exchanges USDT</h2>
            <div className="data-table-wrapper">
              <table className="data-table">
              <thead>
                <tr>
                  <th className="col-name">Exchange</th>
                  <th className="col-price">Compra</th>
                  <th className="col-price">Venta</th>
                </tr>
              </thead>
              <tbody>
                {usdtRows.slice(0, 10).map(e => {
                  const isBestVenta  = e.venta_a === bestVenta && e.id !== 'bybitp2p'
                  const isBestCompra = e.compra_a === bestCompra && e.id !== 'bybitp2p'
                  const isBybit = e.id === 'bybitp2p'
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <EntityIcon name={e.name} size={24} className="matrix-exchange-icon" />
                          <span className="terminal-name">{e.name}</span>
                          {isBybit && <span style={{ fontSize: 9, opacity: 0.6 }}>p2p</span>}
                        </div>
                      </td>
                      <td className="c" style={{ color: isBestCompra ? 'var(--green)' : undefined, fontWeight: isBestCompra ? 700 : undefined }}>
                        {formatARS(e.compra_a)}
                      </td>
                      <td className="c" style={{ color: isBestVenta ? 'var(--green)' : undefined, fontWeight: isBestVenta ? 700 : undefined }}>
                        {formatARS(e.venta_a)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* ── Spread chart ── */}
        <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '1px solid var(--border-color)' }}>
          <SpreadChart
            historicalFiat={historicalFiat}
            liveData={liveData}
            base={base}
            setBase={setBase}
          />
        </div>
      </div>

      {/* ── Bandas ── */}
      <div className="macro-card">
        <h2 className="macro-title">Bandas Cambiarias y Dólar Mayorista</h2>
        <BandasChart
          bandas={bandas}
          historicalFiat={historicalFiat}
          fullHolidays={fullHolidays}
          liveMayorista={liveMay}
          snapshot={snapshot}
        />
      </div>
    </div>
  )
}
