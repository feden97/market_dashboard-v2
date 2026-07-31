import React, { useState, useEffect, useMemo } from 'react'
import { formatARS, calcIpcStats, getLast12IPC } from '../utils/format'
import { EntityIcon } from '../utils/icons'
import InflacionChart from '../charts/InflacionChart'

function RadarCard({ icon, label, value, entity, detail, iconStyle }) {
  return (
    <div className="radar-card">
      <div className="radar-card-icon" style={iconStyle}>
        {icon}
      </div>
      <div className="radar-card-body">
        <span className="radar-card-label">{label}</span>
        <span className="radar-card-value">
          {value}
        </span>
        <span className="radar-card-entity">
          {entity}
        </span>
        {detail && (
          <div className="radar-card-detail">
            {detail}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TabResumen({ snapshot, liveData, liveInflation }) {
  const [ipcStats, setIpcStats] = useState(null)

  useEffect(() => {
    const ipc = snapshot?.argentina_macro?.ipc_history
    if (!ipc) return
    const merged = { ...ipc }
    if (Array.isArray(liveInflation)) {
      liveInflation.forEach(item => {
        if (item?.fecha && typeof item.fecha === 'string' && item?.valor != null) {
          merged[item.fecha.substring(0, 7)] = item.valor > 1 ? item.valor / 100 : item.valor
        }
      })
    }
    const last12 = getLast12IPC(merged)
    if (last12.length) setIpcStats({ ...calcIpcStats(last12), last12 })
  }, [snapshot, liveInflation])

  const fiat = liveData?.fiat
  const usdt = liveData?.usdt

  const allPrices = useMemo(() => fiat ? [
    { name: 'Oficial', price: fiat.oficial?.price },
    { name: 'MEP',     price: fiat.mep?.price },
    { name: 'CCL',     price: fiat.ccl?.price },
    { name: 'Blue',    price: fiat.blue?.price },
    { name: 'USDT',    price: usdt?.maxVenta },
  ].filter(d => d.price > 0) : [], [fiat, usdt])
  const cheapest = useMemo(() => allPrices.length ? allPrices.reduce((a, b) => a.price < b.price ? a : b) : null, [allPrices])

  const purchasingPower = useMemo(() => {
    return ipcStats
      ? formatARS(10000 * (1 + ipcStats.acum12m / 100), 0)
      : '--'
  }, [ipcStats])

  const macro = snapshot?.argentina_macro
  const holidays = macro?.holidays ?? []

  return (
    <div className="panel-ancho">
      {/* Section header */}
      <div className="radar-header">
        <span className="radar-tag">🚀 RADAR DE INVERSIÓN</span>
        <h2 className="radar-subtitle">Oportunidades destacadas del mercado</h2>
      </div>

      {/* 4 metric cards */}
      <div className="radar-grid">
        {/* Dólar más barato */}
        <RadarCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
          label="DÓLAR MÁS BARATO"
          value={cheapest ? formatARS(cheapest.price) : '$0,00'}
          entity={cheapest?.name ?? '...'}
        />

        {/* Mejor cuenta remunerada */}
        <RadarCard
          iconStyle={{ background: 'transparent', padding: 0 }}
          icon={
            liveData?._bestYield?.name ? (
              <EntityIcon name={liveData._bestYield.name} size={44} />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            )
          }
          label="MEJOR CUENTA (TNA)"
          value={liveData?._bestYield?.rate ? `${liveData._bestYield.rate}%` : '0,00%'}
          entity={liveData?._bestYield?.name ?? '...'}
        />

        {/* Mejor plazo fijo */}
        <RadarCard
          iconStyle={{ background: 'transparent', padding: 0 }}
          icon={
            liveData?._bestPF?.name ? (
              <EntityIcon name={liveData._bestPF.name} size={44} />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 3l9 7H3l9-7z" />
              </svg>
            )
          }
          label="MEJOR PLAZO FIJO (TNA)"
          value={liveData?._bestPF?.rate ? `${liveData._bestPF.rate}%` : '0,00%'}
          entity={liveData?._bestPF?.name ?? '...'}
        />

        {/* Mejor APY stablecoins */}
        <RadarCard
          iconStyle={{ background: 'transparent', padding: 0 }}
          icon={
            liveData?._bestCrypto?.name ? (
              <EntityIcon name={liveData._bestCrypto.name} size={44} />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v12M15 9.5H10.5a2.5 2.5 0 0 0 0 5H14a2.5 2.5 0 0 1 0 5H9" />
              </svg>
            )
          }
          label="MEJOR APY STABLES"
          value={liveData?._bestCrypto?.rate ? `${liveData._bestCrypto.rate}%` : '0,00%'}
          entity={liveData?._bestCrypto?.name ?? '...'}
          detail={liveData?._bestCrypto?.coin ? `(${liveData._bestCrypto.coin})` : ''}
        />
      </div>

      {/* Bottom row: Inflación + Feriados */}
      <div className="radar-bottom-grid">
        {/* Inflation panel */}
        <div className="radar-bottom-card inflation-panel">
          <div className="radar-bottom-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <h3 className="radar-bottom-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              Inflación mensual (IPC)
            </h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Cuánto subieron los precios cada mes según el INDEC.
            </span>
          </div>

          <div className="radar-bottom-body" style={{ padding: '16px' }}>
            <div className="inf-kpi-grid">
              <div className="inf-kpi-card">
                <div className="inf-kpi-label">ÚLTIMO MES</div>
                <div id="inf-last-month" className="inf-kpi-value text-red">
                  {ipcStats ? `${ipcStats.lastMonth.toFixed(1).replace('.', ',')}%` : '--'}
                </div>
              </div>
              <div className="inf-kpi-card">
                <div className="inf-kpi-label">PROMEDIO 12M</div>
                <div id="inf-avg-12m" className="inf-kpi-value text-yellow">
                  {ipcStats ? `${ipcStats.avg12m.toFixed(1).replace('.', ',')}%` : '--'}
                </div>
              </div>
              <div className="inf-kpi-card">
                <div className="inf-kpi-label">ACUM. 12M</div>
                <div id="inf-acum-12m" className="inf-kpi-value text-orange">
                  {ipcStats ? `${ipcStats.acum12m.toFixed(1).replace('.', ',')}%` : '--'}
                </div>
              </div>
            </div>

            <div className="inf-chart-container">
              <InflacionChart ipcHistory={macro?.ipc_history} liveInflation={liveInflation} />
            </div>

            <div className="inf-footer-card">
              📌 <span id="inf-purchasing-power">
                Algo que costaba $10.000 hace un año, hoy cuesta <strong>{purchasingPower}</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* Upcoming holidays */}
        <div className="radar-bottom-card">
          <div className="radar-bottom-header">
            <h3 className="radar-bottom-title">🏖️ PRÓXIMOS FERIADOS</h3>
          </div>
          <ul id="feriados-list" className="macro-list-premium">
            {holidays.length > 0 ? (
              holidays.map((h, i) => (
                <li key={i}>{h}</li>
              ))
            ) : (
              <li className="text-muted">Cargando datos...</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
