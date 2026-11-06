import { usePollingResource } from './usePollingResource.js'
import { FIWIND_REFRESH, loadFiwindHistory, loadFiwindLive } from '../utils/fiwind.js'

const historyUrl = import.meta.env.VITE_FIWIND_HISTORY_URL
  || 'https://raw.githubusercontent.com/feden97/market_dashboard-v2/fiwind-history/fiwind.json'
const loadHistory = ({ signal }) => loadFiwindHistory({ url: historyUrl, signal })

export function useFiwindData() {
  const live = usePollingResource(loadFiwindLive, { intervalMs: FIWIND_REFRESH })
  const history = usePollingResource(loadHistory, { intervalMs: FIWIND_REFRESH })
  return {
    live, history,
    refetch: () => Promise.allSettled([live.refetch(), history.refetch()]),
  }
}
