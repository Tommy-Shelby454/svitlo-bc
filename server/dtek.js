// Доступ до сайту ДТЕК Київські регіональні електромережі (dtek-krem.com.ua).
//
// Офіційного API немає: сайт віддає дані через AJAX (POST /ua/ajax) і закритий
// WAF-захистом, тому запити виконуються зсередини справжнього браузера (Playwright).

const ARGV = process.argv.slice(2);

export const CITY = process.env.CITY?.trim() || 'м. Біла Церква';
export const DEMO = process.env.DEMO?.trim() === '1' || ARGV.includes('--demo');
const HEADED = process.env.HEADLESS?.trim() === '0' || ARGV.includes('--headed');

const BASE = 'https://www.dtek-krem.com.ua';
const PAGE_URL = `${BASE}/ua/shutdowns`;
const TZ = 'Europe/Kiev';
const CACHE_TTL_MS = 5 * 60 * 1000;
const SESSION_MAX_MS = 25 * 60 * 1000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/* ---------- Час і слоти ---------- */

// Статус години -> дві половини години (00–30, 30–60)
const HALF = {
  yes: ['on', 'on'],
  no: ['off', 'off'],
  first: ['off', 'on'],
  second: ['on', 'off'],
  maybe: ['maybe', 'maybe'],
  mfirst: ['maybe', 'on'],
  msecond: ['on', 'maybe'],
};

/** {"1":"yes",...,"24":"no"} -> масив із 48 слотів по 30 хв */
export function expandDay(hours) {
  const out = [];
  for (let h = 1; h <= 24; h++) out.push(...(HALF[hours?.[h]] ?? ['unknown', 'unknown']));
  return out;
}

const dateFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ });
export const kyivDate = (unixSeconds) => dateFmt.format(new Date(unixSeconds * 1000));

/* ---------- Браузерна сесія ---------- */

let sessionPromise = null;
let sessionOpenedAt = 0;

async function openSession() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new HttpError(500, 'playwright_missing', 'Не встановлено Playwright. Виконайте: npm install && npx playwright install chromium');
  }
  const browser = await chromium.launch({
    headless: !HEADED,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  try {
    const context = await browser.newContext({ locale: 'uk-UA', timezoneId: TZ, userAgent: UA });
    const page = await context.newPage();
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // WAF спершу може показати перевірку; чекаємо, поки з'явиться справжня сторінка
    await page.waitForSelector('meta[name="csrf-token"]', { state: 'attached', timeout: 45_000 });
    const csrf = await page.$eval('meta[name="csrf-token"]', (e) => e.content);
    const ajaxUrl = await page.$eval('meta[name="ajaxUrl"]', (e) => e.content).catch(() => '/ua/ajax');
    sessionOpenedAt = Date.now();
    return { browser, page, csrf, ajaxUrl: new URL(ajaxUrl, BASE).href };
  } catch (err) {
    await browser.close().catch(() => {});
    throw new HttpError(502, 'dtek_blocked', `Не вдалося відкрити сайт ДТЕК (можливо, WAF-захист): ${err.message}`);
  }
}

async function getSession() {
  if (sessionPromise && Date.now() - sessionOpenedAt > SESSION_MAX_MS) await closeSession();
  sessionPromise ??= openSession().catch((e) => {
    sessionPromise = null;
    throw e;
  });
  return sessionPromise;
}

export async function closeSession() {
  const p = sessionPromise;
  sessionPromise = null;
  if (p) await p.then((s) => s.browser.close()).catch(() => {});
}

async function callAjax(method, fields, retry = true) {
  const s = await getSession();
  const body = new URLSearchParams({ method });
  fields.forEach(([name, value], i) => {
    body.append(`data[${i}][name]`, name);
    body.append(`data[${i}][value]`, value);
  });
  const res = await s.page.evaluate(
    async ({ url, csrf, body }) => {
      const r = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrf,
          Accept: 'application/json, text/javascript, */*; q=0.01',
        },
        body,
      });
      return { status: r.status, text: await r.text() };
    },
    { url: s.ajaxUrl, csrf: s.csrf, body: body.toString() },
  );
  let json = null;
  try {
    json = JSON.parse(res.text);
  } catch {}
  if (res.status !== 200 || !json) {
    await closeSession();
    if (retry) return callAjax(method, fields, false);
    throw new HttpError(502, 'dtek_bad_response', `ДТЕК відповів зі статусом ${res.status}, і відповідь не схожа на дані`);
  }
  return json;
}

/* ---------- Кеш ---------- */

const cache = new Map();
async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  try {
    const value = await loader();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    if (hit) return hit.value; // краще трохи застарілі дані, ніж помилка
    throw err;
  }
}

/* ---------- Демо-дані (вигадані) ---------- */

export const GROUP_IDS = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];

function demoRaw() {
  const midnight = (offset) => Math.floor(Date.parse(`${kyivDate(Date.now() / 1000 + offset * 86400)}T00:00:00Z`) / 1000);
  const dayFor = (gi, variant) => {
    const h = {};
    for (let i = 1; i <= 24; i++) h[i] = 'yes';
    const a = (gi * 2 + variant * 3) % 24;
    const b = (a + 12) % 24;
    for (let j = 0; j < 4; j++) {
      h[((a + j) % 24) + 1] = 'no';
      h[((b + j) % 24) + 1] = 'no';
    }
    h[((a + 4) % 24) + 1] = 'first';
    h[((b + 4) % 24) + 1] = 'maybe';
    return h;
  };
  const t0 = midnight(0);
  const t1 = midnight(1);
  const fact = { [t0]: {}, [t1]: {} };
  const preset = {};
  GROUP_IDS.forEach((g, gi) => {
    fact[t0][`GPV${g}`] = dayFor(gi, 0);
    fact[t1][`GPV${g}`] = dayFor(gi, 1);
    preset[`GPV${g}`] = {};
    for (let d = 1; d <= 7; d++) preset[`GPV${g}`][d] = dayFor(gi, d);
  });
  return {
    result: true,
    data: {},
    fact: {
      today: t0,
      update: new Intl.DateTimeFormat('uk-UA', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
      data: fact,
    },
    preset: { data: preset },
  };
}

/* ---------- Публічні функції ---------- */

const flattenStrings = (v) =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(flattenStrings) : v && typeof v === 'object' ? Object.values(v).flatMap(flattenStrings) : [];

export async function getStreets() {
  if (DEMO) return ['demo'];
  return cached(`streets|${CITY}`, async () => {
    const r = await callAjax('getStreets', [['city', CITY]]);
    const list = flattenStrings(r?.streets?.[CITY] ?? r?.streets ?? r?.data ?? []);
    const uniq = [...new Set(list.map((s) => s.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
    if (!uniq.length) throw new HttpError(502, 'no_streets', 'ДТЕК не повернув список вулиць для цього міста');
    return uniq;
  });
}

/** Сира відповідь getHomeNum для вулиці (з кешем на 5 хв) */
export async function getRaw(street) {
  if (DEMO) return demoRaw();
  return cached(`street|${CITY}|${street}`, async () => {
    const r = await callAjax('getHomeNum', [
      ['city', CITY],
      ['street', street],
      ['updateFact', new Date().toLocaleString('uk-UA', { timeZone: TZ })],
    ]);
    if (r?.result === false) throw new HttpError(404, 'street_not_found', `ДТЕК не знайшов вулицю «${street}»`);
    return r;
  });
}
