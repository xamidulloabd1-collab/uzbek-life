import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

// `npm run build`        -> normal multi-file build (Vercel / Netlify)
// `npm run build:single` -> one self-contained index.html (easy sharing / hosting)
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2020',
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 1500,
  },
}));
