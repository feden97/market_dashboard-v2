import { EntityIcon, QUESTION_MARK_SVG } from '../utils/icons'

function TerminalRow({ name, rate, rateLabel = 'TNA', subLabel, pills = [], isBest, dateInfo, rateColor, tooltipText = '' }) {
  return (
    <div className={`terminal-row${isBest ? ' terminal-highlight' : ''}`}>
      <div className="terminal-entity">
        <div className="terminal-logo">
          <EntityIcon name={name} size={24} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="terminal-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {name}
            {tooltipText && (
              <div className="tooltip-container tooltip-right" style={{ cursor: 'help' }}>
                {QUESTION_MARK_SVG}
                <div className="tooltip-text" style={{ fontWeight: 600, textAlign: 'left', minWidth: '200px' }}>
                  {tooltipText}
                </div>
              </div>
            )}
          </div>
          <div className="terminal-sub-label">{subLabel}</div>
          {pills.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {pills.map((p, i) => <span key={i} className={`terminal-meta-pill ${p.cls}`}>{p.text}</span>)}
            </div>
          )}
        </div>
      </div>
      <div className="terminal-data">
        <div className="terminal-rate-container" style={rateColor ? { color: rateColor } : {}}>
          <div className="mono-rate mono-bold">{rate}</div>
          <div className="terminal-rate-label">{rateLabel}</div>
        </div>
      </div>
      {dateInfo && (
        <div style={{ width: '100%', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', marginTop: 6, opacity: 0.8 }}>
          {dateInfo}
        </div>
      )}
    </div>
  )
}

export default function TabTasas({ tasas, displayMode }) {
  if (!tasas || tasas.loading) {
    return (
      <div className="panel-ancho">
        <h2 style={{ color: 'var(--text-main)', margin: '0 0 20px', fontSize: '18px', fontWeight: 600 }}>
          Tasas de Interés y Rendimientos
        </h2>
        <div className="terminal-container">
          <div className="terminal-header"><div className="terminal-title">Cargando tasas...</div></div>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px', fontSize: '13px' }}>Obteniendo datos de la API...</div>
        </div>
      </div>
    )
  }

  const { plazosFijos, cuentasRemuneradas, fci, yields } = tasas

  return (
    <div className="panel-ancho">
      <h2 style={{ color: 'var(--text-main)', margin: '0 0 20px', fontSize: '18px', fontWeight: 600 }}>
        Tasas de Interés y Rendimientos
      </h2>

      {displayMode === 'pesos' && (
        <div id="tasas-pesos" style={{ display: 'block', animation: 'fadeIn 0.4s ease forwards', maxWidth: '1100px', margin: '0 auto', padding: '0 20px' }}>
          {/* Cuentas remuneradas */}
          <div className="terminal-container">
            <div className="terminal-header">
              <div className="terminal-title">💳 Cuentas Remuneradas y Billeteras</div>
              <div className="terminal-subtitle">TNA Fija, garantizada. Ingreso y retiro de saldo inmediato. Plazo mínimo 1 día</div>
            </div>
            <div id="ars-accounts-container">
              {cuentasRemuneradas?.length
                ? cuentasRemuneradas.map((acc, i) => {
                    const pills = []
                    if (acc.limit) pills.push({ cls: 'pill-limit', text: acc.limit })
                    return (
                      <TerminalRow
                        key={acc.name}
                        name={acc.name}
                        rate={(acc.tna * 100).toFixed(2) + '%'}
                        subLabel={acc.subLabel}
                        tooltipText={acc.tooltip}
                        pills={pills}
                        isBest={i === 0}
                        dateInfo={acc.date ? `TNA vigente desde el ${acc.date.split('-').reverse().join('/')}` : ''}
                      />
                    )
                  })
                : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px', fontSize: '13px' }}>Cargando cuentas...</div>
              }
            </div>
          </div>

          {/* Plazo fijo */}
          <div className="terminal-container">
            <div className="terminal-header">
              <div className="terminal-title">🏦 Plazo Fijo</div>
              <div className="terminal-subtitle">TNA Fija, garantizada. Plazo mínimo 30 días</div>
            </div>
            <div id="ars-pf-list">
              {plazosFijos?.length
                ? plazosFijos.map((pf, i) => (
                    <TerminalRow
                      key={pf.name}
                      name={pf.name}
                      rate={(pf.rate * 100).toFixed(2) + '%'}
                      subLabel="Plazo Fijo"
                      isBest={i === 0}
                      pills={[]}
                      dateInfo={pf.date ? `Vigente desde: ${pf.date.split('-').reverse().join('/')}` : ''}
                    />
                  ))
                : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px', fontSize: '13px' }}>Cargando...</div>
              }
            </div>
          </div>

          {/* FCI */}
          <div className="terminal-container">
            <div className="terminal-header">
              <div className="terminal-title">📊 Fondos Comunes de Inversión</div>
              <div className="terminal-subtitle">TNA Variable. Retiro de saldo variable (inmediato o T+1)</div>
            </div>
            <div id="ars-fci-container">
              {fci?.length
                ? fci.map((f, i) => (
                    <TerminalRow
                      key={f.name}
                      name={f.name}
                      rate={(f.rate * 100).toFixed(2) + '%'}
                      rateLabel="TNA aprox."
                      subLabel={f.desc}
                      isBest={i === 0}
                      pills={[]}
                      dateInfo={f.dateStr}
                      rateColor="var(--orange)"
                    />
                  ))
                : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px', fontSize: '13px' }}>Cargando FCI...</div>
              }
            </div>
          </div>
        </div>
      )}

      {displayMode === 'cripto' && yields && (
        <div id="tasas-cripto" style={{ display: 'block', animation: 'fadeIn 0.4s ease forwards', maxWidth: '100%', margin: '0 auto', overflow: 'hidden' }}>
          <div className="tasas-section-title" style={{ marginBottom: '14px' }}>🪙 Rendimientos en Stablecoins</div>
          <div className="tasas-section-sub">
            Tasas APY ofrecidas por plataformas cripto argentinas. La mejor tasa de cada moneda se destaca en verde.
          </div>
          <div className="yield-matrix-container" id="yield-matrix-wrapper">
            <div className="data-table-wrapper">
              <table className="yield-matrix">
                <thead>
                  <tr>
                    <th scope="col">Criptomoneda</th>
                    {yields.entities.map(ent => (
                      <th scope="col" key={ent}>
                        <div className="matrix-exchange-header">
                          <EntityIcon name={yields.displayMap[ent] || ent} size={22} />
                          <span>{yields.displayMap[ent] || ent}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {yields.coins.map(coin => (
                    <tr key={coin}>
                      <td>
                        <div className="matrix-coin-cell">
                          <div className="matrix-coin-icon">
                            <EntityIcon name={coin} size={24} />
                          </div>
                          <span>{coin}</span>
                        </div>
                      </td>
                      {yields.entities.map((ent, entIdx) => {
                        const rate = yields.rateMap[ent][coin]
                        const isBest = rate !== null && rate === yields.bestPerCoin[coin]
                        const dir = entIdx >= 3 ? 'tooltip-left' : 'tooltip-right'

                        let cellContent = '—'
                        if (rate !== null) {
                          let tooltipHtml = null
                          const showTooltip = yields.tiersMap && yields.tiersMap[ent] && yields.tiersMap[ent][coin]
                          if (showTooltip) {
                            tooltipHtml = (
                              <div className={`tooltip-container ${dir}`} style={{ marginLeft: 4, cursor: 'help' }}>
                                {QUESTION_MARK_SVG}
                                <div className="tooltip-text" style={{ fontWeight: 600, textAlign: 'left', minWidth: '200px' }}>
                                  Tasa máxima detectada.<br/>El rendimiento varía según condiciones de la plataforma.
                                </div>
                              </div>
                            )
                          }
                          const containerCls = showTooltip ? 'apy-container has-tooltip' : 'apy-container'
                          cellContent = (
                            <div className={containerCls}>
                              <span className="apy-value">{rate.toFixed(2)}%</span>
                              {tooltipHtml}
                            </div>
                          )
                        }

                        let targetCls = rate !== null ? (isBest ? 'yield-cell best-yield' : 'yield-cell') : 'yield-na hide-mobile'

                        return (
                          <td key={ent} className={targetCls} data-exchange={yields.displayMap[ent] || ent}>
                            <div className="exchange-label-mobile">
                                <div className="matrix-exchange-icon">
                                    <EntityIcon name={yields.displayMap[ent] || ent} size={18} />
                                </div>
                                <span>{yields.displayMap[ent] || ent}</span>
                            </div>
                            {cellContent}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
