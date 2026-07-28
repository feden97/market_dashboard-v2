import React from 'react'

export default function TopNav({ activeTab, onTabChange, onThemeToggle, theme }) {
  const isTasasActive = activeTab === 'tasas' || activeTab === 'tasas-cripto'

  return (
    <nav className="top-nav">
      <div className="nav-container">
        <div className="nav-tabs-group">
          <button
            id="tab-resumen-btn"
            className={`nav-tab ${activeTab === 'resumen' ? 'active' : ''}`}
            onClick={() => onTabChange('resumen')}
          >
            🏠 Resumen
          </button>
          <button
            id="tab-argentina-btn"
            className={`nav-tab ${activeTab === 'dolares' ? 'active' : ''}`}
            onClick={() => onTabChange('dolares')}
          >
            🇦🇷 Dólares y Bandas
          </button>
          <button
            id="tab-tasas-btn"
            className={`nav-tab ${isTasasActive ? 'active' : ''}`}
            onClick={() => onTabChange('tasas')}
          >
            💰 Tasas
          </button>
        </div>
        <div className="nav-actions-right">
          <button id="theme-toggle" className="theme-toggle-btn" onClick={onThemeToggle} title="Cambiar Tema">
            <svg id="sun-icon" className="theme-icon" style={{ display: theme === 'dark' ? 'block' : 'none' }} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg id="moon-icon" className="theme-icon" style={{ display: theme === 'light' ? 'block' : 'none' }} viewBox="0 0 24 24">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
        </div>
      </div>

      <div id="sub-tabs-tasas" className="sub-tabs-container" style={{ display: isTasasActive ? 'flex' : 'none' }}>
        <button
          id="tasas-pesos-btn"
          className={`sub-tab ${activeTab === 'tasas' ? 'active' : ''}`}
          onClick={() => onTabChange('tasas')}
        >
          🇦🇷 Pesos (ARS)
        </button>
        <button
          id="tasas-cripto-btn"
          className={`sub-tab ${activeTab === 'tasas-cripto' ? 'active' : ''}`}
          onClick={() => onTabChange('tasas-cripto')}
        >
          🪙 Stablecoins
        </button>
      </div>
    </nav>
  )
}
