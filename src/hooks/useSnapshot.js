import { useState, useEffect } from 'react'

/**
 * Loads snapshot.json from public/data/
 * Returns { snapshot, loading, error }
 */
export function useSnapshot() {
  const [state, setState] = useState({ snapshot: null, loading: true, error: null })

  useEffect(() => {
    fetch('./data/snapshot.json')
      .then(r => (r.ok ? r.json() : null))
      .then(snapshot => {
        setState({ snapshot: snapshot || {}, loading: false, error: null })
      })
      .catch(err => {
        console.warn('Snapshot fetch warning:', err)
        setState({ snapshot: {}, loading: false, error: err.message })
      })
  }, [])

  return state
}
