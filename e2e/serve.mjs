import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../client/dist-e2e');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2'
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    let path = resolve(directory, `.${pathname}`);
    if (path !== directory && !path.startsWith(directory + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if (!(await stat(path)).isFile()) path = resolve(directory, 'index.html');
    } catch {
      // Route fallback preserves real static files and does not mask missing assets.
      if (extname(pathname)) { response.writeHead(404).end(); return; }
      path = resolve(directory, 'index.html');
    }
    const bytes = await readFile(path);
    response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {
    response.writeHead(400).end();
  }
});

server.listen(4173, '127.0.0.1', () => console.log('Isolated UsTogether export: http://127.0.0.1:4173'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
