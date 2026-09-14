import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Also generate/register the service worker under `vite dev`, so
      // offline behavior can be tested without a full build + preview.
      devOptions: {
        enabled: true,
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Webcam MediaPipe PoC',
        short_name: 'MediaPipe PoC',
        description:
          'Webcam + MediaPipe Tasks Vision proof of concept (face landmarks, background removal).',
        theme_color: '#16171d',
        background_color: '#16171d',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Precache the built app shell (HTML/JS/CSS) so a refresh works
        // offline. This does NOT cover the MediaPipe WASM/model files,
        // which are fetched from a different origin at runtime and are
        // handled separately (see src/cache/modelCache.ts for the model
        // assets; the WASM runtime files aren't cached yet).
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
      },
    }),
  ],
})
