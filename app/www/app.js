'use strict';

const TZ = 'Europe/Kiev';
const REFRESH_MS = 5 * 60 * 1000;
const STALE_MIN = 90; // скільки хвилин без оновлень на сервері вважаємо підозрілим
const SCROLL_RANGE = 112; // різниця між великим і малим заголовком, px
const LS_KEY = 'svitlo.v3';
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const SVG_TAGS = new Set(['svg', 'circle']);

const $app = document.getElementById('app');
const $hdr = document.getElementById('hdr');
const $sub = document.getElementById('sub');

/* ---------- Збереження на телефоні ---------- */
const store = {
  get() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } },
  set(patch) { try { localStorage.setItem(LS_KEY, JSON.stringify({ ...store.get(), ...patch })); } catch {} },
};

/* ---------- Допоміжні ---------- */
function h(tag, props, ...kids) {
  const el = SVG_TAGS.has(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

const clock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function kyivNow() {
  const p = Object.fromEntries(clock.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
const addDays = (d, n) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const dowKey = (d) => { const g = new Date(`${d}T12:00:00Z`).getUTCDay(); return g === 0 ? 7 : g; };
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const endLabel = (idx) => (idx >= 48 ? '24:00' : hhmm(idx * 30));
const dateLabel = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('uk-UA', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const atLabel = (at) => `${at >= 1440 ? 'завтра о ' : 'о '}${hhmm(at % 1440)}`;
const timeOf = (iso) => new Date(iso).toLocaleTimeString('uk-UA', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

function humanAgo(min) {
  if (min < 120) return `${Math.round(min)} хв`;
  const hrs = min / 60;
  return hrs < 48 ? `${Math.round(hrs)} год` : `${Math.round(hrs / 24)} дн`;
}

/* ---------- Пошук адрес ---------- */
const LATIN = { a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', i: 'і', y: 'у' };
const nHouse = (s) => String(s).toLowerCase().replace(/\s+/g, '').replace(/[a-z]/g, (c) => LATIN[c] ?? c);
const nText = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
const natural = (a, b) => a.localeCompare(b, 'uk', { numeric: true });

/** Точна вулиця за введеним текстом (або єдина, що містить цей текст) */
function findStreet(map, input) {
  const q = nText(input);
  if (!q) return null;
  const names = Object.keys(map.streets);
  const exact = names.find((n) => nText(n) === q);
  if (exact) return exact;
  const part = names.filter((n) => nText(n).includes(q));
  return part.length === 1 && q.length >= 4 ? part[0] : null;
}
/** Підказки вулиць: спершу ті, де збіг ближче до початку назви */
function suggestStreets(map, input, limit = 8) {
  const q = nText(input);
  if (!q) return [];
  return Object.keys(map.streets)
    .map((n) => ({ n, i: nText(n).indexOf(q) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i || natural(a.n, b.n))
    .slice(0, limit)
    .map((x) => x.n);
}
function findHouse(houses, input) {
  if (houses[input]) return input;
  const q = nHouse(input);
  return q ? Object.keys(houses).find((k) => nHouse(k) === q) ?? null : null;
}
function suggestHouses(houses, input, limit = 16) {
  const q = nHouse(input);
  return Object.keys(houses).filter((k) => nHouse(k).startsWith(q)).sort(natural).slice(0, limit);
}
/** Адреса -> черга за картою міста */
function resolveAddress(map, street, house) {
  const sk = findStreet(map, street);
  if (!sk) return null;
  const hk = findHouse(map.streets[sk], house);
  return hk ? { street: sk, house: hk, group: map.streets[sk][hk] } : null;
}

/* ---------- Дані ---------- */
const DEC = { 1: 'on', 0: 'off', m: 'maybe' };
const decode = (str) => [...String(str)].map((c) => DEC[c] ?? 'unknown');

function groupData(snapshot, group) {
  const g = snapshot?.groups?.[group];
  if (!g) return null;
  return {
    days: g.days.map((d) => ({ date: d.date, slots: decode(d.slots) })),
    week: g.week.map((w) => ({ dow: w.dow, slots: decode(w.slots) })),
  };
}

function buildTimeline(g, today) {
  return [0, 1].map((i) => {
    const date = addDays(today, i);
    const fact = g.days.find((d) => d.date === date);
    if (fact) return { date, slots: fact.slots, source: 'fact' };
    const plan = g.week.find((w) => w.dow === dowKey(date));
    return plan ? { date, slots: plan.slots, source: 'plan' } : { date, slots: null, source: 'none' };
  });
}

function runs(slots, kind) {
  const out = [];
  let start = null;
  slots.forEach((s, i) => {
    if (s === kind && start === null) start = i;
    if ((s !== kind || i === slots.length - 1) && start !== null) {
      out.push([start, s === kind ? i + 1 : i]);
      start = null;
    }
  });
  return out;
}

/** Поточний стан, його межі та наступна зміна (у хвилинах від початку сьогоднішньої доби) */
function analyze(timeline, nowMin) {
  const flat = [];
  timeline.forEach((d, di) => d.slots && d.slots.forEach((s, i) => flat.push({ s, at: di * 1440 + i * 30 })));
  const i = flat.findIndex((x) => x.at <= nowMin && nowMin < x.at + 30);
  if (i < 0 || flat[i].s === 'unknown') return { state: 'unknown' };
  const s = flat[i].s;
  let a = i;
  while (a > 0 && flat[a - 1].s === s && flat[a - 1].at + 30 === flat[a].at) a--;
  let b = i + 1;
  while (b < flat.length && flat[b].s === s && flat[b].at === flat[b - 1].at + 30) b++;
  const nxt = b < flat.length && flat[b].at === flat[b - 1].at + 30 && flat[b].s !== 'unknown' ? flat[b] : null;
  return { state: s, start: flat[a].at, end: nxt ? nxt.at : null, next: nxt };
}

/* ---------- Мережа ---------- */
let cfg = { dataUrl: '/schedule.json' };
let data = null;
let fetchErr = null;
let busy = false;
let fetchedAt = null;

async function loadConfig() {
  try {
    const r = await fetch('config.json', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); if (j && j.dataUrl) cfg = j; }
  } catch {}
}

async function load() {
  try {
    const sep = cfg.dataUrl.includes('?') ? '&' : '?';
    const r = await fetch(`${cfg.dataUrl}${sep}t=${Math.floor(Date.now() / REFRESH_MS)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`Сервер даних відповів ${r.status}`);
    const j = await r.json();
    if (!j || !j.groups) throw new Error('Невірний формат даних');
    data = j; fetchErr = null; fetchedAt = Date.now();
    store.set({ last: j });
  } catch (err) {
    fetchErr = err;
    if (!data) data = store.get().last || null;
  }
}

let mapCache = null;
let mapPromise = null;
function loadMap() {
  if (mapCache) return Promise.resolve(mapCache);
  mapPromise ??= (async () => {
    const url = cfg.addressesUrl || '/addresses.json';
    const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 3600000)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status === 404 ? 'Список адрес ще не підготовлено на сервері' : `Список адрес недоступний (${r.status})`);
    const j = await r.json();
    if (!j || !j.streets) throw new Error('Невірний формат списку адрес');
    mapCache = j;
    return j;
  })().finally(() => { mapPromise = null; });
  return mapPromise;
}

/** Раз на добу перевіряє, чи не змінилась черга збереженої адреси */
async function syncGroup() {
  const st = store.get();
  if (!st.address || Date.now() - (st.groupCheckedAt || 0) < 86400000) return;
  try {
    const hit = resolveAddress(await loadMap(), st.address.street, st.address.house);
    if (hit) store.set({ group: hit.group, groupCheckedAt: Date.now() });
  } catch {}
}

async function refresh() {
  busy = true; render();
  await load();
  busy = false; render();
}

/* ---------- Компоненти ---------- */
function ring(progress, big, unit, animate) {
  const R = 50, C = 2 * Math.PI * R;
  const target = (C * (1 - progress)).toFixed(1);
  const prog = h('circle', { class: 'prog', cx: 60, cy: 60, r: R, fill: 'none', 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-dasharray': C.toFixed(1), transform: 'rotate(-90 60 60)' });
  prog.style.strokeDashoffset = animate ? C.toFixed(1) : target;
  if (animate) requestAnimationFrame(() => requestAnimationFrame(() => { prog.style.strokeDashoffset = target; }));
  return h('div', { class: 'ring', 'aria-hidden': 'true' },
    h('svg', { viewBox: '0 0 120 120' }, h('circle', { class: 'track', cx: 60, cy: 60, r: R, fill: 'none', 'stroke-width': 11 }), prog),
    h('div', { class: 'ring-c' }, h('b', {}, big), h('span', {}, unit)));
}

function hero(timeline, now, animate) {
  const a = analyze(timeline, now.min);
  const sName = a.next ? a.next.s : null;
  let cls = 'unknown', big = 'Немає даних', detail = 'Графік на сьогодні ще не опубліковано.';
  if (a.state === 'on') {
    cls = 'on'; big = 'Світло є';
    detail = a.next ? `${sName === 'off' ? 'Відключення' : 'Можливе відключення'} ${atLabel(a.next.at)}` : 'Найближчим часом відключень за графіком немає.';
  } else if (a.state === 'off') {
    cls = 'off'; big = 'Світла немає';
    detail = a.next ? `Увімкнення ${atLabel(a.next.at)}` : 'Увімкнення за наявними даними не передбачено.';
  } else if (a.state === 'maybe') {
    cls = 'maybe'; big = 'Можливе відключення';
    detail = a.next ? `Далі зміниться ${atLabel(a.next.at)}` : 'Світло може зникнути в цей період.';
  }
  let progress = 1, cBig = '—', cUnit = a.state === 'unknown' ? '' : 'без змін';
  if (a.state !== 'unknown' && a.end != null) {
    const left = Math.max(0, a.end - now.min);
    progress = Math.min(1, Math.max(0, (now.min - a.start) / (a.end - a.start)));
    if (left < 60) { cBig = String(left); cUnit = 'хв'; } else { cBig = `${Math.floor(left / 60)}:${pad(left % 60)}`; cUnit = 'год'; }
  }
  return h('section', { class: `card hero ${cls}` },
    ring(progress, cBig, cUnit, animate),
    h('div', { class: 'hero-t' }, h('div', { class: 'big' }, big), h('p', {}, detail)));
}

function dayCard(day, title, nowIdx) {
  if (!day.slots) {
    return h('section', { class: 'card' }, h('div', { class: 'card-title' }, h('b', {}, title)), h('p', { class: 'muted' }, 'ДТЕК ще не опублікував графік на цей день.'));
  }
  const chips = [
    ...runs(day.slots, 'off').map(([a, b]) => h('span', { class: 'chip' }, `${hhmm(a * 30)}–${endLabel(b)}`)),
    ...runs(day.slots, 'maybe').map(([a, b]) => h('span', { class: 'chip maybe' }, `можливо ${hhmm(a * 30)}–${endLabel(b)}`)),
  ];
  if (!chips.length) chips.push(h('span', { class: 'chip ok' }, 'відключень немає'));
  return h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('b', {}, title), h('span', { class: 'muted small' }, day.source === 'plan' ? 'за тижневим планом' : dateLabel(day.date))),
    h('div', { class: 'barwrap', 'aria-hidden': 'true' },
      h('div', { class: 'bar' }, day.slots.map((s) => h('i', { class: s }))),
      nowIdx == null ? null : h('span', { class: 'now', style: `left:${(nowIdx / 48) * 100}%` })),
    h('div', { class: 'axis', 'aria-hidden': 'true' }, [0, 3, 6, 9, 12, 15, 18, 21, 24].map((n) => h('span', {}, String(n)))),
    h('div', { class: 'chips' }, chips));
}

function weekCard(g, today) {
  if (!g.week.length) return null;
  const todayDow = dowKey(today);
  return h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('b', {}, 'Тиждень'), h('span', { class: 'muted small' }, 'типовий план')),
    h('div', { class: 'week' }, g.week.map((w) =>
      h('div', { class: `row${w.dow === todayDow ? ' today' : ''}` }, h('b', {}, DOW[w.dow - 1]),
        h('div', { class: 'bar', 'aria-hidden': 'true' }, w.slots.map((s) => h('i', { class: s })))))));
}

/* ---------- Вікна (шторки) ---------- */
function closeSheets() {
  for (const id of ['scrim', 'sheet']) { const el = document.getElementById(id); if (el) el.remove(); }
}
function showSheet(label, ...content) {
  closeSheets();
  document.body.append(
    h('div', { class: 'scrim', id: 'scrim', onclick: closeSheets }),
    h('div', { class: 'sheet', id: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, h('div', { class: 'grab' }), ...content));
}

/** Запасний варіант: вибір черги вручну */
function openPicker() {
  const groups = data ? Object.keys(data.groups) : [];
  const current = store.get().group;
  const pick = (g) => { store.set({ group: g, address: null, groupCheckedAt: 0 }); closeSheets(); render(true); };
  showSheet('Вибір черги',
    h('h2', {}, 'Черга вручну'),
    h('p', {}, 'Свою чергу видно на сайті ДТЕК Київські регіональні електромережі після введення адреси.'),
    h('div', { class: 'grid' }, groups.map((g) => h('button', { class: 'gbtn', 'aria-pressed': String(g === current), onclick: () => pick(g) }, g))));
}

/** Введення адреси: вулиця й будинок із підказками, черга визначається за картою міста */
function openAddress() {
  const saved = store.get().address || {};
  let map = null;
  let curStreet = null;
  let curHouse = null;

  const street = h('input', { class: 'field', type: 'text', placeholder: 'Вулиця, напр. Чорних', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Вулиця' });
  const house = h('input', { class: 'field', type: 'text', placeholder: 'Будинок, напр. 18 або 12А', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'Будинок' });
  street.value = saved.street || '';
  house.value = saved.house || '';
  const sugg = h('div', { class: 'sugg' });
  const msg = h('p', { class: 'msg' }, 'Завантажую список вулиць…');
  const save = h('button', { class: 'btn', type: 'button' }, 'Зберегти');
  save.disabled = true;

  function update() {
    if (!map) return;
    sugg.replaceChildren();
    let ok = false;
    let info = '';
    curHouse = null;
    curStreet = findStreet(map, street.value);
    if (!curStreet) {
      const list = suggestStreets(map, street.value);
      list.forEach((n) => sugg.append(h('button', { class: 'sugg-item', type: 'button', onclick: () => { street.value = n; update(); house.focus(); } }, n)));
      if (street.value.trim() && !list.length) info = 'Такої вулиці не знайдено. Спробуйте ввести лише частину назви.';
    } else {
      const houses = map.streets[curStreet];
      curHouse = findHouse(houses, house.value);
      if (!curHouse) {
        const list = suggestHouses(houses, house.value);
        if (list.length) sugg.append(h('div', { class: 'hchips' }, list.map((x) => h('button', { class: 'hchip', type: 'button', onclick: () => { house.value = x; update(); } }, x))));
        info = house.value.trim() && !list.length ? 'Такого будинку на цій вулиці немає у списку ДТЕК.' : 'Введіть або оберіть номер будинку.';
      } else {
        ok = true;
        info = `Знайдено: ${curStreet}, ${curHouse} · черга ${houses[curHouse]}`;
      }
    }
    msg.textContent = info;
    msg.className = ok ? 'msg ok' : 'msg';
    save.disabled = !ok;
  }
  street.addEventListener('input', update);
  house.addEventListener('input', update);
  save.addEventListener('click', () => {
    if (!curStreet || !curHouse) return;
    store.set({ address: { street: curStreet, house: curHouse }, group: map.streets[curStreet][curHouse], groupCheckedAt: Date.now() });
    closeSheets();
    render(true);
  });

  showSheet('Моя адреса',
    h('h2', {}, 'Моя адреса'),
    h('p', {}, 'Адреса зберігається лише на цьому телефоні. Черга визначається автоматично за даними ДТЕК.'),
    street, house, sugg, msg,
    h('div', { class: 'sheet-actions' }, save),
    h('button', { class: 'link', type: 'button', onclick: () => { closeSheets(); openPicker(); } }, 'Не знайшли адресу? Обрати чергу вручну'));

  loadMap()
    .then((m) => { map = m; msg.textContent = ''; update(); })
    .catch((err) => { msg.textContent = err.message; msg.className = 'msg err'; });
}

/* ---------- Малювання ---------- */
let addressPrompted = false;

function render(animate = false) {
  const now = kyivNow();
  const st = store.get();
  const group = st.group;
  const address = st.address;
  const g = groupData(data, group);
  const parts = [];

  $sub.textContent = address ? `${address.street}, ${address.house}${group ? ` · черга ${group}` : ''}` : `${((data && data.city) || 'Біла Церква').replace(/^м\.\s*/, '')}${group ? ` · черга ${group}` : ''}`;

  if (!data) {
    parts.push(fetchErr
      ? h('section', { class: 'card' }, h('b', {}, 'Не вдалося завантажити графік'), h('p', { class: 'muted' }, fetchErr.message), h('button', { class: 'btn', onclick: refresh }, 'Спробувати знову'))
      : h('div', { class: 'skeleton' }));
    return $app.replaceChildren(...parts);
  }

  if (data.demo) parts.push(h('div', { class: 'note' }, 'ДЕМО: показані вигадані дані, не реальний графік ДТЕК.'));
  const ageMin = (Date.now() - Date.parse(data.generatedAt)) / 60000;
  if (ageMin > STALE_MIN) parts.push(h('div', { class: 'note err' }, `Дані на сервері не оновлювались ${humanAgo(ageMin)}. Показано останній відомий графік, він може бути неточним.`));
  if (fetchErr) parts.push(h('div', { class: 'note err' }, 'Немає звʼязку з сервером даних. Показано збережений графік.'));

  if (!g) {
    parts.push(group
      ? h('section', { class: 'card' },
        h('div', { class: 'card-title' }, h('b', {}, `Для черги ${group} немає графіка`)),
        h('p', { class: 'muted' }, 'У даних сервера цієї черги поки немає. Спробуйте оновити пізніше або змініть адресу.'),
        h('button', { class: 'btn', onclick: openAddress }, 'Змінити адресу'))
      : h('section', { class: 'card' },
        h('div', { class: 'card-title' }, h('b', {}, 'Додайте свою адресу')),
        h('p', { class: 'muted' }, 'Введіть вулицю й будинок, і застосунок сам визначить вашу чергу та покаже графік. Адреса зберігається лише на телефоні.'),
        h('button', { class: 'btn', onclick: openAddress }, 'Додати адресу')));
    if (!group && !addressPrompted) { addressPrompted = true; openAddress(); }
    return $app.replaceChildren(...parts);
  }

  const timeline = buildTimeline(g, now.date);
  const nowIdx = Math.floor(now.min / 30) + (now.min % 30) / 30;
  parts.push(hero(timeline, now, animate));
  parts.push(dayCard(timeline[0], 'Сьогодні', nowIdx));
  parts.push(dayCard(timeline[1], 'Завтра', null));
  parts.push(h('div', { class: 'legend' }, h('span', { class: 'l-on' }, 'є світло'), h('span', { class: 'l-off' }, 'відключення'), h('span', { class: 'l-maybe' }, 'можливе відключення')));
  const wk = weekCard(g, now.date);
  if (wk) parts.push(wk);
  parts.push(h('div', { class: 'card list' },
    h('button', { class: 'item', onclick: openAddress }, h('span', {}, 'Моя адреса'), h('span', { class: 'val' }, address ? `${address.street}, ${address.house}` : 'не вказано')),
    h('div', { class: 'item static' }, h('span', {}, 'Черга'), h('b', {}, group)),
    h('button', { class: 'item', onclick: refresh, disabled: busy }, h('span', {}, 'Оновити зараз'), h('span', { class: 'muted small' }, busy ? 'Оновлюю…' : ''))));
  parts.push(h('div', { class: 'foot muted small' },
    data.updated ? h('span', {}, `Оновлено на сайті ДТЕК: ${data.updated}`) : null,
    h('span', {}, `Дані зібрано о ${timeOf(data.generatedAt)} · застосунок звіряється кожні 5 хв`)));
  $app.replaceChildren(...parts);
}

/* ---------- Запуск ---------- */
function onScroll() {
  const p = Math.min(1, Math.max(0, (window.scrollY || 0) / SCROLL_RANGE));
  $hdr.style.setProperty('--p', p.toFixed(3));
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

async function boot() {
  data = store.get().last || null;
  render(true);
  await loadConfig();
  await load();
  await syncGroup();
  render(false);
  setInterval(async () => { await load(); render(false); }, REFRESH_MS);
  setInterval(() => render(false), 30 * 1000); // перерахунок «зараз» без запиту
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') { await load(); render(false); }
  });
}

if (!window.Capacitor && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
