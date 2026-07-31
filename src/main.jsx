import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './react-layout.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error:', error, errorInfo)
  }

  handleReset = () => {
    // Unregister any old broken service worker if user clicks reset
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister()
        }
      }).catch(() => {})
    }
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '24px', backgroundColor: '#0A0F1C', color: '#E2E8F0', textAlign: 'center',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#FF4444' }}>
            ⚠️ Ocurrió un error en la app
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '13px', maxWidth: '420px', marginBottom: '16px', lineHeight: 1.5 }}>
            Se detectó una discrepancia de caché o red en tu dispositivo.
          </p>
          {this.state.error && (
            <pre style={{
              backgroundColor: 'rgba(255, 68, 68, 0.1)', color: '#FFB800', padding: '12px', borderRadius: '6px',
              fontSize: '11px', textAlign: 'left', maxWidth: '90%', overflowX: 'auto', marginBottom: '20px',
              border: '1px solid rgba(255, 68, 68, 0.2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            style={{
              padding: '12px 24px', fontSize: '14px', fontWeight: 600, borderRadius: '8px',
              backgroundColor: '#00FF6A', color: '#0A0F1C', border: 'none', cursor: 'pointer'
            }}
          >
            🔄 Limpiar Caché y Reintentar
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
