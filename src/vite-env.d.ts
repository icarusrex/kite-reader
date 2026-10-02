/// <reference types="vite-plugin-pwa/client" />
declare module "*.txt?raw" { const s: string; export default s; }

declare const __BUILD__: string;
