import { usePollingResource } from './usePollingResource.js'
import { fetchJson, isRecord } from '../utils/http.js'

async function load({ signal }) {
  const data = await fetchJson(`${import.meta.env.BASE_URL}data/snapshot.json`, {
    signal,
    validate: value => isRecord(value) && isRecord(value.argentina_macro),
  })
  return { data }
}

/** Load the bundled snapshot; expose failures and a retry without fabricating an empty success. */
export function useSnapshot() {
  const { data: snapshot, ...state } = usePollingResource(load)
  return { snapshot, ...state }
}
