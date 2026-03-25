import React, { useState, useEffect } from 'react'
import TopNav    from './components/TopNav'
import TabResumen    from './tabs/TabResumen'
import TabDolares    from './tabs/TabDolares'
import TabTasas      from './tabs/TabTasas'
import { useSnapshot  } from './hooks/useSnapshot'
import { useLiveData  } from './hooks/useLiveData'
import { useTasasData } from './hooks/useTasasData'
import { generateDatosBandas } from './utils/bandas'

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

  const enrichedLiveData = liveData
    ? {
        ...liveData,
        _bestYield:  tasas?.bestYield  ?? null,
        _bestPF:     tasas?.bestPF     ?? null,
        _bestCrypto: tasas?.bestCrypto ?? null,
      }
    : null

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
        <div className={`tab-pane ${activeTab === 'resumen' ? 'active' : ''}`} style={{ display: activeTab === 'resumen' ? 'block' : 'none' }}>
          <TabResumen
            snapshot={snapshot}
            liveData={enrichedLiveData}
            bandas={bandas}
            liveInflation={liveData?.liveInflation}
          />
        </div>
        <div className={`tab-pane ${activeTab === 'dolares' ? 'active' : ''}`} style={{ display: activeTab === 'dolares' ? 'block' : 'none' }}>
          <TabDolares
            snapshot={snapshot}
            liveData={enrichedLiveData}
            bandas={bandas}
            historicalFiat={snapshot?.historical_fiat}
          />
        </div>
        <div className={`tab-pane ${(activeTab === 'tasas' || activeTab === 'tasas-cripto') ? 'active' : ''}`} style={{ display: (activeTab === 'tasas' || activeTab === 'tasas-cripto') ? 'block' : 'none' }}>
          <TabTasas tasas={tasas} displayMode={activeTab === 'tasas' ? 'pesos' : 'cripto'} />
        </div>
      </div>
    </div>
  )
}
