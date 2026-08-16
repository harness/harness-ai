import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));
const resolveConfig = {
  alias: {
    react: resolve(root, 'node_modules/react'),
    'react-dom': resolve(root, 'node_modules/react-dom'),
  },
  dedupe: ['react', 'react-dom'],
};

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      plugins: [react()],
      root: resolve(root, 'webview'),
      server: {
        port: 5179,
        open: '/dev.html',
      },
      resolve: resolveConfig,
    };
  }

  return {
    plugins: [react()],
    build: {
      outDir: resolve(root, 'media/webview'),
      emptyOutDir: true,
      cssCodeSplit: false,
      rollupOptions: {
        input: resolve(root, 'webview/index.tsx'),
        output: {
          format: 'iife',
          name: 'HarnessVibePanel',
          inlineDynamicImports: true,
          entryFileNames: 'panel.js',
          assetFileNames: (asset) => {
            if (asset.name?.endsWith('.css')) return 'panel.css';
            return 'assets/[name][extname]';
          },
        },
      },
    },
    resolve: resolveConfig,
  };
});
