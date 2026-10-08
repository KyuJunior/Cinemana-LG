import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  base: '',
  plugins: [
    legacy({
      targets: ['chrome 38'],
      polyfills: false,
      renderLegacyChunks: true
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    minify: false,
  },
});
