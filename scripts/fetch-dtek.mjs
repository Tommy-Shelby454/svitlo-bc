// Забирає графіки з ДТЕК і зберігає out/schedule.json (запускається GitHub Actions кожні 15 хв).
// Локально: npm run fetch   (або npm run fetch:demo — з вигаданими даними)

import { mkdir, writeFile } from 'node:fs/promises';
import { closeSession } from '../server/dtek.js';
import { getSnapshot } from '../server/snapshot.js';

let snap = null;
for (let attempt = 1; attempt <= 3 && !snap; attempt++) {
  try {
    snap = await getSnapshot();
  } catch (err) {
    console.error(`Спроба ${attempt}/3 невдала: ${err.message}`);
    await closeSession();
    if (attempt < 3) await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
}
await closeSession();

if (!snap) {
  console.error('Не вдалося отримати дані ДТЕК. Попередній файл залишається без змін.');
  process.exit(1);
}

await mkdir('out', { recursive: true });
await writeFile('out/schedule.json', JSON.stringify(snap));
const groups = Object.keys(snap.groups);
console.log(`Готово: ${groups.length} черг (${groups.join(', ')}), оновлено на сайті ДТЕК: ${snap.updated ?? 'невідомо'}`);
