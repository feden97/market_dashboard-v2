import React, { useState, useEffect, useMemo } from 'react'
import TopNav    from './components/TopNav'
import TabResumen from './tabs/TabResumen'
import TabDolares from './tabs/TabDolares'
import TabTasas   from './tabs/TabTasas'
import { useSnapshot  } from './hooks/useSnapshot'
import { useLiveData  } from './hooks/useLiveData'
import { useTasasData } from './hooks/useTasasData'
import { generateDatosBandas } from './utils/bandas'

export default function App() {
  // Support tab selection via query parameter (e.g. ?tab=dolares from PWA shortcuts)
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab && ['resumen', 'dolares', 'tasas', 'tasas-cripto'].includes(tab)) {
        return tab
      }
    }
    return 'resumen'
  }

  const [activeTab, setActiveTab] = useState(getInitialTab)
  const [theme, setTheme] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') || 'dark'
    }
    return 'dark'
  })

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
     return <div className="loading-screen">Cargando Dashboard...</div>
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
      </div>
    </div>
  )
}
