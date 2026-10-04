import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'AgriSens',
        short_name: 'AgriSens',
        description: 'Plateforme agronomique et logistique camerounaise',
        theme_color: '#1B5E20',
        background_color: '#ffffff',
        display: 'standalone',
        lang: 'fr',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          // F-15 : catalogue et détail produits – stale-while-revalidate.
          // Motif sur `url.pathname` : la requête réelle porte un query (page,
          // filtres), que l'ancre `$` exclusive aurait rejeté (pas de cache).
          {
            urlPattern: ({ url }) =>
              /\/api\/v1\/produits\/?$/.test(url.pathname) ||
              /\/api\/v1\/produits\/[0-9a-fA-F-]+\/?$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-catalogue',
              expiration: { maxEntries: 100, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [200] },
            },
          },
          // F-15 : données privées – network-first avec timeout 4 s.
          {
            urlPattern: ({ url }) =>
              /\/api\/v1\/(commandes|paiements|livraisons|accompagnements|notifications|statistiques|conversations)\//.test(
                url.pathname
              ),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-prive',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          // F-15 : images (fichiers signés) – cache-first avec expiration.
          {
            urlPattern: ({ url }) => /\/api\/v1\/fichiers\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
});
