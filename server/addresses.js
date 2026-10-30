// Публічна карта міста: вулиця -> будинок -> черга відключень.
// Нічого особистого тут немає: це ті самі дані, що на сайті ДТЕК. Застосунок за такою картою
// сам визначає чергу за адресою, яку користувач ввів на телефоні.

import { CITY, DEMO, closeSession, getRaw, getStreets } from './dtek.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Відповідь getHomeNum -> { "10": "1.1", "10А": "3.2", ... } (будинки без черги пропускаються) */
export function housesFromRaw(raw) {
  const out = {};
  for (const [house, entry] of Object.entries(raw?.data ?? {})) {
    const g = [].concat(entry?.sub_type_reason ?? [])[0];
    if (g) out[house] = String(g).replace(/^GPV/i, '');
  }
  return out;
}

export function demoAddressMap() {
  const groups = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];
  const streets = {};
  ['бул. Олександрійський', 'вул. Леваневського', 'вул. Ярослава Мудрого'].forEach((name, si) => {
    const houses = {};
    for (let n = 1; n <= 40; n++) houses[String(n)] = groups[(n + si * 5) % groups.length];
    houses['10А'] = groups[(si + 4) % groups.length];
    streets[name] = houses;
  });
  return { version: 1, source: 'demo', city: CITY, demo: true, generatedAt: new Date().toISOString(), streets, stats: { streets: 3, failed: 0 } };
}

/** Обходить усі вулиці міста (довго: десятки хвилин, тому запускається раз на тиждень) */
export async function buildAddressMap({ onProgress, delayMs = 250 } = {}) {
  if (DEMO) return demoAddressMap();
  const names = await getStreets();
  const streets = {};
  let failed = 0;
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    let houses = null;
    for (let attempt = 1; attempt <= 3 && !houses; attempt++) {
      try {
        houses = housesFromRaw(await getRaw(name, { nocache: true }));
      } catch (err) {
        if (attempt === 3) {
          failed++;
          console.error(`Вулиця «${name}» пропущена: ${err.message}`);
        } else {
          await sleep(2000 * attempt);
        }
      }
    }
    if (houses && Object.keys(houses).length) streets[name] = houses;
    onProgress?.(i + 1, names.length);
    await sleep(delayMs);
  }
  await closeSession();
  return {
    version: 1,
    source: 'dtek-krem.com.ua',
    city: CITY,
    demo: false,
    generatedAt: new Date().toISOString(),
    streets,
    stats: { streets: names.length, failed },
  };
}
