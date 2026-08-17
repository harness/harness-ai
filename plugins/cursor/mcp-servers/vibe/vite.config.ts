import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-ui',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(root, 'ui/vibe-app.html'),
    },
  },
  resolve: {
    alias: {
      react: resolve(root, 'node_modules/react'),
      'react-dom': resolve(root, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
});
