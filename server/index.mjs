import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAiStatus, handleApiRequest } from './api.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distDir = join(root, 'dist');
const port = Number(process.env.PORT) || 4173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

try {
  await stat(join(distDir, 'index.html'));
} catch {
  console.error(
    'Não encontrei dist/index.html. Rode `npm run build` antes de iniciar o servidor.',
  );
  process.exit(1);
}

const server = createServer(async (req, res) => {
  const url = new URL(
    req.url ?? '/',
    `http://${req.headers.host ?? 'localhost'}`,
  );

  if (url.pathname.startsWith('/api/')) {
    await handleApiRequest(req, res, url);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Método não permitido.');
    return;
  }

  try {
    const pathname = decodeURIComponent(url.pathname);
    const relativePath =
      pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let filePath = resolve(join(distDir, relativePath));

    if (filePath !== distDir && !filePath.startsWith(`${distDir}${sep}`)) {
      res.statusCode = 403;
      res.end('Acesso negado.');
      return;
    }

    let file;
    try {
      file = await readFile(filePath);
    } catch {
      filePath = join(distDir, 'index.html');
      file = await readFile(filePath);
    }

    const extension = extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader(
      'Content-Type',
      MIME_TYPES[extension] ?? 'application/octet-stream',
    );

    if (relativePath.startsWith('assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    res.end(file);
  } catch (error) {
    console.error('[postai-server] erro ao servir arquivo', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Erro interno ao servir o app.');
  }
});

server.listen(port, () => {
  const status = getAiStatus();
  console.log(`Postaí rodando em http://localhost:${port}`);
  console.log(
    status.enabled
      ? `IA real ativa — texto: ${status.textModel} · visão: ${status.visionModel}`
      : 'IA real desativada — usando a demonstração local. Defina AI_API_KEY no .env.',
  );
});
