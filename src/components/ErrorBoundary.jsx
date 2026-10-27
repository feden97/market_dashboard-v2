import React from 'react'
import { resetAppCache } from '../utils/pwa'

export default class ErrorBoundary extends React.Component {
  state = { error: null, resetting: false }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React error:', error, errorInfo)
  }

  handleReset = async () => {
    this.setState({ resetting: true })
    try {
      await resetAppCache()
    } catch (error) {
      console.warn('Could not clear the app cache:', error)
    } finally {
      window.location.reload()
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main role="alert" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '24px', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)',
        textAlign: 'center', fontFamily: 'system-ui, sans-serif',
      }}>
        <h1 style={{ fontSize: '20px', marginBottom: '12px' }}>No pudimos mostrar el dashboard</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '420px', marginBottom: '20px', lineHeight: 1.5 }}>
          Volvé a cargar la aplicación para intentarlo de nuevo. Tus preferencias se conservarán.
        </p>
        {import.meta.env.DEV && <pre style={{ maxWidth: '90%', overflowX: 'auto' }}>{String(this.state.error)}</pre>}
        <button type="button" onClick={this.handleReset} disabled={this.state.resetting} style={{
          padding: '12px 24px', fontSize: '14px', fontWeight: 600, borderRadius: '8px',
          backgroundColor: 'var(--accent)', color: 'var(--bg-body)', border: 'none', cursor: 'pointer',
        }}>
          {this.state.resetting ? 'Recargando…' : 'Volver a cargar'}
        </button>
      </main>
    )
  }
}
