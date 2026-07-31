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
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '24px', backgroundColor: '#0A0F1C', color: '#E2E8F0', textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>
            ⚠️ Ocurrió un error inesperado
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '14px', maxWidth: '400px', marginBottom: '20px', lineHeight: 1.5 }}>
            El dashboard detectó un problema de conexión o actualización. Toca el botón para recargar.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 20px', fontSize: '14px', fontWeight: 600, borderRadius: '8px',
              backgroundColor: '#00FF6A', color: '#0A0F1C', border: 'none', cursor: 'pointer'
            }}
          >
            🔄 Recargar Dashboard
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
