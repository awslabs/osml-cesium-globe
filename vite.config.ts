import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import cesium from 'vite-plugin-cesium';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'), // This aligns with your tsconfig.json
    },
  },
  plugins: [
    react(),
    cesium(),
    electron([
      {
        entry: 'electron/main/index.ts',
        onstart(options) {
          options.startup().then(r => {console.log("Starting up!")});
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
          },
        },
      },
      {
        entry: 'electron/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
          },
        },
      }
    ]),
    renderer(),
  ],
});
