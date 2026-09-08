import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
const port = Number(process.env.PORT || 3006);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src'), '@assets': path.resolve(import.meta.dirname, '../../attached_assets') }, dedupe: ['react','react-dom'] },
  root: path.resolve(import.meta.dirname),
  build: { outDir: path.resolve(import.meta.dirname, 'dist/public'), emptyOutDir: true },
  server: { port, strictPort: true, host: '0.0.0.0' },
  preview: { port, host: '0.0.0.0' }
});
