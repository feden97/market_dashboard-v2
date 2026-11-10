import { useMemo, useState } from 'react'
import FiwindChart from '../charts/FiwindChart'
import { buildFiwindSeries } from '../utils/fiwind.js'
import './fiwind.css'

const PERIODS = [[24, '24 h'], [168, '7 días'], [720, '30 días'], [2160, '90 días']]
const price = value => value == null ? '—' : value.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const money = value => value == null ? '—' : value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const percent = value => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const date = (time, short = false) => time == null ? '—' : new Date(time * 1000).toLocaleString('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', ...(short ? {} : { day: '2-digit', month: '2-digit' }),
  hour: '2-digit', minute: '2-digit', hour12: false,
})

export default function FiwindPanel({ state, theme }) {
  const [hours, setHours] = useState(24)
  const [side, setSide] = useState('bid')
  const now = Date.now()
  const history = state.history.data ?? []
  const series = useMemo(() => buildFiwindSeries(history, state.live.data, hours, now, side), [history, state.live.data, hours, now, side])
  const { latest } = series
  const recent = series.fresh && !state.live.error && latest === state.live.data
  const refreshing = state.live.refreshing || state.history.refreshing
  const delayed = series.lastSavedTime != null && now - series.lastSavedTime * 1000 > 2 * 3_600_000
  const selling = side === 'bid'

  return <section className="fiwind-panel" aria-labelledby="fiwind-title" data-side={side}>
    <header className="fw-header">
      <div className="fw-brand">
        <span className="fw-mark" aria-hidden="true">⇄</span>
        <div><p className="fw-eyebrow">FIWIND</p><h2 id="fiwind-title">Canje USDT / USD</h2></div>
      </div>
      <div className="fw-update">
        <div><span className={`fw-status${recent ? ' is-recent' : ''}`}>{state.live.loading && !latest ? 'Consultando' : recent ? 'Precio actualizado' : 'Último precio disponible'}</span>
          <time dateTime={latest ? new Date(latest.time * 1000).toISOString() : undefined}>{latest ? `${date(latest.time)} · hora argentina` : 'Esperando cotización'}</time></div>
        <button className="fw-refresh" type="button" onClick={state.refetch} disabled={refreshing} aria-label="Actualizar canje Fiwind" title="Actualizar cotización e histórico"><span aria-hidden="true">↻</span></button>
      </div>
    </header>

    <div className="fw-quotes" aria-label="Cotización actual y sentido del histórico">
      {[['bid', 'Vendés USDT', 'Recibís', latest?.bid], ['ask', 'Comprás USDT', 'Pagás', latest?.ask]].map(([key, label, verb, value]) =>
        <button key={key} type="button" className={`fw-quote fw-${key}`} aria-pressed={side === key} onClick={() => setSide(key)}>
          <span className="fw-quote-label"><i aria-hidden="true" />{label}<span className="fw-selected">{side === key ? 'En el gráfico' : 'Ver histórico'} <span aria-hidden="true">↗</span></span></span>
          <span className="fw-quote-number">{price(value)} <small>USD <span>/ 1 USDT</span></small></span>
          <span className="fw-conversion">{verb} <strong>{money(value == null ? null : value * 1000)} USD</strong> por 1.000 USDT</span>
        </button>)}
    </div>
    <div className="fw-spread"><span>Diferencia compra / venta</span><strong>{price(latest ? latest.ask - latest.bid : null)} <small>USD por USDT</small></strong><span className="fw-spread-note">Cotización informativa de Fiwind vía CriptoYa</span></div>
    {state.live.error && <p className="fw-notice" role="status">La cotización no pudo actualizarse. Se muestra el último dato con su fecha.</p>}

    <div className="fw-history">
      <div className="fw-chart-header">
        <div><h3>Evolución de {selling ? 'venta' : 'compra'}</h3><p>USD que {selling ? 'recibís' : 'pagás'} por cada USDT</p></div>
        <div className="fw-periods" aria-label="Período del histórico Fiwind">{PERIODS.map(([value, label]) => <button type="button" key={value} aria-pressed={hours === value} onClick={() => setHours(value)}>{label}</button>)}</div>
      </div>
      <dl className="fw-metrics">
        <div><dt>Mínimo del período</dt><dd>{price(series.observedMin)}</dd></div>
        <div><dt>Máximo del período</dt><dd>{price(series.observedMax)}</dd></div>
        <div><dt>Cambio entre registros</dt><dd>{series.observedCount > 1 ? percent(series.changePercent) : '—'}{series.observedCount > 1 && series.isFlat && <small>Sin variaciones registradas</small>}</dd></div>
      </dl>
      <FiwindChart quotes={series.chartQuotes} side={side} hours={hours} theme={theme} now={now} />
      <div className="fw-chart-caption"><span><i className="fw-dot" />{series.savedCount} {series.savedCount === 1 ? 'registro guardado' : 'registros guardados'} en el período</span>{series.hasLivePoint && <span><i className="fw-dot fw-live-dot" />Último precio · {date(latest.time, true)}</span>}<span>Hora argentina · USD / USDT</span></div>
      {series.gapCount > 0 && <p className="fw-gap-note">Registros espaciados. Los puntos muestran las cotizaciones disponibles; los intervalos sin datos quedan sin unir.</p>}
      {!series.savedCount && !state.history.loading && !state.history.error && <p className="fw-gap-note">Todavía no hay registros guardados en este período.{series.hasLivePoint ? ' El punto destacado es el precio actual.' : ''}</p>}
    </div>
    {(delayed || state.history.error) && <p className="fw-notice" role="status">{state.history.error ? 'No se pudo actualizar el histórico. Se conservan los datos disponibles.' : `Guardado demorado. Último registro: ${date(series.lastSavedTime)} (hora argentina).`}</p>}
    <details className="fw-details">
      <summary>Acerca de estos datos <span aria-hidden="true">+</span></summary>
      <div className="fw-details-body">
        <dl><div><dt>Último registro guardado</dt><dd>{date(series.lastSavedTime)} · ART</dd></div><div><dt>Consulta de precio</dt><dd>Cada 5 minutos con el dashboard visible</dd></div><div><dt>Guardado automático</dt><dd>Programado cada hora; puede demorarse</dd></div><div><dt>Histórico disponible desde</dt><dd>{date(history[0]?.time)} · ART</dd></div></dl>
        <p>Fuente: <a href="https://docs.criptoya.com/argentina/" target="_blank" rel="noreferrer">Fiwind vía CriptoYa</a>. Venta = bid; compra = ask. Los valores se muestran con tres decimales. Mínimo, máximo y cambio consideran las observaciones disponibles, incluido el último precio cuando es reciente. No se reconstruyen precios en los intervalos sin datos.</p>
      </div>
    </details>
  </section>
}
