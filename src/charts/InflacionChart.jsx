import React, { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import { getLast12IPC, calcIpcStats } from '../utils/format'

Chart.register(...registerables)

export default function InflacionChart({ ipcHistory, liveInflation }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  useEffect(() => {
    if (!ipcHistory) return

    // Merge live inflation data
    const merged = { ...ipcHistory }
    if (liveInflation?.length) {
      liveInflation.forEach(item => {
        merged[item.fecha.substring(0, 7)] = item.valor / 100
      })
    }

    const last12 = getLast12IPC(merged)
    if (!last12.length) return

    const { lastMonth, avg12m, acum12m } = calcIpcStats(last12)
    const labels     = last12.map(d => d.label)
    const years      = last12.map(d => d.year)
    const dataPoints = last12.map(d => d.pct)

    const isLight = document.documentElement.getAttribute('data-theme') === 'light'
    const textColor = isLight ? '#64748b' : '#94a3b8'
    const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'

    const bgColors = dataPoints.map((v, i) => {
      if (i === dataPoints.length - 1) return isLight ? '#475569' : '#64748b'
      return isLight ? '#94a3b8' : '#475569'
    })

    chartRef.current?.destroy()

    const yearGroupPlugin = {
      id: 'yearGroup',
      afterDraw(chart) {
        const ctx   = chart.ctx
        const xAxis = chart.scales.x
        const groups = []
        let cur = years[0], start = 0
        for (let i = 1; i <= years.length; i++) {
          if (i === years.length || years[i] !== cur) {
            groups.push({ year: cur, startIdx: start, endIdx: i - 1 })
            if (i < years.length) { cur = years[i]; start = i }
          }
        }
        const tickW = xAxis.getPixelForTick(1) - xAxis.getPixelForTick(0)
        const yPos  = xAxis.bottom + 10
        ctx.save()
        ctx.strokeStyle = isLight ? '#94a3b8' : '#6b7280'
        ctx.lineWidth   = 1
        ctx.font        = `600 11px Inter, sans-serif`
        ctx.textAlign   = 'center'
        ctx.textBaseline = 'middle'
        for (const g of groups) {
          const sx = xAxis.getPixelForTick(g.startIdx) - tickW / 2
          const ex = xAxis.getPixelForTick(g.endIdx)   + tickW / 2
          const cx = (sx + ex) / 2
          const tw = ctx.measureText(g.year).width + 10
          ctx.beginPath(); ctx.moveTo(sx + 4, yPos); ctx.lineTo(cx - tw / 2, yPos); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(cx + tw / 2, yPos); ctx.lineTo(ex - 4, yPos); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(sx + 4, yPos - 3); ctx.lineTo(sx + 4, yPos); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(ex - 4, yPos - 3); ctx.lineTo(ex - 4, yPos); ctx.stroke()
          ctx.fillStyle = isLight ? '#94a3b8' : '#6b7280'
          ctx.beginPath()
          ctx.roundRect(cx - tw / 2 + 1, yPos - 8, tw - 2, 16, 8)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.fillText(g.year, cx, yPos + 1)
        }
        ctx.restore()
      },
    }

    const dataLabelsPlugin = {
      id: 'dataLabels',
      afterDatasetsDraw(chart) {
        const ctx       = chart.ctx
        const isMobile  = window.innerWidth < 500
        chart.data.datasets.forEach((ds, i) => {
          chart.getDatasetMeta(i).data.forEach((el, idx) => {
            ctx.fillStyle    = textColor
            ctx.font         = `600 ${isMobile ? '9px' : '10px'} Inter, sans-serif`
            ctx.textAlign    = 'center'
            ctx.textBaseline = 'bottom'
            ctx.fillText(ds.data[idx].toFixed(1).replace('.', ',') + '%', el.x, el.y - 3)
          })
        })
      },
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: dataPoints,
          backgroundColor: bgColors,
          borderRadius: 4,
          barPercentage: 0.75,
        }],
      },
      plugins: [dataLabelsPlugin, yearGroupPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 22, bottom: 28 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            titleColor: '#94a3b8', bodyColor: '#fff',
            borderColor: '#334155', borderWidth: 1,
            displayColors: false,
            callbacks: { label: ctx => ctx.parsed.y.toFixed(1).replace('.', ',') + '%' },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { size: 10, weight: '600' }, padding: 4 },
          },
          y: {
            display: true,
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              padding: 5,
              font: { size: 11 },
              callback: v => v + '%',
            },
            max: Math.ceil(Math.max(...dataPoints)) + 1,
          },
        },
      },
    })

    return () => chartRef.current?.destroy()
  }, [ipcHistory, liveInflation])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
