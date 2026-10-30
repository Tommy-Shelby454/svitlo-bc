'use strict';

const APP_VERSION = '0.3.0';
const TZ = 'Europe/Kiev';
const REFRESH_MS = 5 * 60 * 1000;
const STALE_MIN = 90; // скільки хвилин без оновлень на сервері вважаємо підозрілим
const SCROLL_RANGE = 112; // різниця між великим і малим заголовком, px
const LS_KEY = 'svitlo.v4';
const LS_OLD = 'svitlo.v3';
const SVG_TAGS = new Set(['svg', 'circle', 'path']);
const LEADS = [15, 30, 60];

const $app = document.getElementById('app');
const $hdr = document.getElementById('hdr');
const $ttl = document.getElementById('ttl');
const $sub = document.getElementById('sub');
const $act = document.getElementById('act');
const $tabs = document.getElementById('tabs');

/* ---------- Переклади ---------- */
const I18N = {
  uk: {
    'tab.home': 'Головна', 'tab.settings': 'Налаштування',
    'home.title': 'Мої адреси', 'settings.title': 'Налаштування',
    'queue': 'черга', 'house': 'буд.',
    'add': 'Додати адресу', 'add.hint': 'Можна додати кілька адрес: дім, робота, рідні.',
    'empty.title': 'Додайте свою адресу',
    'empty.text': 'Введіть вулицю й будинок, і застосунок сам визначить вашу чергу та покаже графік. Адреси зберігаються лише на телефоні.',
    'st.on': 'Світло є', 'st.off': 'Світла немає', 'st.maybe': 'Можливе відключення', 'st.unknown': 'Немає даних',
    'st.unknown.d': 'Графік на сьогодні ще не опубліковано.',
    'st.on.next.off': 'Відключення {at}', 'st.on.next.maybe': 'Можливе відключення {at}',
    'st.on.none': 'Найближчим часом відключень за графіком немає.',
    'st.off.next': 'Увімкнення {at}', 'st.off.none': 'Увімкнення за наявними даними не передбачено.',
    'st.maybe.next': 'Далі зміниться {at}', 'st.maybe.none': 'Світло може зникнути в цей період.',
    'at.today': 'о {t}', 'at.tomorrow': 'завтра о {t}',
    'ring.same': 'без змін', 'u.min': 'хв', 'u.h': 'год', 'u.d': 'дн',
    'today': 'Сьогодні', 'tomorrow': 'Завтра', 'week': 'Тиждень', 'week.sub': 'типовий план', 'plan': 'за тижневим планом',
    'nopub': 'ДТЕК ще не опублікував графік на цей день.', 'maybe.range': 'можливо {r}', 'no.outages': 'відключень немає',
    'lg.on': 'є світло', 'lg.off': 'відключення', 'lg.maybe': 'можливе відключення',
    'demo': 'ДЕМО: показані вигадані дані, не реальний графік ДТЕК.',
    'stale': 'Дані на сервері не оновлювались {ago}. Показано останній відомий графік, він може бути неточним.',
    'offline': 'Немає звʼязку з сервером даних. Показано збережений графік.',
    'load.fail': 'Не вдалося завантажити графік', 'retry': 'Спробувати знову',
    'nogroup.title': 'Для черги {g} немає графіка',
    'nogroup.text': 'У даних сервера цієї черги поки немає. Спробуйте оновити пізніше.',
    'refresh': 'Оновити зараз', 'refreshing': 'Оновлюю…',
    'updated.site': 'Оновлено на сайті ДТЕК: {u}', 'collected': 'Дані зібрано о {t} · застосунок звіряється кожні 5 хв',
    'addr.manual': 'Черга {g} (вручну)',
    'sheet.addr.title': 'Нова адреса', 'sheet.addr.text': 'Адреса зберігається лише на цьому телефоні. Черга визначається автоматично за даними ДТЕК.',
    'ph.street': 'Вулиця, напр. Чорних', 'ph.house': 'Будинок, напр. 18 або 12А',
    'loading.streets': 'Завантажую список вулиць…',
    'err.nostreet': 'Такої вулиці не знайдено. Спробуйте ввести лише частину назви.',
    'err.nohouse': 'Такого будинку на цій вулиці немає у списку ДТЕК.', 'hint.house': 'Введіть або оберіть номер будинку.',
    'found': 'Знайдено: {a} · черга {g}', 'save': 'Зберегти', 'cancel': 'Скасувати',
    'manual.link': 'Не знайшли адресу? Обрати чергу вручну',
    'manual.title': 'Черга вручну', 'manual.text': 'Свою чергу видно на сайті ДТЕК після введення адреси.',
    'err.map': 'Список адрес недоступний', 'err.map404': 'Список адрес ще не підготовлено на сервері',
    'dup': 'Ця адреса вже додана.',
    'rename': 'Назва', 'rename.ph': 'Напр. Дім', 'rename.title': 'Назва адреси', 'rename.text': 'Залиште порожнім, щоб показувати адресу.',
    'notify': 'Сповіщення', 'notify.addr': 'Сповіщення для цієї адреси',
    'delete': 'Видалити адресу', 'delete.confirm': 'Підтвердити видалення',
    'set.lang': 'Мова', 'set.style': 'Стиль', 'set.style.oneui': 'One UI', 'set.style.ios': 'iOS · скло',
    'set.notify': 'Сповіщення про світло', 'set.notify.text': 'Приходять перед кожним відключенням і перед увімкненням.',
    'set.lead': 'За скільки попереджати', 'set.lead.v': '{m} хв',
    'set.perm.denied': 'Сповіщення заборонені в налаштуваннях телефона. Дозвольте їх для застосунку.',
    'set.perm.web': 'Сповіщення працюють лише в застосунку для Android.',
    'set.test': 'Надіслати тестове сповіщення', 'set.test.sent': 'Тестове сповіщення прийде за кілька секунд.',
    'set.addrs': 'Адреси', 'set.addrs.none': 'Адрес ще немає.',
    'set.data': 'Дані', 'set.about': 'Про застосунок', 'version': 'Версія {v}',
    'n.channel': 'Світло', 'n.off': 'Відключення світла через {m} хв', 'n.maybe': 'Можливе відключення через {m} хв',
    'n.on': 'Світло з’явиться через {m} хв', 'n.body.at': '{a}: о {t}', 'n.test.title': 'Тестове сповіщення', 'n.test.body': 'Сповіщення працюють.',
  },
  en: {
    'tab.home': 'Home', 'tab.settings': 'Settings',
    'home.title': 'My addresses', 'settings.title': 'Settings',
    'queue': 'queue', 'house': 'bldg.',
    'add': 'Add address', 'add.hint': 'You can add several addresses: home, work, family.',
    'empty.title': 'Add your address',
    'empty.text': 'Enter a street and building and the app will find your queue and show the schedule. Addresses are stored only on this phone.',
    'st.on': 'Power is on', 'st.off': 'Power is off', 'st.maybe': 'Possible outage', 'st.unknown': 'No data',
    'st.unknown.d': 'Today’s schedule has not been published yet.',
    'st.on.next.off': 'Outage {at}', 'st.on.next.maybe': 'Possible outage {at}',
    'st.on.none': 'No outages scheduled soon.',
    'st.off.next': 'Power back {at}', 'st.off.none': 'No restoration time in the available data.',
    'st.maybe.next': 'Changes {at}', 'st.maybe.none': 'Power may go out during this period.',
    'at.today': 'at {t}', 'at.tomorrow': 'tomorrow at {t}',
    'ring.same': 'no change', 'u.min': 'min', 'u.h': 'h', 'u.d': 'd',
    'today': 'Today', 'tomorrow': 'Tomorrow', 'week': 'Week', 'week.sub': 'typical plan', 'plan': 'weekly plan',
    'nopub': 'DTEK has not published the schedule for this day yet.', 'maybe.range': 'possible {r}', 'no.outages': 'no outages',
    'lg.on': 'power on', 'lg.off': 'outage', 'lg.maybe': 'possible outage',
    'demo': 'DEMO: fictional data, not the real DTEK schedule.',
    'stale': 'Server data has not been updated for {ago}. Showing the last known schedule, it may be inaccurate.',
    'offline': 'No connection to the data server. Showing the saved schedule.',
    'load.fail': 'Could not load the schedule', 'retry': 'Try again',
    'nogroup.title': 'No schedule for queue {g}',
    'nogroup.text': 'The server has no data for this queue yet. Try refreshing later.',
    'refresh': 'Refresh now', 'refreshing': 'Refreshing…',
    'updated.site': 'Updated on DTEK site: {u}', 'collected': 'Data collected at {t} · the app checks every 5 min',
    'addr.manual': 'Queue {g} (manual)',
    'sheet.addr.title': 'New address', 'sheet.addr.text': 'The address is stored only on this phone. The queue is found automatically from DTEK data.',
    'ph.street': 'Street, e.g. Chornykh', 'ph.house': 'Building, e.g. 18 or 12A',
    'loading.streets': 'Loading streets…',
    'err.nostreet': 'Street not found. Try typing only part of the name.',
    'err.nohouse': 'This building is not in the DTEK list for this street.', 'hint.house': 'Type or pick a building number.',
    'found': 'Found: {a} · queue {g}', 'save': 'Save', 'cancel': 'Cancel',
    'manual.link': 'Can’t find your address? Pick a queue manually',
    'manual.title': 'Pick a queue', 'manual.text': 'You can see your queue on the DTEK site after entering your address.',
    'err.map': 'Address list unavailable', 'err.map404': 'The address list has not been prepared on the server yet',
    'dup': 'This address is already added.',
    'rename': 'Name', 'rename.ph': 'e.g. Home', 'rename.title': 'Address name', 'rename.text': 'Leave empty to show the street address.',
    'notify': 'Notifications', 'notify.addr': 'Notifications for this address',
    'delete': 'Delete address', 'delete.confirm': 'Tap again to delete',
    'set.lang': 'Language', 'set.style': 'Style', 'set.style.oneui': 'One UI', 'set.style.ios': 'iOS · glass',
    'set.notify': 'Power notifications', 'set.notify.text': 'Sent before every outage and before power returns.',
    'set.lead': 'Warn me ahead by', 'set.lead.v': '{m} min',
    'set.perm.denied': 'Notifications are blocked in phone settings. Allow them for this app.',
    'set.perm.web': 'Notifications work only in the Android app.',
    'set.test': 'Send a test notification', 'set.test.sent': 'The test notification will arrive in a few seconds.',
    'set.addrs': 'Addresses', 'set.addrs.none': 'No addresses yet.',
    'set.data': 'Data', 'set.about': 'About', 'version': 'Version {v}',
    'n.channel': 'Power', 'n.off': 'Power outage in {m} min', 'n.maybe': 'Possible outage in {m} min',
    'n.on': 'Power returns in {m} min', 'n.body.at': '{a}: at {t}', 'n.test.title': 'Test notification', 'n.test.body': 'Notifications work.',
  },
};

let lang = 'uk';
const t = (k, v) => {
  let s = I18N[lang][k] ?? I18N.uk[k] ?? k;
  if (v) for (const [a, b] of Object.entries(v)) s = s.split(`{${a}}`).join(b);
  return s;
};
const loc = () => (lang === 'uk' ? 'uk-UA' : 'en-GB');

/* ---------- Збереження на телефоні ---------- */
const DEFAULTS = { lang: 'uk', theme: 'oneui', notify: true, lead: 30 };
const uid = () => Math.random().toString(36).slice(2, 10);

const store = {
  get() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch {}
    return { addresses: [], last: null, ...s, settings: { ...DEFAULTS, ...(s.settings || {}) } };
  },
  set(patch) { try { localStorage.setItem(LS_KEY, JSON.stringify({ ...store.get(), ...patch })); } catch {} },
  setSettings(p) { store.set({ settings: { ...store.get().settings, ...p } }); },
  setAddresses(list) { store.set({ addresses: list }); },
};

/** Переносить одну адресу зі старої версії (v3), якщо нової ще немає */
function migrate() {
  try {
    if (localStorage.getItem(LS_KEY)) return;
    const old = JSON.parse(localStorage.getItem(LS_OLD) || 'null');
    if (!old) return;
    const addresses = [];
    if (old.group) {
      addresses.push({
        id: uid(), street: old.address?.street || '', house: old.address?.house || '', group: old.group,
        label: '', notify: true, checkedAt: old.groupCheckedAt || 0,
      });
    }
    store.set({ addresses, last: old.last || null });
  } catch {}
}

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

const ICONS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v10h13V10',
  settings: 'M4 7h9M19 7h1M4 17h1M11 17h9M15 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM7 14.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
};
const icon = (name) => h('svg', { class: 'ico', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, h('path', { d: ICONS[name] }));

const clock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
function kyivNow() {
  const p = Object.fromEntries(clock.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
function kyivOffsetMs(ts) {
  const p = Object.fromEntries(clock.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ts / 1000) * 1000;
}
/** Київський час (дата + хвилини від півночі, може бути >1440) -> мілісекунди Unix */
function kyivToEpoch(date, min) {
  const [y, m, d] = date.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, min);
  const first = naive - kyivOffsetMs(naive);
  return naive - kyivOffsetMs(first);
}
const addDays = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dowKey = (d) => { const g = new Date(`${d}T12:00:00Z`).getUTCDay(); return g === 0 ? 7 : g; };
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const endLabel = (idx) => (idx >= 48 ? '24:00' : hhmm(idx * 30));
const dateLabel = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString(loc(), { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const dowLabel = (n) => new Date(Date.UTC(2024, 0, n)).toLocaleDateString(loc(), { timeZone: 'UTC', weekday: 'short' });
const atLabel = (at) => t(at >= 1440 ? 'at.tomorrow' : 'at.today', { t: hhmm(at % 1440) });
const timeOf = (iso) => new Date(iso).toLocaleTimeString(loc(), { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

function humanAgo(min) {
  if (min < 120) return `${Math.round(min)} ${t('u.min')}`;
  const hrs = min / 60;
  return hrs < 48 ? `${Math.round(hrs)} ${t('u.h')}` : `${Math.round(hrs / 24)} ${t('u.d')}`;
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

const addrTitle = (a) => a.label || (a.street || t('addr.manual', { g: a.group }));
const addrSub = (a) => (a.street ? `${t('house')} ${a.house} · ${t('queue')} ${a.group}` : `${t('queue')} ${a.group}`);
const addrFull = (a) => a.label || (a.street ? `${a.street}, ${a.house}` : t('addr.manual', { g: a.group }));

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

function buildTimeline(g, today, n = 2) {
  return Array.from({ length: n }, (_, i) => {
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

/** Текстовий опис поточного стану */
function statusOf(timeline, nowMin) {
  const a = analyze(timeline, nowMin);
  const sName = a.next ? a.next.s : null;
  let cls = 'unknown', big = t('st.unknown'), detail = t('st.unknown.d');
  if (a.state === 'on') {
    cls = 'on'; big = t('st.on');
    detail = a.next ? t(sName === 'off' ? 'st.on.next.off' : 'st.on.next.maybe', { at: atLabel(a.next.at) }) : t('st.on.none');
  } else if (a.state === 'off') {
    cls = 'off'; big = t('st.off');
    detail = a.next ? t('st.off.next', { at: atLabel(a.next.at) }) : t('st.off.none');
  } else if (a.state === 'maybe') {
    cls = 'maybe'; big = t('st.maybe');
    detail = a.next ? t('st.maybe.next', { at: atLabel(a.next.at) }) : t('st.maybe.none');
  }
  return { a, cls, big, detail };
}

/* ---------- Сповіщення ---------- */
const hash32 = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) % 2147483000 + 1; };

/**
 * Які сповіщення потрібно запланувати: за `lead` хвилин до кожного відключення
 * (або можливого відключення) і до кожного відновлення світла, на найближчі 3 доби.
 */
function planNotifications(st, snapshot, nowTs, today) {
  const lead = st.settings.lead;
  const out = [];
  for (const a of st.addresses) {
    if (!a.notify) continue;
    const g = groupData(snapshot, a.group);
    if (!g) continue;
    const flat = [];
    buildTimeline(g, today, 3).forEach((d, di) => d.slots && d.slots.forEach((s, i) => flat.push({ s, at: di * 1440 + i * 30 })));
    for (let i = 1; i < flat.length; i++) {
      const p = flat[i - 1], c = flat[i];
      if (c.at !== p.at + 30 || p.s === 'unknown' || c.s === 'unknown' || p.s === c.s) continue;
      let kind = null;
      if (c.s === 'off') kind = 'off';
      else if (c.s === 'maybe' && p.s === 'on') kind = 'maybe';
      else if (c.s === 'on' && p.s === 'off') kind = 'on';
      if (!kind) continue;
      const ts = kyivToEpoch(today, c.at) - lead * 60000;
      if (ts <= nowTs + 5000) continue;
      out.push({ id: hash32(`${a.id}|${kind}|${ts}`), ts, kind, label: addrFull(a), time: hhmm(c.at % 1440) });
    }
  }
  return out.sort((x, y) => x.ts - y.ts);
}

const nativeLN = () => {
  try { return window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.LocalNotifications || null : null; } catch { return null; }
};
let lastPlanSig = null;
let notifyState = 'unknown'; // granted | denied | prompt | unsupported | unknown

async function notifyPermission(request) {
  const ln = nativeLN();
  if (!ln) return (notifyState = 'unsupported');
  try {
    let p = await ln.checkPermissions();
    if (p.display !== 'granted' && request) p = await ln.requestPermissions();
    notifyState = p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
  } catch { notifyState = 'unsupported'; }
  return notifyState;
}

async function syncNotifications(force = false) {
  const ln = nativeLN();
  if (!ln) return;
  const st = store.get();
  const want = st.settings.notify && st.addresses.some((a) => a.notify) && data;
  try {
    if (want && notifyState !== 'granted') await notifyPermission(false);
    const plan = want && notifyState === 'granted' ? planNotifications(st, data, Date.now(), kyivNow().date) : [];
    const sig = JSON.stringify([lang, st.settings.lead, plan.map((p) => p.id)]);
    if (!force && sig === lastPlanSig) return;
    const pending = await ln.getPending();
    if (pending?.notifications?.length) await ln.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (plan.length) {
      const m = st.settings.lead;
      await ln.schedule({
        notifications: plan.map((p) => ({
          id: p.id,
          title: t(`n.${p.kind}`, { m }),
          body: t('n.body.at', { a: p.label, t: p.time }),
          channelId: 'svitlo',
          smallIcon: 'ic_stat_svitlo',
          schedule: { at: new Date(p.ts), allowWhileIdle: true },
        })),
      });
    }
    lastPlanSig = sig;
  } catch {}
}

async function setupNotificationChannel() {
  const ln = nativeLN();
  if (!ln) return;
  try { await ln.createChannel({ id: 'svitlo', name: t('n.channel'), importance: 4, visibility: 1, vibration: true }); } catch {}
}

async function sendTestNotification() {
  const ln = nativeLN();
  if (!ln) return false;
  if ((await notifyPermission(true)) !== 'granted') return false;
  try {
    await ln.schedule({ notifications: [{ id: 1, title: t('n.test.title'), body: t('n.test.body'), channelId: 'svitlo', smallIcon: 'ic_stat_svitlo', schedule: { at: new Date(Date.now() + 4000), allowWhileIdle: true } }] });
    return true;
  } catch { return false; }
}

/* ---------- Мережа ---------- */
let cfg = { dataUrl: '/schedule.json' };
let data = null;
let fetchErr = null;
let busy = false;

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
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!j || !j.groups) throw new Error('Bad format');
    data = j; fetchErr = null;
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
    if (!r.ok) throw new Error(r.status === 404 ? t('err.map404') : `${t('err.map')} (${r.status})`);
    const j = await r.json();
    if (!j || !j.streets) throw new Error(t('err.map'));
    mapCache = j;
    return j;
  })().finally(() => { mapPromise = null; });
  return mapPromise;
}

/** Раз на добу перевіряє, чи не змінилась черга збережених адрес */
async function syncGroups() {
  const st = store.get();
  const due = st.addresses.filter((a) => a.street && Date.now() - (a.checkedAt || 0) >= 86400000);
  if (!due.length) return;
  try {
    const map = await loadMap();
    const list = store.get().addresses.map((a) => {
      if (!due.some((d) => d.id === a.id)) return a;
      const hit = resolveAddress(map, a.street, a.house);
      return hit ? { ...a, group: hit.group, checkedAt: Date.now() } : a;
    });
    store.setAddresses(list);
  } catch {}
}

async function reload() {
  await load();
  await syncNotifications();
  render(false);
}
async function refresh() {
  busy = true; render();
  await reload();
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
    h('svg', { viewBox: '0 0 120 120' }, h('circle', { class: 'track', cx: 60, cy: 60, r: 50, fill: 'none', 'stroke-width': 11 }), prog),
    h('div', { class: 'ring-c' }, h('b', {}, big), h('span', {}, unit)));
}

function hero(timeline, now, animate) {
  const { a, cls, big, detail } = statusOf(timeline, now.min);
  let progress = 1, cBig = '—', cUnit = a.state === 'unknown' ? '' : t('ring.same');
  if (a.state !== 'unknown' && a.end != null) {
    const left = Math.max(0, a.end - now.min);
    progress = Math.min(1, Math.max(0, (now.min - a.start) / (a.end - a.start)));
    if (left < 60) { cBig = String(left); cUnit = t('u.min'); } else { cBig = `${Math.floor(left / 60)}:${pad(left % 60)}`; cUnit = t('u.h'); }
  }
  return h('section', { class: `card hero ${cls}` },
    ring(progress, cBig, cUnit, animate),
    h('div', { class: 'hero-t' }, h('div', { class: 'big' }, big), h('p', {}, detail)));
}

function dayCard(day, title, nowIdx) {
  if (!day.slots) {
    return h('section', { class: 'card' }, h('div', { class: 'card-title' }, h('b', {}, title)), h('p', { class: 'muted' }, t('nopub')));
  }
  const chips = [
    ...runs(day.slots, 'off').map(([a, b]) => h('span', { class: 'chip' }, `${hhmm(a * 30)}–${endLabel(b)}`)),
    ...runs(day.slots, 'maybe').map(([a, b]) => h('span', { class: 'chip maybe' }, t('maybe.range', { r: `${hhmm(a * 30)}–${endLabel(b)}` }))),
  ];
  if (!chips.length) chips.push(h('span', { class: 'chip ok' }, t('no.outages')));
  return h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('b', {}, title), h('span', { class: 'muted small' }, day.source === 'plan' ? t('plan') : dateLabel(day.date))),
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
    h('div', { class: 'card-title' }, h('b', {}, t('week')), h('span', { class: 'muted small' }, t('week.sub'))),
    h('div', { class: 'week' }, g.week.map((w) =>
      h('div', { class: `row${w.dow === todayDow ? ' today' : ''}` }, h('b', {}, dowLabel(w.dow)),
        h('div', { class: 'bar', 'aria-hidden': 'true' }, w.slots.map((s) => h('i', { class: s })))))));
}

const sw = (on, onclick, label) => h('button', { class: 'switch', role: 'switch', type: 'button', 'aria-checked': String(!!on), 'aria-label': label, onclick }, h('i', {}));
function segmented(options, value, onpick, label) {
  return h('div', { class: 'seg', role: 'group', 'aria-label': label },
    options.map(([v, text]) => h('button', { type: 'button', class: 'seg-b', 'aria-pressed': String(v === value), onclick: () => onpick(v) }, text)));
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

function addAddress(entry) {
  const st = store.get();
  const dup = entry.street && st.addresses.find((a) => a.street === entry.street && a.house === entry.house);
  if (dup) return dup;
  const a = { id: uid(), street: '', house: '', label: '', notify: true, checkedAt: Date.now(), ...entry };
  store.setAddresses([...st.addresses, a]);
  return a;
}

/** Запасний варіант: вибір черги вручну */
function openPicker() {
  const groups = data ? Object.keys(data.groups) : [];
  const pick = (g) => { addAddress({ group: g }); closeSheets(); afterAdd(); };
  showSheet(t('manual.title'),
    h('h2', {}, t('manual.title')),
    h('p', {}, t('manual.text')),
    h('div', { class: 'grid' }, groups.map((g) => h('button', { class: 'gbtn', onclick: () => pick(g) }, g))));
}

async function afterAdd() {
  render(true);
  if (store.get().settings.notify && nativeLN()) await notifyPermission(true);
  await syncNotifications(true);
  render(false);
}

/** Додавання адреси: вулиця й будинок із підказками, черга визначається за картою міста */
function openAddress() {
  let map = null;
  let curStreet = null;
  let curHouse = null;

  const street = h('input', { class: 'field', type: 'text', placeholder: t('ph.street'), autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': t('ph.street') });
  const house = h('input', { class: 'field', type: 'text', placeholder: t('ph.house'), autocomplete: 'off', autocapitalize: 'characters', 'aria-label': t('ph.house') });
  const sugg = h('div', { class: 'sugg' });
  const msg = h('p', { class: 'msg' }, t('loading.streets'));
  const save = h('button', { class: 'btn', type: 'button' }, t('save'));
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
      if (street.value.trim() && !list.length) info = t('err.nostreet');
    } else {
      const houses = map.streets[curStreet];
      curHouse = findHouse(houses, house.value);
      if (!curHouse) {
        const list = suggestHouses(houses, house.value);
        if (list.length) sugg.append(h('div', { class: 'hchips' }, list.map((x) => h('button', { class: 'hchip', type: 'button', onclick: () => { house.value = x; update(); } }, x))));
        info = house.value.trim() && !list.length ? t('err.nohouse') : t('hint.house');
      } else {
        ok = true;
        info = t('found', { a: `${curStreet}, ${curHouse}`, g: houses[curHouse] });
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
    const dup = store.get().addresses.find((a) => a.street === curStreet && a.house === curHouse);
    if (dup) { msg.textContent = t('dup'); msg.className = 'msg err'; return; }
    addAddress({ street: curStreet, house: curHouse, group: map.streets[curStreet][curHouse] });
    closeSheets();
    afterAdd();
  });

  showSheet(t('sheet.addr.title'),
    h('h2', {}, t('sheet.addr.title')),
    h('p', {}, t('sheet.addr.text')),
    street, house, sugg, msg,
    h('div', { class: 'sheet-actions' }, save),
    h('button', { class: 'link', type: 'button', onclick: () => { closeSheets(); openPicker(); } }, t('manual.link')));

  loadMap()
    .then((m) => { map = m; msg.textContent = ''; update(); })
    .catch((err) => { msg.textContent = err.message; msg.className = 'msg err'; });
}

function openRename(a) {
  const input = h('input', { class: 'field', type: 'text', placeholder: t('rename.ph'), maxlength: 40, autocomplete: 'off', 'aria-label': t('rename') });
  input.value = a.label || '';
  const ok = h('button', { class: 'btn', type: 'button', onclick: () => {
    patchAddress(a.id, { label: input.value.trim() });
    closeSheets();
    render(false);
  } }, t('save'));
  showSheet(t('rename.title'), h('h2', {}, t('rename.title')), h('p', {}, t('rename.text')), input, h('div', { class: 'sheet-actions' }, ok));
}

function patchAddress(id, patch) {
  store.setAddresses(store.get().addresses.map((a) => (a.id === id ? { ...a, ...patch } : a)));
}
let confirmDel = null;
let confirmTimer = null;
function removeAddress(id) {
  if (confirmDel !== id) {
    confirmDel = id;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => { confirmDel = null; render(false); }, 4000);
    return render(false);
  }
  confirmDel = null;
  store.setAddresses(store.get().addresses.filter((a) => a.id !== id));
  if (view.name === 'detail') { view = { name: 'home' }; }
  syncNotifications(true);
  render(true);
}

/* ---------- Навігація ---------- */
let view = { name: 'home' };
function go(name, id) {
  view = { name, id };
  if (name !== 'home') { try { history.pushState({ name, id }, ''); } catch {} }
  window.scrollTo(0, 0);
  closeSheets();
  render(true);
}
window.addEventListener('popstate', () => { if (view.name !== 'home') { view = { name: 'home' }; closeSheets(); render(true); } });

/* ---------- Малювання ---------- */
function applyPrefs() {
  const s = store.get().settings;
  lang = I18N[s.lang] ? s.lang : 'uk';
  const root = document.documentElement;
  root.dataset.style = s.theme === 'ios' ? 'ios' : 'oneui';
  root.lang = lang;
}

function renderHeader(title, sub, { back = false, action = null } = {}) {
  $ttl.replaceChildren(...[
    back ? h('button', { class: 'icon-btn back', type: 'button', 'aria-label': t('tab.home'), onclick: () => { try { history.back(); } catch { go('home'); } } }, icon('back')) : null,
    h('span', { class: 'ttl-t' }, title)].filter(Boolean));
  $sub.textContent = sub || '';
  if (action) $act.replaceChildren(action); else $act.replaceChildren();
  const tab = view.name === 'settings' ? 'settings' : 'home';
  $tabs.replaceChildren(
    ...[['home', 'tab.home'], ['settings', 'tab.settings']].map(([k, label]) =>
      h('button', { class: 'tab', type: 'button', 'aria-current': String(k === tab), onclick: () => (k === 'home' ? (view.name === 'home' ? window.scrollTo(0, 0) : go('home')) : go('settings')) }, icon(k), h('span', {}, label))));
}

function banners() {
  const out = [];
  if (!data) return out;
  if (data.demo) out.push(h('div', { class: 'note' }, t('demo')));
  const ageMin = (Date.now() - Date.parse(data.generatedAt)) / 60000;
  if (ageMin > STALE_MIN) out.push(h('div', { class: 'note err' }, t('stale', { ago: humanAgo(ageMin) })));
  if (fetchErr) out.push(h('div', { class: 'note err' }, t('offline')));
  return out;
}

function addCard(primary) {
  return primary
    ? h('section', { class: 'card' }, h('div', { class: 'card-title' }, h('b', {}, t('empty.title'))), h('p', { class: 'muted' }, t('empty.text')), h('button', { class: 'btn', type: 'button', onclick: openAddress }, t('add')))
    : h('button', { class: 'card add-card', type: 'button', onclick: openAddress }, icon('plus'), h('span', {}, t('add')));
}

function addrCard(a, now) {
  const g = groupData(data, a.group);
  let cls = 'unknown', big = t('st.unknown'), detail = t('st.unknown.d'), bar = null;
  if (g) {
    const tl = buildTimeline(g, now.date);
    ({ cls, big, detail } = statusOf(tl, now.min));
    if (tl[0].slots) bar = h('div', { class: 'barwrap', 'aria-hidden': 'true' }, h('div', { class: 'bar thin' }, tl[0].slots.map((s) => h('i', { class: s }))), h('span', { class: 'now', style: `left:${((Math.floor(now.min / 30) + (now.min % 30) / 30) / 48) * 100}%` }));
  }
  return h('button', { class: `card acard ${cls}`, type: 'button', onclick: () => go('detail', a.id) },
    h('div', { class: 'acard-top' },
      h('div', { class: 'acard-t' }, h('b', {}, addrTitle(a)), h('span', { class: 'muted small' }, a.label && a.street ? `${a.street}, ${a.house} · ${t('queue')} ${a.group}` : addrSub(a))),
      a.notify && store.get().settings.notify ? h('span', { class: 'bell', 'aria-hidden': 'true' }, '🔔') : null,
      icon('chev')),
    h('div', { class: 'acard-st' }, h('span', { class: 'dot' }), h('b', {}, big)),
    h('div', { class: 'muted small' }, detail),
    bar);
}

function renderHome(now, animate) {
  const st = store.get();
  renderHeader(t('home.title'), dateLabel(now.date), { action: st.addresses.length ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('add'), onclick: openAddress }, icon('plus')) : null });
  const parts = banners();
  if (!data) {
    parts.push(fetchErr
      ? h('section', { class: 'card' }, h('b', {}, t('load.fail')), h('p', { class: 'muted' }, fetchErr.message), h('button', { class: 'btn', type: 'button', onclick: refresh }, t('retry')))
      : h('div', { class: 'skeleton' }));
    if (!st.addresses.length) parts.push(addCard(true));
    return parts;
  }
  if (!st.addresses.length) { parts.push(addCard(true)); return parts; }
  st.addresses.forEach((a) => parts.push(addrCard(a, now)));
  parts.push(addCard(false));
  parts.push(h('p', { class: 'foot muted small' }, t('add.hint')));
  return parts;
}

function renderDetail(now, animate) {
  const a = store.get().addresses.find((x) => x.id === view.id);
  if (!a) { view = { name: 'home' }; return renderHome(now, animate); }
  renderHeader(addrTitle(a), a.label && a.street ? `${a.street}, ${a.house} · ${t('queue')} ${a.group}` : addrSub(a), { back: true });
  const parts = banners();
  const g = groupData(data, a.group);
  if (!data) parts.push(h('div', { class: 'skeleton' }));
  else if (!g) {
    parts.push(h('section', { class: 'card' }, h('div', { class: 'card-title' }, h('b', {}, t('nogroup.title', { g: a.group }))), h('p', { class: 'muted' }, t('nogroup.text'))));
  } else {
    const timeline = buildTimeline(g, now.date);
    const nowIdx = Math.floor(now.min / 30) + (now.min % 30) / 30;
    parts.push(hero(timeline, now, animate));
    parts.push(dayCard(timeline[0], t('today'), nowIdx));
    parts.push(dayCard(timeline[1], t('tomorrow'), null));
    parts.push(h('div', { class: 'legend' }, h('span', { class: 'l-on' }, t('lg.on')), h('span', { class: 'l-off' }, t('lg.off')), h('span', { class: 'l-maybe' }, t('lg.maybe'))));
    const wk = weekCard(g, now.date);
    if (wk) parts.push(wk);
  }
  parts.push(h('div', { class: 'card list' },
    h('div', { class: 'item static' }, h('span', {}, t('notify.addr')), sw(a.notify, () => { patchAddress(a.id, { notify: !a.notify }); syncNotifications(true); render(false); }, t('notify.addr'))),
    h('button', { class: 'item', type: 'button', onclick: () => openRename(a) }, h('span', {}, t('rename')), h('span', { class: 'val' }, a.label || '—')),
    h('button', { class: 'item', type: 'button', onclick: refresh, disabled: busy }, h('span', {}, t('refresh')), h('span', { class: 'muted small' }, busy ? t('refreshing') : '')),
    h('button', { class: `item danger${confirmDel === a.id ? ' sure' : ''}`, type: 'button', onclick: () => removeAddress(a.id) }, h('span', {}, confirmDel === a.id ? t('delete.confirm') : t('delete')))));
  if (data) {
    parts.push(h('div', { class: 'foot muted small' },
      data.updated ? h('span', {}, t('updated.site', { u: data.updated })) : null,
      h('span', {}, t('collected', { t: timeOf(data.generatedAt) }))));
  }
  return parts;
}

function renderSettings(now) {
  renderHeader(t('settings.title'), t('version', { v: APP_VERSION }));
  const st = store.get();
  const s = st.settings;
  const permNote = notifyState === 'unsupported' || !nativeLN() ? t('set.perm.web') : notifyState === 'denied' ? t('set.perm.denied') : '';
  const styleTile = (key, label) => h('button', { type: 'button', class: `tile ${key}`, 'aria-pressed': String(s.theme === key), onclick: () => { store.setSettings({ theme: key }); applyPrefs(); render(false); } },
    h('div', { class: `prev ${key}` }, h('i', {}), h('i', {}), h('i', {})), h('span', {}, label));
  const parts = [];
  parts.push(h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('b', {}, t('set.lang'))),
    segmented([['uk', 'Українська'], ['en', 'English']], lang, (v) => { store.setSettings({ lang: v }); applyPrefs(); setupNotificationChannel(); syncNotifications(true); render(false); }, t('set.lang'))));
  parts.push(h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('b', {}, t('set.style'))),
    h('div', { class: 'tiles' }, styleTile('oneui', t('set.style.oneui')), styleTile('ios', t('set.style.ios')))));
  parts.push(h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('b', {}, t('set.notify')), sw(s.notify, async () => {
      const on = !s.notify;
      store.setSettings({ notify: on });
      if (on && nativeLN()) await notifyPermission(true);
      await syncNotifications(true);
      render(false);
    }, t('set.notify'))),
    h('p', { class: 'muted small' }, t('set.notify.text')),
    h('div', { class: 'row-l' }, h('span', {}, t('set.lead')), segmented(LEADS.map((m) => [m, t('set.lead.v', { m })]), s.lead, (v) => { store.setSettings({ lead: v }); syncNotifications(true); render(false); }, t('set.lead'))),
    permNote ? h('p', { class: 'msg' }, permNote) : null,
    nativeLN() ? h('button', { class: 'btn ghost', type: 'button', onclick: async (e) => { const ok = await sendTestNotification(); e.target.textContent = ok ? t('set.test.sent') : t('set.perm.denied'); } }, t('set.test')) : null));
  parts.push(h('section', { class: 'card list' },
    h('div', { class: 'card-title' }, h('b', {}, t('set.addrs'))),
    ...(st.addresses.length
      ? st.addresses.map((a) => h('div', { class: 'item static' },
        h('button', { class: 'plain', type: 'button', onclick: () => go('detail', a.id) }, h('b', {}, addrTitle(a)), h('span', { class: 'muted small' }, addrSub(a))),
        h('button', { class: `mini-btn${confirmDel === a.id ? ' sure' : ''}`, type: 'button', onclick: () => removeAddress(a.id) }, confirmDel === a.id ? t('delete.confirm') : '✕')))
      : [h('p', { class: 'muted' }, t('set.addrs.none'))]),
    h('button', { class: 'item', type: 'button', onclick: openAddress }, h('span', {}, t('add')), icon('plus'))));
  parts.push(h('section', { class: 'card list' },
    h('div', { class: 'card-title' }, h('b', {}, t('set.data'))),
    h('button', { class: 'item', type: 'button', onclick: refresh, disabled: busy }, h('span', {}, t('refresh')), h('span', { class: 'muted small' }, busy ? t('refreshing') : data?.generatedAt ? timeOf(data.generatedAt) : '')),
    h('div', { class: 'item static' }, h('span', {}, data?.city || ''), h('span', { class: 'muted small' }, data?.updated ? t('updated.site', { u: data.updated }) : ''))));
  return parts;
}

function render(animate = false) {
  const now = kyivNow();
  const parts = view.name === 'settings' ? renderSettings(now) : view.name === 'detail' ? renderDetail(now, animate) : renderHome(now, animate);
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
  migrate();
  applyPrefs();
  data = store.get().last || null;
  render(true);
  await loadConfig();
  setupNotificationChannel();
  await load();
  await syncGroups();
  await syncNotifications();
  render(false);
  setInterval(reload, REFRESH_MS);
  setInterval(() => render(false), 30 * 1000); // перерахунок «зараз» без запиту
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reload(); });
}

if (!window.Capacitor && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
