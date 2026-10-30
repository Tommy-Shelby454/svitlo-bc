// Збирає карту адрес міста у out/addresses.json (запускається GitHub Actions раз на тиждень).
// Локально: npm run map   (довго: обходить усі вулиці; npm run map:demo — вигадана карта)

import { mkdir, writeFile } from 'node:fs/promises';
import { buildAddressMap } from '../server/addresses.js';

const map = await buildAddressMap({
  onProgress: (i, n) => {
    if (i % 25 === 0 || i === n) console.log(`Вулиць опрацьовано: ${i}/${n}`);
  },
});

const found = Object.keys(map.streets).length;
const total = map.stats.streets;
console.log(`Готово: ${found} вулиць із даними, пропущено ${map.stats.failed}, усього у списку ${total}`);

if (!map.demo && found < total * 0.5) {
  console.error('Занадто мало вулиць із даними (менше половини). Попередня карта залишається без змін.');
  process.exit(1);
}

await mkdir('out', { recursive: true });
await writeFile('out/addresses.json', JSON.stringify(map));
const houses = Object.values(map.streets).reduce((n, h) => n + Object.keys(h).length, 0);
console.log(`Збережено out/addresses.json: ${houses} будинків`);
