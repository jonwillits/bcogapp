import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Base is relative so the hash-routed SPA works both at the domain root (local
// `vite preview`) and under a project subpath (e.g. GitHub Pages `/bcogapp/`).
// Revisit when we pin a deploy target in Phase 4.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'app-icon.svg'],
      manifest: {
        name: 'BCOG 100 Course App',
        short_name: 'BCOG 100',
        description:
          'Interactive demonstrations and lab activities for BCOG 100 — Introduction to Brain and Cognitive Science.',
        theme_color: '#0e1420',
        background_color: '#0e1420',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Cache the built app shell + assets for offline classroom use.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
})
