import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'
import App from './App'
import { AboutWindow } from './AboutWindow'

// ?window=about opens a dedicated small About window from the native menu.
// Anything else falls through to the main App shell.
function route(): React.ReactNode {
  try {
    const w = new URL(window.location.href).searchParams.get('window')
    if (w === 'about') return <AboutWindow />
  } catch { /* fall through */ }
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{route()}</React.StrictMode>
)
