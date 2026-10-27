/** Own the lifetime of a resource request independently of React rendering. */
export function createResourcePoller({
  load, onStart, onResult, onError, intervalMs,
  visibility = globalThis.document, timers = globalThis,
}) {
  let stopped = false
  let timer
  let controller
  let inFlight

  function refresh() {
    timers.clearTimeout(timer)
    if (stopped) return Promise.resolve()
    if (inFlight) return inFlight
    controller = new AbortController()
    const signal = controller.signal
    onStart?.()
    // Defer invocation so even a synchronously throwing loader releases inFlight correctly.
    inFlight = Promise.resolve().then(async () => {
      try {
        if (signal.aborted) return
        const result = await load({ signal })
        if (!stopped && !signal.aborted) onResult(result)
      } catch (error) {
        if (!stopped && !signal.aborted) onError(error)
      } finally {
        inFlight = null
        if (!stopped && intervalMs > 0 && visibility?.visibilityState !== 'hidden') {
          timer = timers.setTimeout(refresh, intervalMs)
        }
      }
    })
    return inFlight
  }

  function onVisibilityChange() {
    if (visibility.visibilityState === 'visible') refresh()
    else timers.clearTimeout(timer)
  }

  if (intervalMs) visibility?.addEventListener('visibilitychange', onVisibilityChange)

  function stop() {
    stopped = true
    timers.clearTimeout(timer)
    controller?.abort()
    visibility?.removeEventListener('visibilitychange', onVisibilityChange)
  }

  return { refresh, stop }
}
