import React, { useState, useEffect } from 'react'
import { formatARS, varInfo, calcIpcStats, getLast12IPC } from '../utils/format'
import { getBandaForToday, getGaugePosition, getZoneInfo } from '../utils/bandas'
import { EntityIcon } from '../utils/icons'
import InflacionChart from '../charts/InflacionChart'

function VarBadge({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const { cls, text } = varInfo(value)
  return <span className={`badge ${cls}`}>{text}</span>
}

export default function TabResumen({ snapshot, liveData, bandas, liveInflation }) {
  const [ipcStats, setIpcStats] = useState(null)

  useEffect(() => {
    const handler = e => setIpcStats(e.detail)
    window.addEventListener('ipc-stats', handler)
    return () => window.removeEventListener('ipc-stats', handler)
  }, [])

  useEffect(() => {
    const ipc = snapshot?.argentina_macro?.ipc_history
    if (!ipc) return
    const merged = { ...ipc }
    liveInflation?.forEach(item => { merged[item.fecha.substring(0,7)] = item.valor / 100 })
    const last12 = getLast12IPC(merged)
    if (last12.length) setIpcStats({ ...calcIpcStats(last12), last12 })
  }, [snapshot, liveInflation])

  const fiat = liveData?.fiat
  const usdt = liveData?.usdt

  const allPrices = fiat ? [
    { name: 'Oficial', price: fiat.oficial?.price, color: '#378ADD' },
    { name: 'MEP',     price: fiat.mep?.price,     color: '#1D9E75' },
    { name: 'CCL',     price: fiat.ccl?.price,     color: '#EF9F27' },
    { name: 'Blue',    price: fiat.blue?.price,    color: '#D85A30' },
    { name: 'USDT',    price: usdt?.maxVenta,       color: '#7F77DD' },
  ].filter(d => d.price > 0) : []
  const cheapest = allPrices.length ? allPrices.reduce((a, b) => a.price < b.price ? a : b) : null

  const purchasingPower = ipcStats
    ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(10000 * (1 + ipcStats.acum12m / 100))
    : null

  const macro = snapshot?.argentina_macro
  const holidays = macro?.holidays ?? []

  return (
    <div className="panel-ancho">
      <div className="radar-header" style={{ marginBottom: '24px' }}>
        <h2 className="macro-title" style={{ fontSize: '24px', margin: 0 }}>Radar de Inversión</h2>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Oportunidades destacadas en tiempo real</span>
      </div>

      <div className="radar-grid">
        {/* Dólar más barato */}
        <div className="radar-card">
          <div className="radar-card-icon" style={{ background: 'rgba(55, 138, 221, 0.1)', color: '#378ADD' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="radar-card-body">
            <span className="radar-card-label">DÓLAR MÁS BARATO</span>
            <span className="radar-card-value font-mono-bold">
              {cheapest ? formatARS(cheapest.price) : '...'}
            </span>
            <span className="radar-card-entity terminal-name">{cheapest?.name ?? '...'}</span>
          </div>
        </div>

        {/* Mejor cuenta */}
        <div className="radar-card">
          <div className="radar-card-icon">
            <EntityIcon name={liveData?._bestYield?.name} size={32} />
          </div>
          <div className="radar-card-body">
            <span className="radar-card-label">MEJOR CUENTA (TNA)</span>
            <span className="radar-card-value font-mono-bold" style={{ color: 'var(--green)' }}>
              {liveData?._bestYield?.rate ? `${liveData._bestYield.rate}%` : '...'}
            </span>
            <span className="radar-card-entity terminal-name">{liveData?._bestYield?.name ?? '...'}</span>
          </div>
        </div>

        {/* Mejor plazo fijo */}
        <div className="radar-card">
          <div className="radar-card-icon" style={{ background: 'rgba(112, 129, 255, 0.1)', color: 'var(--rate-color)' }}>
            <EntityIcon name={liveData?._bestPF?.name} size={32} />
          </div>
          <div className="radar-card-body">
            <span className="radar-card-label">MEJOR PLAZO FIJO (TNA)</span>
            <span className="radar-card-value font-mono-bold" style={{ color: 'var(--rate-color)' }}>
              {liveData?._bestPF?.rate ? `${liveData._bestPF.rate}%` : '...'}
            </span>
            <span className="radar-card-entity terminal-name">{liveData?._bestPF?.name ?? '...'}</span>
          </div>
        </div>

        {/* Mejor APY */}
        <div className="radar-card">
          <div className="radar-card-icon" style={{ background: 'rgba(255, 184, 0, 0.1)', color: 'var(--orange)' }}>
            <EntityIcon name={liveData?._bestCrypto?.name} size={32} />
          </div>
          <div className="radar-card-body">
            <span className="radar-card-label">MEJOR APY STABLES</span>
            <span className="radar-card-value font-mono-bold" style={{ color: 'var(--orange)' }}>
              {liveData?._bestCrypto?.rate ? `${liveData._bestCrypto.rate}%` : '...'}
            </span>
            <div className="flex items-center gap-2">
              <span className="radar-card-entity terminal-name">{liveData?._bestCrypto?.name ?? '...'}</span>
              {liveData?._bestCrypto?.coin && <span className="badge badge-orange">{liveData._bestCrypto.coin}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="radar-bottom-grid" style={{ marginTop: '24px' }}>
        <div className="macro-card inflation-panel" style={{ marginBottom: 0 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '24px' }}>
            <div className="radar-card-icon" style={{ width: 40, height: 40, background: 'rgba(239, 159, 39, 0.1)', color: 'var(--orange)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
            <div>
              <h3 className="macro-title" style={{ margin: 0, fontSize: '18px' }}>Inflación mensual (IPC)</h3>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Variación de precios minoristas (INDEC)</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {ipcStats && (
              <div className="inf-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div className="inf-kpi-card" style={{ background: 'var(--bg-card-solid)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div className="radar-card-label" style={{ marginBottom: '4px' }}>ÚLTIMO MES</div>
                  <div className="radar-card-value" style={{ color: 'var(--red)', fontSize: '24px' }}>{(ipcStats.lastMonth).toFixed(1).replace('.',',')}%</div>
                </div>
                <div className="inf-kpi-card" style={{ background: 'var(--bg-card-solid)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div className="radar-card-label" style={{ marginBottom: '4px' }}>PROMEDIO 12M</div>
                  <div className="radar-card-value" style={{ color: 'var(--yellow)', fontSize: '24px' }}>{ipcStats.avg12m.toFixed(1).replace('.',',')}%</div>
                </div>
                <div className="inf-kpi-card" style={{ background: 'var(--bg-card-solid)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div className="radar-card-label" style={{ marginBottom: '4px' }}>ACUM. 12M</div>
                  <div className="radar-card-value" style={{ color: 'var(--orange)', fontSize: '24px' }}>{ipcStats.acum12m.toFixed(1).replace('.',',')}%</div>
                </div>
              </div>
            )}

            <div className="inf-chart-container" style={{ height: '240px' }}>
              <InflacionChart ipcHistory={macro?.ipc_history} liveInflation={liveInflation} />
            </div>

            {purchasingPower && (
              <div style={{ 
                padding: '16px', background: 'rgba(255, 255, 255, 0.03)', 
                borderRadius: '12px', fontSize: '13px', color: 'var(--text-muted)',
                border: '1px dashed var(--border-color)'
              }}>
                📌 Algo que costaba $10.000 hace un año, hoy cuesta <strong style={{ color: 'var(--text-main)', fontStyle: 'normal' }}>{purchasingPower}</strong>.
              </div>
            )}
          </div>
        </div>

        <div className="macro-card" style={{ marginBottom: 0 }}>
          <h3 className="macro-title" style={{ fontSize: '18px', marginBottom: '20px' }}>🏖️ Próximos Feriados</h3>
          {holidays.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {holidays.map((h, i) => (
                <li key={i} style={{ 
                  padding: '14px 0', 
                  borderBottom: i < holidays.length - 1 ? '1px solid var(--border-color)' : 'none',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', opacity: 0.6 }} />
                  <span className="terminal-name" style={{ fontWeight: 500 }}>{h}</span>
                </li>
              ))}
            </ul>
          ) : (
             <div className="loading-placeholder">No hay feriados próximos</div>
          )}
        </div>
      </div>
    </div>
  )
}
