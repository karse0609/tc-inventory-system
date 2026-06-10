import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyDeployedInventorySnapshotIfNeeded } from './utils/deployedInventoryBootstrap'

applyDeployedInventorySnapshotIfNeeded()

if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW(swUrl, registration) {
        if (!registration) return
        const intervalMs = 4 * 60 * 60 * 1000
        window.setInterval(() => {
          void registration.update()
        }, intervalMs)
        console.log('[tc-inv pwa] service worker registered', swUrl)
      },
      onRegisterError(err) {
        console.warn('[tc-inv pwa] registerSW error', err)
      },
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
