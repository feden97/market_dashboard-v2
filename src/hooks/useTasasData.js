import { usePollingResource } from './usePollingResource.js'
import { fetchJson } from '../utils/http.js'
import { normalizeTasas } from '../utils/tasasData.js'

const API = 'https://api.argentinadatos.com/v1/finanzas'
const INITIAL_DATA = normalizeTasas()
const SOURCES = [
  ['pfData', 'plazos fijos', '/tasas/plazoFijo'],
  ['remuData', 'cuentas remuneradas', '/fci/otros/ultimo'],
  ['rendData', 'rendimientos cripto', '/rendimientos'],
  ['fciUlt', 'fondos actuales', '/fci/mercadoDinero/ultimo'],
  ['fciPen', 'fondos anteriores', '/fci/mercadoDinero/penultimo'],
]

async function load({ signal, previous }) {
  const outcomes = await Promise.allSettled(SOURCES.map(([, , path]) =>
    fetchJson(`${API}${path}`, { signal, validate: Array.isArray }),
  ))
  if (signal.aborted) throw signal.reason
  const raw = {}
  const failedSources = []
  outcomes.forEach((result, index) => {
    const [key, label] = SOURCES[index]
    if (result.status === 'fulfilled') raw[key] = result.value
    else failedSources.push(label)
  })
  const data = normalizeTasas(raw)
  if (previous) {
    if (!raw.pfData) { data.plazosFijos = previous.plazosFijos; data.bestPF = previous.bestPF }
    if (!raw.remuData) { data.cuentasRemuneradas = previous.cuentasRemuneradas; data.bestYield = previous.bestYield }
    if (!raw.rendData) { data.yields = previous.yields; data.bestCrypto = previous.bestCrypto }
    if (!raw.fciUlt || !raw.fciPen) data.fci = previous.fci
  }
  return {
    data,
    failedSources,
    error: failedSources.length ? `No se pudieron actualizar: ${failedSources.join(', ')}.` : null,
  }
}

export function useTasasData() {
  const { data, ...state } = usePollingResource(load, { initialValue: INITIAL_DATA, intervalMs: 300_000 })
  return { ...data, ...state }
}
