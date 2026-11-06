import { useEffect, useRef } from 'react'
import { Chart } from './chartRuntime'
import { fiwindChartPoints } from '../utils/fiwind.js'

const dateLabel = (time, full = false) => new Date(time).toLocaleString('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit',
  ...(full ? { year: 'numeric' } : {}), hour: '2-digit', minute: '2-digit', hour12: false,
})

export default function FiwindChart({ quotes, theme, hours, now }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const light = theme === 'light'
    const text = light ? '#64748b' : '#94a3b8'
    const grid = light ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)'
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { datasets: [
        { label: 'Venta', data: [], borderColor: light ? '#078347' : '#00ff6a', backgroundColor: light ? '#078347' : '#00ff6a' },
        { label: 'Compra', data: [], borderColor: light ? '#5362cf' : '#929dff', backgroundColor: light ? '#5362cf' : '#929dff' },
      ] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        parsing: false,
        elements: { line: { borderWidth: 2, tension: 0, spanGaps: false }, point: { radius: 0, hoverRadius: 4, hitRadius: 10 } },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { color: text, boxWidth: 12, boxHeight: 2, padding: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              title: items => items[0] ? dateLabel(items[0].parsed.x, true) + ' · ART' : '',
              label: item => `${item.dataset.label}: ${item.parsed.y?.toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} USD`,
            },
          },
        },
        scales: {
          x: { type: 'linear', border: { display: false }, grid: { display: false }, ticks: { color: text, maxTicksLimit: 5, font: { size: 10 }, callback: value => dateLabel(value) } },
          y: { border: { display: false }, grid: { color: grid, drawTicks: false }, ticks: { padding: 8, maxTicksLimit: 4, font: { size: 10 }, color: text, callback: value => Number(value).toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 4 }) }, title: { display: false } },
        },
      },
    })
    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [theme])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const end = now
    const start = end - hours * 3_600_000
    chart.options.scales.x.min = start
    chart.options.scales.x.max = end
    chart.options.scales.x.ticks.callback = value => new Date(value).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      ...(hours === 24 ? { hour: '2-digit', minute: '2-digit', hour12: false } : { day: '2-digit', month: '2-digit' }),
    })
    chart.data.datasets[0].data = fiwindChartPoints(quotes, 'bid')
    chart.data.datasets[1].data = fiwindChartPoints(quotes, 'ask')
    chart.data.datasets[0].pointRadius = quotes.length === 1 ? 4 : 0
    chart.data.datasets[1].pointRadius = quotes.length === 1 ? 4 : 0
    chart.update('none')
  }, [quotes, hours, now, theme])

  return <div className="fiwind-chart">
    <canvas ref={canvasRef} role="img" aria-label={`Histórico Fiwind: venta y compra de USDT en USD. ${quotes.length} muestras en las últimas ${hours} horas.`} />
    {!quotes.length && <p className="chart-empty">Todavía no hay muestras guardadas en este período.</p>}
  </div>
}
