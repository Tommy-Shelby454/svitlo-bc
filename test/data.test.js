import test from 'node:test';
import assert from 'node:assert/strict';
import { expandDay } from '../server/dtek.js';
import { snapshotFromRaw } from '../server/snapshot.js';

const hoursOf = (map, fill = 'yes') => {
  const h = {};
  for (let i = 1; i <= 24; i++) h[i] = map[i] ?? fill;
  return h;
};

test('expandDay: усі статуси дають 48 слотів у правильному порядку', () => {
  const slots = expandDay(hoursOf({ 1: 'no', 2: 'first', 3: 'second', 4: 'maybe', 5: 'mfirst', 6: 'msecond' }));
  assert.equal(slots.length, 48);
  assert.deepEqual(slots.slice(0, 12), ['off', 'off', 'off', 'on', 'on', 'off', 'maybe', 'maybe', 'maybe', 'on', 'on', 'maybe']);
});

test('expandDay: невідомий статус не ламає розбір', () => {
  const slots = expandDay({ 1: 'щось нове' });
  assert.equal(slots.length, 48);
  assert.equal(slots[0], 'unknown');
});

const raw = {
  result: true,
  fact: {
    update: '30.10.2026 18:05',
    data: {
      1793311200: { 'GPV1.1': hoursOf({ 5: 'no' }), 'GPV1.2': hoursOf({}), 'GPV10.1': hoursOf({}) },
      1793397600: { 'GPV1.1': hoursOf({ 7: 'first' }) },
    },
  },
  preset: { data: { 'GPV1.1': { 1: hoursOf({ 2: 'no' }), 7: hoursOf({}) } } },
};

test('snapshotFromRaw: збирає всі черги, дні та тижневий план', () => {
  const snap = snapshotFromRaw(raw, { city: 'м. Біла Церква', now: new Date('2026-10-30T18:10:00Z') });
  assert.deepEqual(Object.keys(snap.groups), ['1.1', '1.2', '10.1']); // натуральне сортування
  assert.equal(snap.updated, '30.10.2026 18:05');
  assert.equal(snap.generatedAt, '2026-10-30T18:10:00.000Z');
  const g = snap.groups['1.1'];
  assert.equal(g.days.length, 2);
  assert.match(g.days[0].date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(g.days[0].slots.length, 48);
  assert.equal(g.days[0].slots.slice(8, 10), '00'); // година 5 = 04:00–05:00
  assert.equal(g.days[1].slots.slice(12, 14), '01'); // година 7 "first": перші 30 хв без світла
  assert.deepEqual(g.week.map((w) => w.dow), [1, 7]);
  assert.equal(snap.groups['1.2'].week.length, 0);
});

test('snapshotFromRaw: порожня відповідь не падає', () => {
  const snap = snapshotFromRaw({});
  assert.deepEqual(snap.groups, {});
});

import { housesFromRaw } from '../server/addresses.js';
test('housesFromRaw: будинок → черга', () => {
  const m = housesFromRaw({ data: { '18': { sub_type_reason: ['GPV1.1'] }, '5А': { sub_type_reason: ['GPV3.2'] }, '7': {} } });
  assert.deepEqual(m, { '18': '1.1', '5А': '3.2' });
});
