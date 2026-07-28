import React, { useState, useEffect } from 'react'
import { formatARS, varInfo, calcBrecha } from '../utils/format'
import { EntityIcon, QUESTION_MARK_SVG } from '../utils/icons'
import SpreadChart from '../charts/SpreadChart'
import BandasChart from '../charts/BandasChart'

const EXCHANGE_ICONS = {
  fiwind: `<svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" style="width:20px;height:20px;border-radius:4px;"><rect width="18" height="18" style="fill:rgb(10,10,10);"></rect><g><path d="M7.92,9.58h-1.57c-.2,0-.36-.16-.36-.36s.16-.36.36-.36h1.57c.2,0,.36.16.36.36s-.16.36-.36.36ZM6.36,7.96c-.2,0-.36-.16-.36-.36s.16-.36.36-.36h2.05c.2,0,.36.16.36.36s-.16.36-.36.36h-2.05ZM8.7,11.48c-.19-.06-.3-.26-.24-.45l1.1-3.61c.06-.19.26-.3.45-.24.19.06.3.26.24.45l-1.1,3.61c-.06.19-.26.3-.45.24ZM11.89,7.63l-1.1,3.61c-.06.19-.26.3-.45.24-.19-.06-.3-.26-.24-.45l1.1-3.61c.06-.19.26-.3.45-.24.19.06.3.26.24.45Z" style="fill:rgb(239,180,29);"></path><path d="M9,14.01c-2.76,0-5-2.25-5-5.01s2.24-5.01,5-5.01,5,2.25,5,5.01-2.24,5.01-5,5.01ZM9,4.62c-2.41,0-4.37,1.96-4.37,4.37s1.96,4.37,4.37,4.37,4.37-1.96,4.37-4.37-1.96-4.37-4.37-4.37Z" style="fill:rgb(239,180,29);"></path></g></svg>`,
  lemoncash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" style="width:20px;height:20px;border-radius:4px;"><rect width="18" height="18" style="fill:rgb(10,10,10);"></rect><path d="M9,4c-2.74,0-5,2.26-5,5s2.26,5,5,5,5-2.26,5-5h0c0-2.74-2.26-5-5-5h0ZM11.63,9.24s-.07.05-.11.07c-.04.02-.09.03-.14.04-.11.02-.22.02-.33,0-.24-.05-.48-.15-.69-.28-.22-.14-.43-.29-.62-.47-.1-.09-.19-.18-.28-.28-.09-.1-.18-.21-.26-.31-.02-.03-.05-.04-.08-.04-.02,0-.04,0-.06.02-.05.03-.07.1-.03.15.07.12.16.23.24.35.09.12.17.22.27.33.19.21.4.41.63.58.24.18.5.32.79.42.1.03.2.05.3.06.04,0,.07.04.07.08,0,.01,0,.02-.01.03-.17.28-.37.53-.6.76-.63.66-1.49,1.05-2.4,1.08-.34,0-.68-.06-.99-.21l-.07-.03s-.05-.01-.07,0l-.06.04c-.11.07-.23.11-.35.11-.1,0-.2-.03-.28-.1-.13-.18-.13-.43,0-.61l.04-.07s.01-.05,0-.07l-.04-.07c-.35-.66-.32-1.52.03-2.32.01-.03.04-.05.07-.05.01,0,.02,0,.03,0,.02,0,.03.02.04.04.06.17.15.33.24.48.16.24.34.45.55.65.1.1.21.2.31.28.1.09.22.18.33.26.02,0,.04.01.05.01.06,0,.11-.05.11-.11,0-.03,0-.05-.03-.07-.1-.09-.2-.18-.29-.27-.09-.1-.18-.2-.27-.29-.17-.2-.32-.42-.44-.65-.12-.22-.2-.46-.24-.7-.02-.11-.02-.22,0-.33,0-.04.02-.09.04-.13,0-.01.02-.03.02-.04.07-.09.15-.17.23-.25,1.04-1.04,2.46-1.37,3.46-.83l.07.04s.06.02.08,0l.07-.05c.19-.15.45-.15.64,0,.15.2.14.47-.02.66l-.05.07s-.02.05,0,.07l.03.07c.26.6.28,1.28.05,1.9h0Z" style="fill:rgb(0,240,104);"></path></svg>`,
  p2p: `<svg viewBox="0 0 24 24" style="width:20px;height:20px;background:#fcd535;border-radius:4px;padding:2px;"><path d="M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7394 2.7154-2.7383-2.7154 2.7383-2.7164zM7.3783 9.2836L12 4.6241l4.6217 4.6595 2.7175-2.7154-7.3392-7.353-7.353 7.352 2.7314 2.7164zm-4.6366 4.6366L0 12l2.7416-2.7164 2.7186 2.7164L2.7416 13.9202zM12 15.1772l-3.179-3.1772L12 8.8228l3.179 3.1772L12 15.1772z" fill="#1e2026"/></svg>`,
  binancep2p: `<svg viewBox="0 0 24 24" style="width:20px;height:20px;background:#fcd535;border-radius:4px;padding:2px;"><path d="M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7394 2.7154-2.7383-2.7154 2.7383-2.7164zM7.3783 9.2836L12 4.6241l4.6217 4.6595 2.7175-2.7154-7.3392-7.353-7.353 7.352 2.7314 2.7164zm-4.6366 4.6366L0 12l2.7416-2.7164 2.7186 2.7164L2.7416 13.9202zM12 15.1772l-3.179-3.1772L12 8.8228l3.179 3.1772L12 15.1772z" fill="#1e2026"/></svg>`,
  bybitp2p: `<img src="assets/bybit.png" style="width:20px;height:20px;border-radius:4px;object-fit:contain;background:#000;">`,
  letsbit: `<svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" style="width:20px;height:20px;border-radius:4px;"><rect width="18" height="18" style="fill:#522398;"/><g><path d="M6.71,7.77l.39.49c.52.64,1.11.96,1.75.96,1.19,0,2.27-1.12,2.39-1.31,0,.02,0,0,.03-.05-1.45-.92-2.89-1.84-4.33-2.77-.24-.15-.48-.23-.72-.05-.24.19-.22.43-.14.7.22.68.43,1.35.63,2.03Z" style="fill:#fff;"/><path d="M12,9.11c0,.36-.2.7-.51.88-1.47.95-2.96,1.89-4.43,2.84-.07.05-.14.09-.22.14-.18.14-.44.14-.62,0-.19-.14-.26-.39-.18-.61.11-.4.23-.79.36-1.19.18-.57.38-1.12.5-1.7.07-.3.07-.61,0-.91,2.11,2.59,4.69-.36,4.59-.43.34.22.51.53.51.98Z" style="fill:#fff;"/></g></svg>`,
}

function renderExchangeIcon(id) {
  const iconHtml = EXCHANGE_ICONS[id]
  if (iconHtml) {
    return <span style={{ display: 'inline-flex', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: iconHtml }} />
  }
  return <EntityIcon name={id} size={20} styleOverrides={{ borderRadius: '4px' }} />
}

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
      <div className="progress-bar-bg">
        <div
          className="progress-bar-fill"
          id="update-progress-bar"
          style={{
            width: `${(secs / 60) * 100}%`,
            transition: 'width 1s linear'
          }}
        />
      </div>
      <div className="update-time-container">
        <span className="live-dot" />
        <span id="last-updated-time">
          Act: {lastUpdated
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
  if (!val || !basePrice) return <span style={{ color: 'var(--text-muted)' }}>-</span>
  const pct = calcBrecha(val, basePrice)
  if (pct == null) return <span style={{ color: 'var(--text-muted)' }}>-</span>
  const { cls, text } = varInfo(pct)
  return <span className={`badge ${cls}`}>{text}</span>
}

// EXACT ORDER FROM ORIGINAL APP.JS (lines 254): CCL, MEP, Oficial, Blue
const DOLAR_ROWS = [
  { key: 'ccl',     name: 'ccl' },
  { key: 'mep',     name: 'mep' },
  { key: 'oficial', name: 'oficial' },
  { key: 'blue',    name: 'blue' },
]

export default function TabDolares({ snapshot, liveData, bandas, historicalFiat }) {
  const [base, setBase] = useState('usdt')

  const fiat = liveData?.fiat
  const usdt = liveData?.usdt

  const fullHolidays = snapshot?.argentina_macro?.full_holidays ?? []
  const liveMay = fiat?.mayorista?.price ?? 0

  const usdtRows = usdt?.exchanges ?? []

  const bestVenta = usdtRows.filter(e => e.id !== 'bybitp2p').reduce((max, e) => e.venta_a > max ? e.venta_a : max, 0)
  const bestCompra = usdtRows.filter(e => e.id !== 'bybitp2p').reduce((min, e) => e.compra_a < min ? e.compra_a : min, Infinity)

  const basePrice = base === 'usdt'
    ? usdt?.maxVenta
    : fiat?.[base]?.price

  return (
    <div className="panel-ancho">
      {/* Cotizaciones card */}
      <div className="macro-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            Panel de Cotizaciones
          </h2>
          <UpdateBar lastUpdated={liveData?.lastUpdated} />
        </div>

        <div className="tables-grid">
          {/* Fiat Table */}
          <div className="tables-grid-item">
            <table className="data-table" style={{ border: 'none' }}>
              <thead>
                <tr>
                  <th style={{ border: 'none' }}>Dólar</th>
                  <th style={{ border: 'none' }}>Precio</th>
                  <th style={{ border: 'none' }}>Var.</th>
                  <th style={{ border: 'none' }}>Brecha s/</th>
                </tr>
              </thead>
              <tbody id="fiat-table-body">
                {DOLAR_ROWS.map(({ key, name }) => {
                  const d = fiat?.[key]
                  const showBrecha = key !== base
                  return (
                    <tr key={name}>
                      <td style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>{name}</td>
                      <td style={{ fontWeight: 'bold' }}>{d?.price ? formatARS(d.price) : '...'}</td>
                      <td><VarBadge value={d?.var} /></td>
                      <td>
                        {showBrecha
                          ? <BrechaBadge val={d?.price} basePrice={basePrice} />
                          : <span style={{ color: 'var(--text-muted)' }}>-</span>
                        }
                      </td>
                    </tr>
                  )
                })}
                {/* USDT Row */}
                <tr>
                  <td style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    USDT
                    <div className="tooltip-container tooltip-right" style={{ cursor: 'help' }}>
                      {QUESTION_MARK_SVG}
                      <div className="tooltip-text" style={{ fontWeight: 600, textAlign: 'left', minWidth: '200px' }}>
                        Es el dólar cripto que cotiza las 24 horas TODOS los días. Es el precio para comprar USDT en Binance p2p más aproximado posible sin la opción "comerciantes verificados"
                      </div>
                    </div>
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{usdt?.maxVenta ? formatARS(usdt.maxVenta) : '...'}</td>
                  <td><VarBadge value={usdt?.var} /></td>
                  <td>
                    {base !== 'usdt'
                      ? <BrechaBadge val={usdt?.maxVenta} basePrice={basePrice} />
                      : <span style={{ color: 'var(--text-muted)' }}>-</span>
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Exchanges Table */}
          <div className="tables-grid-item">
            <table className="data-table" style={{ border: 'none' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 10px' }}>Exchange (USDT)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Compra a</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Venta a</th>
                </tr>
              </thead>
              <tbody id="usdt-table-body">
                {usdtRows.length > 0 ? (
                  usdtRows.slice(0, 10).map(e => {
                    const isMin = e.compra_a === bestCompra && e.id !== 'bybitp2p'
                    const isMax = e.venta_a === bestVenta && e.id !== 'bybitp2p'
                    return (
                      <tr key={e.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {renderExchangeIcon(e.id)}
                            <span style={{ fontWeight: 500 }}>{e.name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={isMin ? 'text-highlight-green' : ''}>
                            {formatARS(e.compra_a)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', position: 'relative' }}>
                          <span className={isMax ? 'text-highlight-green' : ''}>
                            {formatARS(e.venta_a)}
                          </span>
                          {e.id === 'bybitp2p' && (
                            <span style={{ position: 'absolute', bottom: '1px', left: '50%', transform: 'translateX(-50%)', fontSize: '8px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1 }}>
                              (Solo visual)
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      Cargando datos...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Spread chart */}
        <div style={{ textAlign: 'center', marginTop: '25px' }}>
          <SpreadChart
            historicalFiat={historicalFiat}
            liveData={liveData}
            base={base}
            setBase={setBase}
          />
        </div>
      </div>

      {/* Bandas card */}
      <div className="macro-card" style={{ padding: '24px', marginTop: '24px' }}>
        <h2 style={{ color: 'var(--text-main)', margin: '0 0 24px', fontSize: '18px', fontWeight: 600, letterSpacing: '-0.5px' }}>
          Bandas Cambiarias y Dólar Mayorista
        </h2>

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
