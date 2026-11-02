import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeStates } from './sync';
import { initialState } from './data';

const tx = (id: string, extra = {}) => ({ id, type: 'expense' as const, amount: 1000, date: '2026-11-01', categoryId: 'c_food', walletId: 'w_cash', createdAt: '2026-11-01T08:00:00Z', ...extra });

test('fusion : les opérations des deux téléphones sont conservées', () => {
  const a = { ...initialState(), txs: [tx('a'), tx('c')], updatedAt: '2026-11-01T10:00:00Z' };
  const b = { ...initialState(), txs: [tx('b'), tx('c')], updatedAt: '2026-11-01T09:00:00Z' };
  const m = mergeStates(a, b);
  assert.deepEqual(m.txs.map((t) => t.id).sort(), ['a', 'b', 'c']);
});

test('fusion : une suppression se propage', () => {
  const a = { ...initialState(), txs: [tx('a')], deletedTxIds: ['b'] };
  const b = { ...initialState(), txs: [tx('a'), tx('b')] };
  assert.deepEqual(mergeStates(a, b).txs.map((t) => t.id), ['a']);
});

test('fusion : la modification la plus récente l’emporte', () => {
  const a = { ...initialState(), txs: [tx('a', { amount: 5000, history: [{ at: '2026-11-02T08:00:00Z', before: { amount: 1000 } }] })] };
  const b = { ...initialState(), txs: [tx('a')] };
  assert.equal(mergeStates(a, b).txs[0].amount, 5000);
  assert.equal(mergeStates(b, a).txs[0].amount, 5000);
});

test('fusion : réglages du côté le plus récent', () => {
  const a = { ...initialState(), updatedAt: '2026-11-02T00:00:00Z' };
  a.settings = { ...a.settings, expectedIncome: 400000 };
  const b = { ...initialState(), updatedAt: '2026-11-01T00:00:00Z' };
  b.settings = { ...b.settings, expectedIncome: 300000 };
  assert.equal(mergeStates(a, b).settings.expectedIncome, 400000);
  assert.equal(mergeStates(b, a).settings.expectedIncome, 400000);
});
