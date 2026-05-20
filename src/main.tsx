import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'
import App from './App'
import { AboutWindow } from './AboutWindow'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    const { error } = this.state
    if (error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', color: '#f87171', background: '#0f0f0f', height: '100vh', overflow: 'auto' }}>
          <p style={{ color: '#f87171', marginBottom: 8, fontSize: 13, fontWeight: 'bold' }}>CloudOrbit crashed — open DevTools (right-click → Inspect) for full trace</p>
          <pre style={{ fontSize: 11, color: '#fca5a5', whiteSpace: 'pre-wrap' }}>{error.message}</pre>
          <pre style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'pre-wrap', marginTop: 8 }}>{error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

function route(): React.ReactNode {
  try {
    const w = new URL(window.location.href).searchParams.get('window')
    if (w === 'about') return <AboutWindow />
  } catch { /* fall through */ }
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>{route()}</ErrorBoundary>
  </React.StrictMode>
)
