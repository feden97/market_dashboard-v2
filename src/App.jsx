import { lazy, Suspense, useState, useEffect, useMemo } from 'react'
import TopNav from './components/TopNav'
import DataStatus from './components/DataStatus'
import { useSnapshot } from './hooks/useSnapshot'
import { useLiveData } from './hooks/useLiveData'
import { useTasasData } from './hooks/useTasasData'
import { generateDatosBandas } from './utils/bandas'
import { mergeIpcHistory } from './utils/format'
import { buildDashboardData, getTabFromSearch } from './utils/dashboard'

const TabResumen = lazy(() => import('./tabs/TabResumen'))
const TabDolares = lazy(() => import('./tabs/TabDolares'))
const TabTasas = lazy(() => import('./tabs/TabTasas'))

export default function App() {
  const [activeTab, setActiveTab] = useState(() => getTabFromSearch(window.location.search))
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark')
  const [refreshing, setRefreshing] = useState(false)
  const snapshotState = useSnapshot()
  const liveState = useLiveData()
  const tasas = useTasasData()
  const { snapshot } = snapshotState
  const liveData = liveState.data

  const ipcHistory = useMemo(() => mergeIpcHistory(snapshot?.argentina_macro?.ipc_history, liveData?.liveInflation), [snapshot, liveData?.liveInflation])
  const bandas = useMemo(() => generateDatosBandas(ipcHistory), [ipcHistory])
  const dashboardData = useMemo(() => buildDashboardData(snapshot, liveData, tasas), [snapshot, liveData, tasas])

  useEffect(() => {
    const handleBack = () => setActiveTab(getTabFromSearch(window.location.search))
    window.addEventListener('popstate', handleBack)
    return () => window.removeEventListener('popstate', handleBack)
  }, [])

  function handleTabChange(tab) {
    if (tab === activeTab) return
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.pushState(null, '', url)
    setActiveTab(tab)
  }

  function handleThemeToggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    document.documentElement.style.colorScheme = next
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0A0F1C' : '#f8fafc')
    try { localStorage.setItem('theme-preference', next) } catch { /* The theme still works without storage. */ }
    setTheme(next)
  }

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await Promise.allSettled([snapshotState.refetch(), liveState.refetch(), tasas.refetch()])
    } finally {
      setRefreshing(false)
    }
  }

  const labelId = activeTab.startsWith('tasas') ? 'tab-tasas-btn' : activeTab === 'dolares' ? 'tab-argentina-btn' : 'tab-resumen-btn'

  return (
    <div className="app">
      <a className="skip-link" href="#dashboard-panel">Ir al contenido</a>
      <TopNav activeTab={activeTab} onTabChange={handleTabChange} onThemeToggle={handleThemeToggle} theme={theme} />
      <main className="main-content">
        <DataStatus snapshotState={snapshotState} liveState={liveState} tasas={tasas} data={dashboardData} onRefresh={handleRefresh} refreshing={refreshing} />
        <section id="dashboard-panel" className="tab-pane active" role="tabpanel" aria-labelledby={labelId} tabIndex={0} key={activeTab}>
          <Suspense fallback={<div className="loading-placeholder" role="status">Cargando sección…</div>}>
            {activeTab === 'resumen' && <TabResumen snapshot={snapshot} liveData={dashboardData} liveInflation={liveData?.liveInflation} theme={theme} />}
            {activeTab === 'dolares' && <TabDolares snapshot={snapshot} liveData={dashboardData} bandas={bandas} historicalFiat={snapshot?.historical_fiat} theme={theme} />}
            {activeTab.startsWith('tasas') && <TabTasas tasas={tasas} displayMode={activeTab === 'tasas' ? 'pesos' : 'cripto'} />}
          </Suspense>
        </section>
      </main>
    </div>
  )
}
