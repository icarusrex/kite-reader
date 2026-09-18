import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      useCredentials: true,
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,json,mp3,wav,jpg}'],
        globIgnores: ['books/*/*.jpg'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: /\/books\/[^/]+\/[^/]+\.jpg$/, handler: 'CacheFirst', options: { cacheName: 'book-pages', expiration: { maxEntries: 2000 }, cacheableResponse: { statuses: [200] } } },
          { urlPattern: /\/api\/say\?/, handler: 'CacheFirst', options: { cacheName: 'say', expiration: { maxEntries: 5000 }, cacheableResponse: { statuses: [200] } } },
        ],
      },
      manifest: {
        name: 'Kite',
        short_name: 'Kite',
        description: 'Private home early-learning tutor',
        theme_color: '#FBF6EC',
        background_color: '#FBF6EC',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
});
