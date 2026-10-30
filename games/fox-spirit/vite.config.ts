import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root,
  server: { port: 5180, strictPort: true, host: '127.0.0.1' },
  build: { outDir: path.resolve(root, '../../dist/fox-spirit'), emptyOutDir: true },
});
