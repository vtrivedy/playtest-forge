import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import type { Plugin } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '../..');

function serveAssets(): Plugin {
  return {
    name: 'serve-repo-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith('/assets/')) return next();
        const file = path.join(repo, url.slice(1));
        if (!file.startsWith(path.join(repo, 'assets')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          return next();
        }
        const ext = path.extname(file).toLowerCase();
        const types: Record<string, string> = {
          '.glb': 'model/gltf-binary',
          '.gltf': 'model/gltf+json',
          '.wav': 'audio/wav',
          '.mp3': 'audio/mpeg',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
        };
        res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root,
  server: { port: 5180, strictPort: true, host: '127.0.0.1', fs: { allow: [repo] } },
  resolve: {
    alias: {
      '@render': path.resolve(repo, 'src/render'),
      '@shared': path.resolve(repo, 'games/shared'),
    },
  },
  build: { outDir: path.resolve(repo, 'dist/fox-spirit'), emptyOutDir: true },
  plugins: [serveAssets()],
});
