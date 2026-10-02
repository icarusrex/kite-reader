import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Shown in Grown-ups > Settings so the device can be checked against the latest deploy
const git = (cmd: string) => { try { return execSync(`git ${cmd}`).toString().trim(); } catch { return ''; } };
const BUILD = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${git('rev-parse --short HEAD') || 'local'}`;

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    VitePWA({
      // Registered from src/core/update.ts, which applies new versions on home screens only.
      registerType: 'prompt',
      injectRegister: false,
      useCredentials: true,
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,json,mp3,wav,jpg}'],
        globIgnores: ['books/*/*.jpg'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // /api/signin must reach the network (and Cloudflare Access), not the offline copy of the app.
        navigateFallbackDenylist: [/^\/api\//],
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
