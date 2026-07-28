import React, { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const BASE_LABELS = { usdt: 'USDT', oficial: 'Oficial', mep: 'MEP', ccl: 'CCL', blue: 'Blue' }

export default function SpreadChart({ historicalFiat, liveData, base, setBase }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const [summary, setSummary] = useState({ cclWins: 0, baseWins: 0 })

  function buildHistoricalData(baseCurrency) {
    if (!historicalFiat?.length) return { labels: [], data: [] }
    const labels = [], data = []

    for (const d of historicalFiat) {
      const target = d.ccl
      const baseVal = baseCurrency === 'usdt' ? d.usdt : d[baseCurrency]
      if (target && baseVal && baseVal > 0) {
        labels.push(d.date)
        data.push(parseFloat((((target / baseVal) - 1) * 100).toFixed(2)))
      }
    }
    return { labels, data }
  }

  function calcSummary(data) {
    let cclWins = 0, baseWins = 0
    data.forEach(v => { if (v > 0) cclWins++; else if (v < 0) baseWins++ })
    return { cclWins, baseWins }
  }

  // 1) Carga inicial e histórica (se ejecuta una vez o al cambiar 'base')
  useEffect(() => {
    if (!historicalFiat?.length) return

    const isLight = document.documentElement.getAttribute('data-theme') === 'light'
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'
    const textColor = isLight ? '#64748b' : '#aaaaaa'

    const { labels, data } = buildHistoricalData(base)
    setSummary(calcSummary(data))

    const zonesPlugin = {
      id: 'zones',
      beforeDraw(chart) {
        if (base !== 'usdt') return
        const { ctx, chartArea, scales: { y } } = chart
        const lt = document.documentElement.getAttribute('data-theme') === 'light'
        ctx.save()
        const drawZone = (yMin, yMax, color, text, big = false) => {
          const top = y.getPixelForValue(yMax)
          const bot = y.getPixelForValue(yMin)
          const dTop = Math.max(top, chartArea.top)
          const dBot = Math.min(bot, chartArea.bottom)
          if (dTop >= dBot) return
          ctx.fillStyle = color
          ctx.fillRect(chartArea.left, dTop, chartArea.width, dBot - dTop)
          if (text && window.innerWidth >= 768) {
            ctx.fillStyle = lt
              ? `rgba(0,0,0,${big ? 0.3 : 0.18})`
              : `rgba(255,255,255,${big ? 0.3 : 0.18})`
            ctx.font = `700 ${big ? '22px' : '16px'} Inter, sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(text, chartArea.left + chartArea.width / 2, dTop + (dBot - dTop) / 2)
          }
        }
        drawZone(2.0, y.max, 'rgba(239,68,68,0.14)', 'VENDER CEDEARs — COMPRAR USDT', true)
        drawZone(1.0, 2.0, 'rgba(239,68,68,0.05)', 'Oportunidad de venta CEDEARs o compra USDT')
        drawZone(-2.0, -1.0, 'rgba(16,185,129,0.05)', 'Oportunidad de venta USDT o compra CEDEARs')
        drawZone(y.min, -2.0, 'rgba(16,185,129,0.14)', 'VENDER USDT — COMPRAR CEDEARs', true)
        ctx.restore()
      },
    }

    const zeroLinePlugin = {
      id: 'zeroLine',
      afterDraw(chart) {
        const yScale = chart.scales.y
        if (!yScale) return
        const yPx = yScale.getPixelForValue(0)
        if (yPx < yScale.top || yPx > yScale.bottom) return
        const lt = document.documentElement.getAttribute('data-theme') === 'light'
        chart.ctx.save()
        chart.ctx.beginPath()
        chart.ctx.moveTo(chart.chartArea.left, yPx)
        chart.ctx.lineTo(chart.chartArea.right, yPx)
        chart.ctx.lineWidth = 1.5
        chart.ctx.strokeStyle = lt ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.28)'
        chart.ctx.setLineDash([4, 4])
        chart.ctx.stroke()
        chart.ctx.restore()
      },
    }

    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderWidth: 2.5,
          pointRadius: ctx => ctx.dataIndex === ctx.dataset.data.length - 1 ? 4 : 0,
          pointBackgroundColor: ctx => ctx.dataset.data[ctx.dataIndex] >= 0
            ? 'rgba(16,185,129,1)' : 'rgba(239,68,68,1)',
          pointHoverRadius: 5,
          fill: false,
          tension: 0.15,
          segment: {
            borderColor: ctx => (ctx.p0?.parsed?.y ?? 0) >= 0
              ? 'rgba(16,185,129,1)' : 'rgba(239,68,68,1)',
          },
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Animacion nativa desactivada si cambiamos datos muy rápido
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            titleColor: '#94a3b8', bodyColor: '#fff',
            borderColor: '#334155', borderWidth: 1,
            displayColors: false,
            callbacks: {
              title: items => items[0].label,
              label: ctx => `Spread CCL vs ${BASE_LABELS[base]}: ${ctx.parsed.y.toFixed(2)}%`,
            },
          },
        },
        scales: {
          x: {
            display: true,
            offset: true,
            ticks: { color: textColor, maxTicksLimit: 8, font: { size: 11 } },
            grid: { color: gridColor },
          },
          y: {
            display: true,
            ticks: {
              color: textColor,
              font: { size: 11 },
              callback: v => v.toFixed(1) + '%',
            },
            grid: { color: gridColor },
          },
        },
        interaction: { mode: 'index', intersect: false },
      },
      plugins: [zonesPlugin, zeroLinePlugin],
    })

    return () => chartRef.current?.destroy()
  }, [historicalFiat, base])

  // 2) Actualizador Suave: Solo inserta los datos en vivo sin recrear los gráficos
  useEffect(() => {
    if (!chartRef.current || !liveData?.fiat || !liveData?.usdt) return

    const cclLive = liveData.fiat.ccl?.price
    const basePrice = base === 'usdt' ? liveData.usdt.maxVenta : liveData.fiat[base]?.price

    if (cclLive && basePrice > 0) {
      const liveSpread = parseFloat((((cclLive / basePrice) - 1) * 100).toFixed(2))
      const now = new Date()
      const nowStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`

      const chart = chartRef.current
      const labels = chart.data.labels
      const data = chart.data.datasets[0].data

      if (labels.at(-1) === nowStr) {
        // Actualizar último punto de hoy
        data[data.length - 1] = liveSpread
      } else {
        // Agregar punto de hoy si cruzó la medianoche
        labels.push(nowStr)
        data.push(liveSpread)
      }

      // 'none' previene animaciones costosas completas en canvas que causan parpadeo
      chart.update('none')
    }
  }, [liveData, base])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Spread CCL vs {BASE_LABELS[base]} (YTD)
        </div>
        <div className="base-pills" id="base-currency-pills">
          {Object.entries(BASE_LABELS).map(([val, lbl]) => (
            <button
              key={val}
              className={`base-pill${base === val ? ' active' : ''}`}
              onClick={() => setBase(val)}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 220, position: 'relative' }}>
        <canvas ref={canvasRef} />
      </div>

      <div className="data-summary-row">
        <div>
          Periodos ganadores CCL:<br />
          <span id="ccl-wins" style={{ color: 'var(--green)', fontWeight: 700, fontSize: 20 }}>{summary.cclWins} Días</span>
        </div>
        <div>
          Periodos ganadores <span id="base-name-summary">{BASE_LABELS[base]}</span>:<br />
          <span id="base-wins" style={{ color: 'var(--red)', fontWeight: 700, fontSize: 20 }}>{summary.baseWins} Días</span>
        </div>
      </div>
    </div>
  )
}
