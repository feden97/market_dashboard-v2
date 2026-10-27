import { usePollingResource } from './usePollingResource.js'
import { loadLiveData, mergeLiveData } from '../utils/liveData.js'

async function load({ signal, previous }) {
  const { raw, failedSources } = await loadLiveData({
    proxyUrl: import.meta.env.VITE_PROXY_URL,
    signal,
  })
  const data = mergeLiveData(previous, raw)
  return {
    data,
    failedSources,
    error: failedSources.length
      ? `No se pudieron actualizar: ${failedSources.join(', ')}.`
      : data ? null : 'No hay cotizaciones disponibles en este momento.',
  }
}

/** Refresh every minute while visible, retaining the last valid quote on provider failures. */
export function useLiveData() {
  return usePollingResource(load, { intervalMs: 60_000 })
}
