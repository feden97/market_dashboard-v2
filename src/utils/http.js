/** Fetch JSON with a bounded lifetime, including response-body parsing. */
export async function fetchJson(url, { signal, timeoutMs = 12_000, validate } = {}) {
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })

  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`El servidor respondió HTTP ${response.status}.`)
    const data = await response.json()
    if (validate && !validate(data)) throw new Error('La respuesta tiene un formato inesperado.')
    return data
  } catch (error) {
    if (timedOut && !signal?.aborted) throw new Error('La solicitud tardó demasiado. Intentá nuevamente.')
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/** Reject coercions such as null → 0, booleans → 1 and non-finite numbers. */
export function finiteNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
