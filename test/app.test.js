import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, flat } from './_env.js';

const slots = (off) => Array.from({ length: 48 }, (_, i) => (off.some(([a, b]) => i >= a && i < b) ? '0' : '1')).join('');
const snapshot = (date, off) => ({
  version: 1, generatedAt: new Date().toISOString(), city: 'м. Тест', groups: { '1.1': { days: [{ date, slots: slots(off) }, { date: '2099-01-02', slots: slots([]) }], week: [] } },
});

test('kyivToEpoch: літній і зимовий час', () => {
  const { run } = makeEnv();
  // 2026-07-01 12:00 Київ (UTC+3) = 09:00 UTC; 2026-01-15 12:00 (UTC+2) = 10:00 UTC
  assert.equal(run("kyivToEpoch('2026-07-01', 720)"), Date.UTC(2026, 6, 1, 9, 0));
  assert.equal(run("kyivToEpoch('2026-01-15', 720)"), Date.UTC(2026, 0, 15, 10, 0));
  assert.equal(run("kyivToEpoch('2026-01-15', 1440+30)"), Date.UTC(2026, 0, 15, 22, 30));
});

test('planNotifications: за 30 хв до відключення і до включення, минуле пропускається', () => {
  const { run, ctx } = makeEnv();
  const today = '2026-01-15';
  ctx.snap = snapshot(today, [[10, 14]]); // 05:00–07:00 вимкнено
  ctx.st = { settings: { lead: 30 }, addresses: [{ id: 'a', group: '1.1', notify: true, street: 'Тест', house: '1', label: '' }] };
  ctx.snap.groups['1.1'].days[1].date = '2026-01-16';
  const nowTs = Date.UTC(2026, 0, 15, 0, 0); // 02:00 за Києвом
  ctx.now = nowTs;
  const plan = run("planNotifications(st, snap, now, '2026-01-15')");
  assert.equal(plan.map((p) => p.kind).join(), 'off,on');
  assert.equal(plan[0].ts, Date.UTC(2026, 0, 15, 2, 30)); // 04:30 Київ
  assert.equal(plan[1].ts, Date.UTC(2026, 0, 15, 4, 30)); // 06:30 Київ
  assert.equal(plan[0].time, '05:00');
  // після 04:40 перше сповіщення вже в минулому
  ctx.now = Date.UTC(2026, 0, 15, 2, 40);
  assert.equal(run("planNotifications(st, snap, now, '2026-01-15')").map((p) => p.kind).join(), 'on');
  // вимкнені сповіщення адреси
  ctx.st.addresses[0].notify = false;
  assert.equal(run("planNotifications(st, snap, now, '2026-01-15')").length, 0);
});

test('migrate: одна адреса зі старої версії переноситься', () => {
  const old = JSON.stringify({ address: { street: 'Тест', house: '5' }, group: '2.1', groupCheckedAt: 5 });
  const { run, ls } = makeEnv({ store: { 'svitlo.v3': old } });
  run('migrate()');
  const st = JSON.parse(ls.get('svitlo.v4'));
  assert.equal(st.addresses.length, 1);
  assert.equal(st.addresses[0].group, '2.1');
  assert.equal(st.addresses[0].notify, true);
});

test('екрани: головна, деталі, налаштування, мова й стиль', async () => {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kiev' });
  const snap = snapshot(today, [[0, 6]]);
  const st = { addresses: [{ id: 'a1', street: 'Чорних Запорожців', house: '18', group: '1.1', notify: true, label: '' }, { id: 'a2', street: '', house: '', group: '1.1', notify: false, label: 'Дім' }], last: snap };
  const { run, ctx, reg, doc } = makeEnv({ store: { 'svitlo.v4': JSON.stringify(st) } });
  await new Promise((r) => setTimeout(r, 50));
  run("data = store.get().last; applyPrefs(); render(false)");
  assert.match(flat(reg.ttl), /Мої адреси/);
  assert.equal(reg.app.children.filter((c) => /acard/.test(c.attrs.class || '')).length, 2);
  assert.match(flat(reg.app), /Чорних Запорожців/);
  assert.match(flat(reg.app), /Дім/);
  run("go('detail','a1')");
  assert.match(flat(reg.ttl), /Чорних Запорожців/);
  assert.match(flat(reg.app), /Сьогодні/);
  run("go('settings')");
  assert.match(flat(reg.app), /Українська/);
  run("store.setSettings({ lang: 'en', theme: 'ios' }); applyPrefs(); render(false)");
  assert.equal(doc.documentElement.dataset.style, 'ios');
  assert.match(flat(reg.ttl), /Settings/);
  run("go('home')");
  assert.match(flat(reg.ttl), /My addresses/);
});

test('сповіщення: планування через плагін і скасування старих', async () => {
  const calls = [];
  const native = {
    checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }),
    getPending: async () => ({ notifications: [{ id: 7 }] }), cancel: async (a) => calls.push(['cancel', a]),
    schedule: async (a) => calls.push(['schedule', a]), createChannel: async () => {},
  };
  const nowDate = new Date();
  const date = nowDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Kiev' });
  // відключення завтра 12:00–14:00, щоб воно точно було в майбутньому
  const tomorrow = new Date(nowDate.getTime() + 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Kiev' });
  const snap = { generatedAt: nowDate.toISOString(), groups: { '1.1': { days: [{ date, slots: slots([]) }, { date: tomorrow, slots: slots([[24, 28]]) }], week: [] } } };
  const st = { addresses: [{ id: 'a', street: 'Т', house: '1', group: '1.1', notify: true }], last: snap };
  const { run, ctx } = makeEnv({ store: { 'svitlo.v4': JSON.stringify(st) }, native });
  ctx.snapNow = snap;
  await run('data = snapNow; syncNotifications(true)');
  assert.equal(calls[0][0], 'cancel');
  const sched = calls.find((c) => c[0] === 'schedule')[1].notifications;
  assert.equal(sched.length, 2);
  assert.match(sched[0].title, /Відключення світла через 30 хв/);
  assert.match(sched[1].title, /Світло з’явиться через 30 хв/);
});
