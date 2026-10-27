import { useCallback, useEffect, useRef, useState } from 'react'
import { createResourcePoller } from '../utils/polling.js'

/** One in-flight request per resource; timers are owned by the effect, even after errors. */
export function usePollingResource(load, { initialValue = null, intervalMs = null } = {}) {
  const valueRef = useRef(initialValue)
  const refreshRef = useRef(null)
  const [state, setState] = useState({
    data: initialValue, loading: true, refreshing: false, error: null, failedSources: [],
  })
  const refetch = useCallback(() => refreshRef.current?.() ?? Promise.resolve(), [])

  useEffect(() => {
    const poller = createResourcePoller({
      load: ({ signal }) => load({ signal, previous: valueRef.current }),
      intervalMs,
      onStart: () => setState(previous => ({ ...previous, refreshing: true })),
      onResult: result => {
        valueRef.current = result.data
        setState({
          data: result.data, loading: false, refreshing: false,
          error: result.error ?? null, failedSources: result.failedSources ?? [],
        })
      },
      onError: error => setState(previous => ({
        ...previous, loading: false, refreshing: false, error: error.message,
      })),
    })
    refreshRef.current = poller.refresh
    poller.refresh()

    return () => {
      poller.stop()
      refreshRef.current = null
    }
  }, [load, intervalMs])

  return { ...state, refetch }
}
