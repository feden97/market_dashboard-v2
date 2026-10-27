import { useEffect, useState } from 'react'

function formatTimestamp(value) {
  const date = new Date(value)
  return value && Number.isFinite(date.getTime())
    ? date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
    : null
}

export default function DataStatus({ snapshotState, liveState, tasas, data, onRefresh, refreshing }) {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const errors = [snapshotState.error && 'histórico', liveState.error && 'cotizaciones', tasas.error && 'tasas'].filter(Boolean)
  const isLoading = snapshotState.loading || liveState.loading || tasas.loading
  const lastUpdated = formatTimestamp(data.lastUpdated)
  const snapshotDate = formatTimestamp(snapshotState.snapshot?.built_at)
  const degraded = !online || errors.length > 0 || data.hasHistoricalQuotes

  return (
    <div className={`data-status${degraded ? ' data-status-warning' : ''}`}>
      <div role="status" aria-live="polite" aria-atomic="true">
        <span className="data-status-heading">
          <span className={`status-dot${degraded ? ' status-dot-warning' : ''}`} aria-hidden="true" />
          {!online ? 'Sin conexión' : isLoading ? 'Consultando fuentes…' : errors.length ? 'Datos parcialmente disponibles' : data.hasHistoricalQuotes ? 'Cotizaciones históricas disponibles' : 'Datos disponibles'}
        </span>
        <span className="data-status-detail">
          {lastUpdated ? `Última consulta: ${lastUpdated} (ART). ` : ''}
          {data.hasHistoricalQuotes ? `Cotizaciones de respaldo del ${data.historicalDate}. ` : ''}
          {snapshotDate ? `Histórico: ${snapshotDate} (ART). ` : ''}
          {errors.length > 0 ? `No se pudo actualizar: ${errors.join(', ')}. Se conservan los datos disponibles.` : ''}
        </span>
      </div>
      <button type="button" className="refresh-button" onClick={onRefresh} disabled={refreshing || isLoading} aria-busy={refreshing}>
        {refreshing ? 'Actualizando…' : 'Actualizar datos'}
      </button>
    </div>
  )
}
