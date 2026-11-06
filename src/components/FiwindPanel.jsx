import { useMemo, useState } from 'react'
import FiwindChart from '../charts/FiwindChart'
import { fiwindView } from '../utils/fiwind.js'
import './fiwind.css'

const PERIODS = [[24, '24 h'], [168, '7 días'], [720, '30 días'], [2160, '90 días']]
const price = value => value == null ? '—' : value.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const percent = value => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const date = time => new Date(time * 1000).toLocaleString('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
})
export default function FiwindPanel({ state, theme }) {
  const [hours, setHours] = useState(24)
  const now = Date.now()
  const history = state.history.data
  const view = useMemo(() => fiwindView(history ?? [], state.live.data, hours, now), [history, state.live.data, hours, now])
  const latest = view.latest
  const isLive = view.fresh && !state.live.error && latest === state.live.data
  const refreshing = state.live.refreshing || state.history.refreshing

  return <section className="macro-card fiwind-panel" aria-labelledby="fiwind-title">
    <div className="fiwind-heading">
      <div>
        <h2 id="fiwind-title">Fiwind <span>USDT / USD</span></h2>
      </div>
      <div className="fiwind-status">
        <span className={`fiwind-status-label${isLive ? ' is-live' : ''}`}>
          {state.live.loading && !latest ? 'Consultando…' : isLive ? 'Cotización reciente' : latest ? 'Última cotización disponible' : 'Sin cotización disponible'}
        </span>
        <span>{latest ? `${date(latest.time)} · ART` : 'Fiwind vía CriptoYa'}</span>
        <button type="button" className="base-pill" disabled={refreshing} onClick={state.refetch}>{refreshing ? 'Actualizando…' : 'Actualizar canje'}</button>
      </div>
    </div>

    <div className="fiwind-quotes">
      <div className="fiwind-quote fiwind-bid">
        <span>Vendés USDT</span>
        <div className="fiwind-price">{price(latest?.bid)} <small>USD / USDT</small></div>
        <small>Recibís {price(latest ? latest.bid * 1000 : null)} USD por 1.000 USDT</small>
      </div>
      <div className="fiwind-quote fiwind-ask">
        <span>Comprás USDT</span>
        <div className="fiwind-price">{price(latest?.ask)} <small>USD / USDT</small></div>
        <small>Pagás {price(latest ? latest.ask * 1000 : null)} USD por 1.000 USDT</small>
      </div>

    </div>

    <p className="fiwind-spread">Diferencia compra / venta <strong>{price(latest ? latest.ask - latest.bid : null)} USD por USDT</strong></p>

    {state.live.error && <p className="fiwind-notice" role="status">No se pudo actualizar la cotización. {latest ? 'Se conserva el último dato con su fecha.' : 'Intentá actualizar nuevamente.'}</p>}

    <div className="fiwind-history-heading">
      <span>USD por USDT</span>
      <div className="base-pills" aria-label="Período del histórico Fiwind">
        {PERIODS.map(([value, label]) => <button type="button" className={`base-pill${hours === value ? ' active' : ''}`} key={value} aria-pressed={hours === value} onClick={() => setHours(value)}>{label}</button>)}
      </div>
    </div>

    <FiwindChart quotes={view.quotes} hours={hours} theme={theme} now={now} />

    <div className="fiwind-range">
      <span>Mín. venta <strong>{price(view.min)}</strong></span>
      <span>Máx. venta <strong>{price(view.max)}</strong></span>
      <span>Cada 15 min · ART</span>
    </div>
    {state.history.error && <p className="fiwind-notice" role="status">No se pudo actualizar el histórico.{history?.length ? ' Se conservan las muestras cargadas.' : ' Todavía no hay muestras disponibles.'}</p>}
    <details className="fiwind-details">
      <summary>Detalle y fuente</summary>
      <p>{view.quotes.length.toLocaleString('es-AR')} muestras en el período · Venta frente a paridad: {percent(view.premium)}</p>
    <div className="fiwind-footer">
      {state.history.loading ? <p role="status">Cargando histórico…</p>
        : state.history.error ? <p className="fiwind-notice" role="status">No se pudo consultar el histórico guardado.{history?.length ? ' Se conservan las muestras cargadas.' : ' Estará disponible después de la primera recolección automática.'}</p>
          : <p>{history?.length ? `Registro desde ${date(history[0].time)} · ART. Última muestra: ${date(history.at(-1).time)} · ART.` : 'El histórico empieza con la primera muestra; no se reconstruyen cotizaciones pasadas.'}</p>}
      <p>Fuente: <a href="https://docs.criptoya.com/argentina/" target="_blank" rel="noreferrer">Fiwind vía CriptoYa</a>, precios bid/ask como en el bot. La cotización se consulta cada minuto con el dashboard visible. El guardado automático puede tener demoras; los huecos no se interpolan.</p>
    </div>
    </details>
  </section>
}
