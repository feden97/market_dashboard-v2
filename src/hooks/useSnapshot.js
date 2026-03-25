import { useState, useEffect } from 'react'

/**
 * Loads snapshot.json, events.json, and meta.json from /data/
 * Returns { snapshot, events, meta, loading, error }
 */
export function useSnapshot() {
  const [state, setState] = useState({ snapshot: null, loading: true, error: null })

  useEffect(() => {
    fetch('data/snapshot.json')
      .then(r => r.ok ? r.json() : null)
      .then(snapshot => {
        setState({ snapshot, loading: false, error: null })
      })
      .catch(err => {
        setState({ snapshot: null, loading: false, error: err.message })
      })
  }, [])

  return state
}
