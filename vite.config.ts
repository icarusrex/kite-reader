import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Site sits behind Cloudflare Access; the manifest fetch must carry the auth cookie.
      useCredentials: true,
      includeAssets: ['icon.svg'],
      workbox: {
        // Books included so the tablet can read them offline.
        globPatterns: ['**/*.{js,css,html,svg,woff2,json,mp3,wav,jpg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Words generated on demand by the server: keep them on the device once heard (offline use)
        runtimeCaching: [{ urlPattern: /\/api\/say\?/, handler: 'CacheFirst', options: { cacheName: 'say', expiration: { maxEntries: 5000 }, cacheableResponse: { statuses: [200] } } }],
      },
      manifest: {
        name: 'Kite Reader',
        short_name: 'Kite',
        description: 'Home reading tutor',
        theme_color: '#FBF6EC',
        background_color: '#FBF6EC',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
});
