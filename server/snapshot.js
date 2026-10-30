// Знімок графіків УСІХ черг (без прив'язки до адреси).
//
// Фактичний графік (fact) і тижневий план (preset) у відповіді ДТЕК описують усі черги
// одразу, тому для знімка достатньо одного запиту по будь-якій вулиці міста.
// Адреса користувача нікуди не передається: у застосунку просто обирається черга.

import { CITY, DEMO, HttpError, expandDay, getRaw, getStreets, kyivDate } from './dtek.js';

const CODE = { on: '1', off: '0', maybe: 'm', unknown: 'u' };
/** 48 слотів -> рядок із 48 символів: 1 є світло, 0 немає, m можливе відключення, u невідомо */
const pack = (slots) => slots.map((s) => CODE[s] ?? 'u').join('');

const label = (g) => String(g).replace(/^GPV/i, '');

export function snapshotFromRaw(raw, { city = CITY, now = new Date() } = {}) {
  const groups = {};
  const slot = (g) => (groups[label(g)] ??= { days: [], week: [] });

  const factData = raw?.fact?.data ?? {};
  for (const ts of Object.keys(factData).map(Number).sort((a, b) => a - b)) {
    const date = kyivDate(ts);
    for (const [g, hours] of Object.entries(factData[ts] ?? {})) {
      if (hours && typeof hours === 'object') slot(g).days.push({ date, slots: pack(expandDay(hours)) });
    }
  }

  for (const [g, byDay] of Object.entries(raw?.preset?.data ?? {})) {
    for (let dow = 1; dow <= 7; dow++) {
      if (byDay?.[dow]) slot(g).week.push({ dow, slots: pack(expandDay(byDay[dow])) });
    }
  }

  const sorted = Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
  return {
    version: 1,
    source: 'dtek-krem.com.ua',
    city,
    demo: DEMO,
    generatedAt: now.toISOString(),
    updated: raw?.fact?.update ?? raw?.update ?? null,
    groups: sorted,
  };
}

const hasDays = (snap) => Object.values(snap.groups).some((g) => g.days.length > 0);

/** Бере кілька вулиць по черзі, поки не знайде відповідь із графіками */
export async function getSnapshot() {
  const seed = process.env.SEED_STREET?.trim();
  const streets = seed ? [seed] : (await getStreets()).slice(0, 6);
  let lastErr;
  for (const street of streets) {
    try {
      const snap = snapshotFromRaw(await getRaw(street));
      if (hasDays(snap)) return snap;
      lastErr = new HttpError(502, 'no_schedule', `У відповіді ДТЕК для вулиці «${street}» немає графіків`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new HttpError(502, 'no_data', 'Не вдалося отримати дані ДТЕК');
}
