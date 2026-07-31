import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import TopNav    from './components/TopNav'
import TabResumen from './tabs/TabResumen'
import { useSnapshot  } from './hooks/useSnapshot'
import { useLiveData  } from './hooks/useLiveData'
import { useTasasData } from './hooks/useTasasData'
import { generateDatosBandas } from './utils/bandas'

// Code splitting: Lazy load secondary tabs to reduce initial bundle parse & RAM
const TabDolares = lazy(() => import('./tabs/TabDolares'))
const TabTasas   = lazy(() => import('./tabs/TabTasas'))

const TabFallback = () => (
  <div className="tab-pane active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
    Cargando sección...
  </div>
)

export default function App() {
  const [activeTab, setActiveTab] = useState('resumen')
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'dark')
  
  const { snapshot, loading: snapLoading } = useSnapshot()
  const { data: liveData } = useLiveData()
  const tasas = useTasasData()

  const [bandas, setBandas] = useState([])
  useEffect(() => {
    const ipc = snapshot?.argentina_macro?.ipc_history
    if (ipc) setBandas(generateDatosBandas(ipc))
  }, [snapshot])

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') || 'dark')
  }, [])

  const enrichedLiveData = useMemo(() => {
    return liveData
      ? {
          ...liveData,
          _bestYield:  tasas?.bestYield  ?? null,
          _bestPF:     tasas?.bestPF     ?? null,
          _bestCrypto: tasas?.bestCrypto ?? null,
        }
      : null
  }, [liveData, tasas])

  function handleThemeToggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme-preference', next)
    setTheme(next)
  }

  if (snapLoading && !snapshot) {
     return <div className="loading-screen">Cargando Snapshot...</div>
  }

  return (
    <div className="app">
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onThemeToggle={handleThemeToggle}
        theme={theme}
      />
      <div className="main-content">
        <Suspense fallback={<TabFallback />}>
          {activeTab === 'resumen' && (
            <div className="tab-pane active">
              <TabResumen
                snapshot={snapshot}
                liveData={enrichedLiveData}
                bandas={bandas}
                liveInflation={liveData?.liveInflation}
              />
            </div>
          )}
          {activeTab === 'dolares' && (
            <div className="tab-pane active">
              <TabDolares
                snapshot={snapshot}
                liveData={enrichedLiveData}
                bandas={bandas}
                historicalFiat={snapshot?.historical_fiat}
              />
            </div>
          )}
          {(activeTab === 'tasas' || activeTab === 'tasas-cripto') && (
            <div className="tab-pane active">
              <TabTasas tasas={tasas} displayMode={activeTab === 'tasas' ? 'pesos' : 'cripto'} />
            </div>
          )}
        </Suspense>
      </div>
    </div>
  )
}
