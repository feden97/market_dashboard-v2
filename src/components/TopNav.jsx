import React from 'react'

const NAV_ITEMS = [
  { id: 'resumen',      label: 'Resumen' },
  { id: 'dolares',      label: 'Dólares' },
  { id: 'tasas',        label: 'Tasas' },
]

export default function TopNav({ activeTab, onTabChange, onThemeToggle, theme }) {
  const isActive = (item) => {
    if (item.id === 'tasas') return activeTab === 'tasas' || activeTab === 'tasas-cripto'
    return activeTab === item.id
  }

  return (
    <nav className="top-nav">
      <div className="nav-container">
        {/* ── Main tabs ── */}
        <div className="nav-tabs-group" style={{ display: 'flex', gap: '4px' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-tab ${isActive(item) ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* ── Right: theme toggle only ── */}
        <div style={{ marginLeft: 'auto' }}>
          <button className="theme-toggle-btn" onClick={onThemeToggle} title="Cambiar Tema">
            {theme === 'dark' ? (
              <svg className="theme-icon" style={{ display: 'block' }} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg className="theme-icon" style={{ display: 'block' }} viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Tasas sub-tabs ── */}
      {(activeTab === 'tasas' || activeTab === 'tasas-cripto') && (
        <div className="sub-tabs-container" style={{ display: 'flex' }}>
          <button
            className={`sub-tab ${activeTab === 'tasas' ? 'active' : ''}`}
            onClick={() => onTabChange('tasas')}
          >
            🇦🇷 Pesos (ARS)
          </button>
          <button
            className={`sub-tab ${activeTab === 'tasas-cripto' ? 'active' : ''}`}
            onClick={() => onTabChange('tasas-cripto')}
          >
            🪙 Stablecoins
          </button>
        </div>
      )}
    </nav>
  )
}
