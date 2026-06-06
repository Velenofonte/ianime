import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'iAnime',
        short_name: 'iAnime',
        description: 'Tracker anime con preferiti, calendario e news',
        theme_color: '#1e1b4b',
        background_color: '#0f0f14',
        display: 'standalone',
        lang: 'it',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.myanimelist\.net\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'anime-images' },
          },
          {
            urlPattern: /^https:\/\/graphql\.anilist\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'anilist-api', networkTimeoutSeconds: 5 },
          },
          {
            urlPattern: /^https:\/\/api\.jikan\.moe\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'jikan-api', networkTimeoutSeconds: 5 },
          },
          {
            urlPattern: /^https:\/\/aninews\.vercel\.app\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'aninews-api', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
});
