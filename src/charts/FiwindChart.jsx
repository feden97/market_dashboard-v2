import { useEffect, useRef } from 'react'
import { Chart } from './chartRuntime'
import { fiwindAxisRange, fiwindChartPoints } from '../utils/fiwind.js'

const formatPrice = value => Number(value).toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const dateLabel = time => new Date(time).toLocaleString('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
})

export default function FiwindChart({ quotes, side = 'bid', theme, hours, now }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const style = getComputedStyle(canvas.closest('.fiwind-panel'))
    const color = name => style.getPropertyValue(name).trim()
    const ink = color('--fw-muted')
    const grid = color('--fw-grid')
    const accent = color(side === 'bid' ? '--fw-bid' : '--fw-ask')
    const surface = color('--fw-inset')
    const text = color('--fw-text')
    const lastPricePlugin = {
      id: 'fiwindLastPrice',
      afterDatasetsDraw(chart) {
        const points = chart.data.datasets[0].data
        const last = points.at(-1)
        const area = chart.chartArea
        if (!last || !area || last.y == null) return
        const { ctx, scales: { x, y } } = chart
        const py = y.getPixelForValue(last.y)
        const px = x.getPixelForValue(last.x)
        const label = formatPrice(last.y)
        const badgeX = area.right + 10
        ctx.save()
        ctx.strokeStyle = accent
        ctx.lineWidth = 1
        ctx.setLineDash([3, 4])
        ctx.beginPath(); ctx.moveTo(px + 7, py); ctx.lineTo(badgeX - 3, py); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = accent
        ctx.beginPath(); ctx.roundRect(badgeX, py - 12, 52, 24, 5); ctx.fill()
        ctx.fillStyle = surface
        ctx.font = '600 11px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(label, badgeX + 26, py)
        ctx.fillStyle = ink; ctx.font = '10px Inter, system-ui, sans-serif'
        ctx.fillText(last.live ? 'Actual' : 'Último', badgeX + 26, py - 23)
        const active = chart.tooltip?.getActiveElements()
        if (active?.length) {
          const ax = active[0].element.x
          ctx.strokeStyle = grid; ctx.setLineDash([3, 4])
          ctx.beginPath(); ctx.moveTo(ax, area.top); ctx.lineTo(ax, area.bottom); ctx.stroke()
        }
        ctx.restore()
      },
    }
    const chart = new Chart(canvas, {
      type: 'line',
      data: { datasets: [{
        label: side === 'bid' ? 'Vendés USDT' : 'Comprás USDT', data: [],
        borderColor: accent, borderWidth: 2, tension: 0, spanGaps: false, fill: false,
        pointRadius: context => context.raw?.live ? 5 : 3,
        pointBackgroundColor: context => context.raw?.live ? surface : accent,
        pointBorderColor: context => context.raw?.live ? accent : surface,
        pointBorderWidth: context => context.raw?.live ? 2.5 : 1.5,
        pointHoverRadius: 6, pointHitRadius: 12,
        segment: { borderDash: context => context.p1.raw?.live ? [4, 4] : [] },
      }] },
      plugins: [lastPricePlugin],
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
        layout: { padding: { top: 20, right: 72, bottom: 4, left: 0 } },
        interaction: { mode: 'nearest', axis: 'xy', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: color('--fw-surface'), titleColor: text, bodyColor: text,
            borderColor: color('--fw-line'), borderWidth: 1, padding: 12,
            displayColors: false, titleFont: { size: 11, weight: 'normal' }, bodyFont: { size: 13, weight: '600' },
            callbacks: {
              title: items => items[0] ? dateLabel(items[0].parsed.x) + ' · ART' : '',
              label: item => `${formatPrice(item.parsed.y)} USD / USDT`,
              afterLabel: item => item.raw.live ? 'Precio actual · aún no guardado' : 'Registro histórico guardado',
            },
          },
        },
        scales: {
          x: {
            type: 'linear', border: { display: false }, grid: { display: false },
            ticks: { color: ink, font: { size: 10 }, maxTicksLimit: 5, maxRotation: 0, minRotation: 0, padding: 10 },
          },
          y: {
            border: { display: false }, grid: { color: grid, drawTicks: false },
            ticks: { padding: 12, autoSkip: false, color: ink, font: { size: 11 }, callback: formatPrice },
          },
        },
      },
    })
    chartRef.current = chart
    return () => { chart.destroy(); chartRef.current = null }
  }, [side, theme])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.options.scales.x.min = now - hours * 3_600_000
    chart.options.scales.x.max = now
    const axis = fiwindAxisRange(quotes, side)
    chart.options.scales.y.min = axis.min
    chart.options.scales.y.max = axis.max
    chart.options.scales.y.ticks.stepSize = axis.stepSize
    chart.options.scales.x.ticks.callback = value => {
      const date = new Date(value)
      const day = date.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit' })
      return hours === 24 ? [date.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }), day] : day
    }
    chart.data.datasets[0].data = fiwindChartPoints(quotes, side)
    chart.update('none')
  }, [quotes, hours, now, side, theme])

  return <div className="fw-plot">
    <canvas ref={canvasRef} role="img" aria-label={`Evolución de ${side === 'bid' ? 'venta' : 'compra'} de USDT en Fiwind. ${quotes.length} observaciones en ${hours} horas; cada punto es una cotización disponible. Valores en USD por USDT.`} />
    {!quotes.length && <div className="fw-plot-empty"><strong>Sin cotizaciones en este período</strong><span>Seleccioná un período más amplio o actualizá los datos.</span></div>}
  </div>
}
