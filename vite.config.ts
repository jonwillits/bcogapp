import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Production builds are served from the GitHub Pages project sub-path
// (https://jonwillits.github.io/bcogapp/); `vite dev` stays at the root.
// Gate on `mode`, not `command`: Vite passes command 'serve' for BOTH dev and
// preview, so a `command === 'build'` check would make `vite preview` serve the
// /bcogapp/-based build at the root — every asset request then falls through to
// the SPA fallback and returns index.html, and the app never mounts.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/bcogapp/' : '/',
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
        runtimeCaching: [
          {
            // Lab handouts are fetched live from the course repo (single source
            // of truth). Serve the cached copy immediately and refresh in the
            // background, so labs still open offline after one visit.
            urlPattern:
              /^https:\/\/raw\.githubusercontent\.com\/jonwillits\/intro_to_bcs\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'course-lab-content',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
}))
