import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname),
  server: { port: 5190, strictPort: true, host: '127.0.0.1' },
  resolve: {
    alias: {
      '@render': path.resolve(__dirname, '../../src/render'),
    },
  },
});
