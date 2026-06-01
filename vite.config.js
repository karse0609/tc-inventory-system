import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { inventoryFileApiPlugin } from './vite/inventoryFileApiPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    inventoryFileApiPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      /** `virtual:pwa-register` 사용 (main.jsx) */
      injectRegister: false,
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        id: '/',
        lang: 'ko',
        name: 'TC TECH Inventory',
        short_name: 'TC TECH',
        description: 'TC TECH overseas warehouse inventory and inbound processing.',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'natural',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 8,
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
