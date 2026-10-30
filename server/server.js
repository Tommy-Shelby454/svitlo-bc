// Локальний сервер для перегляду застосунку на комп'ютері:
//   npm run demo   — з вигаданими даними
//   npm start      — з реальними даними ДТЕК
// Для телефону дані збирає GitHub (див. README), цей сервер не потрібен.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITY, DEMO, HttpError, closeSession, getRaw } from './dtek.js';
import { getSnapshot } from './snapshot.js';

const PORT = Number(process.env.PORT) || 3000;
const WWW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app/www');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const json = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/schedule.json') return json(res, 200, await getSnapshot());

    if (url.pathname === '/api/raw' && process.env.DEBUG === '1') {
      return json(res, 200, await getRaw((url.searchParams.get('street') || '').trim()));
    }

    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(WWW, '.' + rel);
    if (!file.startsWith(WWW + path.sep)) throw new HttpError(403, 'forbidden', 'Заборонено');
    const body = await readFile(file).catch(() => null);
    if (!body) throw new HttpError(404, 'not_found', 'Файл не знайдено');
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    const status = err.status || 502;
    if (status >= 500) console.error(new Date().toISOString(), err.code || '', err.message);
    json(res, status, { error: err.code || 'upstream_error', message: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Світло БЦ: http://localhost:${PORT}  (${DEMO ? 'ДЕМО-режим, дані вигадані' : 'реальні дані ДТЕК'}; місто: ${CITY})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await closeSession();
    process.exit(0);
  });
}
