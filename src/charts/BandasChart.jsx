import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Chart } from './chartRuntime'
import { formatARS, toFiniteNumber } from '../utils/format'
import { buildBandasChartData, getBandaForToday, getGaugePosition, getZoneInfo } from '../utils/bandas'

const fmt = formatARS

export default function BandasChart({ bandas, historicalFiat, fullHolidays, liveMayorista, theme }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const [view, setView] = useState('chart') // 'chart' | 'table'
  const chartData = useMemo(
    () => buildBandasChartData(bandas, historicalFiat, fullHolidays, liveMayorista),
    [bandas, historicalFiat, fullHolidays, liveMayorista],
  )
  const bandaHoy = useMemo(() => getBandaForToday(bandas), [bandas])
  const live = toFiniteNumber(liveMayorista)
  const lastHistMay = chartData.dataMay.filter(price => price != null && price > 0).at(-1)
  const may = live != null && live > 0 ? live : lastHistMay ?? null

  useEffect(() => {
    if (!bandaHoy || view !== 'chart' || !canvasRef.current) return
    const isLight = (theme || document.documentElement.getAttribute('data-theme')) === 'light'
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'
    const textColor = isLight ? '#64748b' : '#aaaaaa'

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Banda Superior',
            data: [],
            borderColor: '#f97316',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            tension: 0.2,
          },
          {
            label: 'Banda Inferior',
            data: [],
            borderColor: '#ef4444',
            borderWidth: 2,
            pointRadius: 0,
            fill: '-1',
            backgroundColor: 'rgba(249,115,22,0.05)',
            tension: 0.2,
          },
          {
            label: 'Mayorista',
            data: [],
            borderColor: '#10b981',
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.2,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        resizeDelay: 200,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, usePointStyle: true, pointStyleWidth: 12, boxWidth: 8, padding: 16, font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            titleColor: '#94a3b8',
            bodyColor: '#fff',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: { label: ctx => ctx.parsed.y != null ? `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` : null },
          },
        },
        scales: {
          x: { ticks: { color: textColor, maxTicksLimit: 8, font: { size: 11 } }, grid: { color: gridColor } },
          y: { ticks: { color: textColor, font: { size: 11 }, callback: v => fmt(v) }, grid: { color: gridColor } },
        },
        interaction: { mode: 'index', intersect: false },
      },
    })
    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [view, theme, bandaHoy])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.data.labels = [...chartData.labels]
    chart.data.datasets[0].data = [...chartData.dataSup]
    chart.data.datasets[1].data = [...chartData.dataInf]
    chart.data.datasets[2].data = [...chartData.dataMay]
    chart.update('none')
  }, [chartData, view, theme, bandaHoy])

  if (!bandaHoy) return <div className="loading-placeholder">Sin datos de bandas para esta fecha.</div>

  const { inf, sup } = bandaHoy
  const rango = Math.max(1, sup - inf)

  const posPct = getGaugePosition(may, inf, sup)
  const rotation = ((posPct ?? 0) / 100) * 180 - 90
  const { color: boxBg, textColor: boxColor } = getZoneInfo(posPct)
  const dS = may != null ? sup - may : null
  const dI = may != null ? inf - may : null
  const pS = may > 0 ? Math.abs(dS / may) * 100 : null
  const pI = may > 0 ? Math.abs(dI / may) * 100 : null

  const c25 = inf + rango * 0.25
  const c75 = inf + rango * 0.75
  const c90 = inf + rango * 0.90

  return (
    <div>
      {/* ── Gauge + info row ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 30, alignItems: 'flex-start', marginBottom: 25 }}>
        {/* Gauge col */}
        <div style={{ flex: '1 1 280px', minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 10 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 340, aspectRatio: '2/1', height: 'auto', margin: '20px auto 0' }}>
            <span id="velocimetro-mid" style={{ position: 'absolute', top: -25, left: '50%', transform: 'translateX(-50%)', color: '#9ca3af', fontSize: '0.9em', fontWeight: 'bold' }}>
              {fmt(inf + rango / 2)}
            </span>
            <span id="velocimetro-inf" style={{ position: 'absolute', bottom: -25, left: 0, color: '#9ca3af', fontSize: '0.9em', fontWeight: 'bold' }}>
              {fmt(inf)}
            </span>
            <span id="velocimetro-sup" style={{ position: 'absolute', bottom: -25, right: 0, color: '#9ca3af', fontSize: '0.9em', fontWeight: 'bold' }}>
              {fmt(sup)}
            </span>
            <div style={{
              width: '100%', height: '200%', borderRadius: '50%',
              background: 'conic-gradient(from 270deg at 50% 50%, #10b981 0deg 45deg, #facc15 45deg 135deg, #f97316 135deg 162deg, #ef4444 162deg 180deg, transparent 180deg 360deg)',
              WebkitMaskImage: 'radial-gradient(transparent 55%, black 56%)',
              maskImage: 'radial-gradient(transparent 55%, black 56%)'
            }} />
            <div id="gauge-needle" style={{
              display: posPct == null ? 'none' : 'block',
              position: 'absolute', bottom: 0, left: '50%', width: 6, height: 120,
              backgroundColor: '#ffffff', transformOrigin: 'bottom center',
              transform: `translateX(-50%) rotate(${rotation}deg)`,
              transition: 'transform 1.5s cubic-bezier(0.22, 1, 0.36, 1)',
              borderRadius: 6, boxShadow: '0 0 6px rgba(0,0,0,0.5)', zIndex: 10
            }} />
            <div style={{
              position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
              width: 24, height: 24, backgroundColor: '#ffffff', borderRadius: '50%',
              zIndex: 11, boxShadow: '0 0 5px rgba(0,0,0,0.5)'
            }} />
          </div>
          <div style={{ textAlign: 'center', margin: '35px 0 10px 0' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
              Dólar Mayorista
            </div>
            <div id="gauge-mayorista-box" style={{
              display: 'inline-block', fontSize: '1.8em', fontWeight: 'bold',
              backgroundColor: boxBg, color: boxColor, padding: '4px 16px',
              borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
              {fmt(may)}
            </div>
            {!(live > 0) && may != null && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>Última cotización del historial</div>}
          </div>
        </div>

        {/* Range table col */}
        <div style={{ flex: '1.5 1 350px', minWidth: 0, width: '100%', overflowX: 'auto' }}>
          <table className="data-table" style={{ marginBottom: 20 }}>
            <thead>
              <tr>
                <th scope="col">Estado</th>
                <th scope="col">Rango (%)</th>
                <th scope="col">Valor mínimo</th>
                <th scope="col">Valor máximo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span style={{ color: 'var(--green)', fontWeight: 600 }}>● Favorable</span></td>
                <td>0 - 25%</td>
                <td id="r-fav-min">{fmt(inf)}</td>
                <td id="r-fav-max">{fmt(c25)}</td>
              </tr>
              <tr>
                <td><span style={{ color: '#facc15', fontWeight: 600 }}>● Intermedio</span></td>
                <td>25 - 75%</td>
                <td id="r-int-min">{fmt(c25)}</td>
                <td id="r-int-max">{fmt(c75)}</td>
              </tr>
              <tr>
                <td><span style={{ color: 'var(--orange)', fontWeight: 600 }}>● Precaución</span></td>
                <td>75 - 90%</td>
                <td id="r-pre-min">{fmt(c75)}</td>
                <td id="r-pre-max">{fmt(c90)}</td>
              </tr>
              <tr>
                <td><span style={{ color: 'var(--red)', fontWeight: 600 }}>● Crítico</span></td>
                <td>90 - 100%</td>
                <td id="r-cri-min">{fmt(c90)}</td>
                <td id="r-cri-max">{fmt(sup)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{
            backgroundColor: 'var(--bg-card-solid)', padding: 16,
            borderRadius: 'var(--radius-sm)', fontSize: 14, color: 'var(--text-main)',
            borderLeft: '4px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: 8
          }}>
            <div id="diff-sup">
              Para llegar a la banda superior: {dS == null ? 'sin cotización' : dS >= 0 ? 'subir' : 'bajar'}{' '}
              <span className="badge-green" style={{ marginLeft: '4px' }}>
                {dS != null ? `${fmt(Math.abs(dS))} (${pS.toFixed(2)}%)` : '—'}
              </span>
            </div>
            <div id="diff-inf">
              Para llegar a la banda inferior: {dI == null ? 'sin cotización' : dI >= 0 ? 'subir' : 'bajar'}{' '}
              <span className="badge-red" style={{ marginLeft: '4px' }}>
                {dI != null ? `${fmt(Math.abs(dI))} (${pI.toFixed(2)}%)` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chart / Table toggle ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <div style={{ backgroundColor: 'var(--bg-card-solid)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', overflow: 'hidden', padding: 4, gap: 4 }}>
          <button id="btn-bandas-chart" type="button" aria-pressed={view === 'chart'} className="view-toggle-btn" style={{ backgroundColor: view === 'chart' ? 'var(--bg-card-hover)' : 'transparent', color: view === 'chart' ? 'var(--text-main)' : 'var(--text-muted)', border: 'none', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: view === 'chart' ? 600 : 500, borderRadius: 8 }} onClick={() => setView('chart')}>Gráfico</button>
          <button id="btn-bandas-table" type="button" aria-pressed={view === 'table'} className="view-toggle-btn" style={{ backgroundColor: view === 'table' ? 'var(--bg-card-hover)' : 'transparent', color: view === 'table' ? 'var(--text-main)' : 'var(--text-muted)', border: 'none', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: view === 'table' ? 600 : 500, borderRadius: 8 }} onClick={() => setView('table')}>Tabla</button>
        </div>
      </div>

      {/* ── Chart view ── */}
      {view === 'chart' && (
        <div id="bandas-chart-view" style={{ height: 250, width: '100%', position: 'relative' }}>
          <canvas id="bandasChart" ref={canvasRef} role="img" aria-label="Evolución de las bandas y el dólar mayorista. Cambiá a Tabla para consultar los valores por fecha." />
        </div>
      )}

      {/* ── Table view ── */}
      {view === 'table' && chartData && (
        <div id="bandas-table-view" style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
          <table className="data-table" style={{ fontSize: 13, margin: 0, width: '100%', textAlign: 'left', border: 'none' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card-solid)', zIndex: 10, borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th scope="col" style={{ padding: 8 }}>Fecha</th>
                <th scope="col" style={{ padding: 8 }}>Mayorista</th>
                <th scope="col" style={{ padding: 8 }}>Techo</th>
                <th scope="col" style={{ padding: 8 }}>Piso</th>
              </tr>
            </thead>
            <tbody id="bandas-table-wrapper-body">
              {[...chartData.labels].reverse().map((lbl, i) => {
                const ri = chartData.labels.length - 1 - i
                return (
                  <tr key={lbl}>
                    <td style={{ padding: 8, color: 'var(--text-muted)', fontWeight: 600 }}>{lbl}</td>
                    <td style={{ padding: 8, color: 'var(--green)', fontWeight: 'bold' }}>{chartData.dataMay[ri] ? fmt(chartData.dataMay[ri]) : '-'}</td>
                    <td style={{ padding: 8, color: 'var(--orange)', fontWeight: 'bold' }}>{fmt(chartData.dataSup[ri])}</td>
                    <td style={{ padding: 8, color: 'var(--red)', fontWeight: 'bold' }}>{fmt(chartData.dataInf[ri])}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
