import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMonth, proposeRebalance, applyRebalance, simulate, parseSentence, parseAmount, findDuplicate, shiftMonth,
  type State, type Tx,
} from './engine';
import { initialState } from './data';
import { demoState } from './fixtures';

const TODAY = new Date(2026, 9, 15); // 15 octobre 2026
const M = '2026-10';

const OLD_BUDGETS: Record<string, number> = {
  c_rent: 150000, c_cie: 25000, c_sodeci: 10000, c_school: 50000, c_food: 100000, c_transport: 60000, c_phone: 15000,
  c_health: 20000, c_family: 40000, c_gifts: 20000, c_home: 10000, c_fees: 5000, c_resto: 30000, c_leisure: 20000,
  c_clothes: 15000, c_unexpected: 20000, c_savings: 50000,
};
function blank(): State {
  const s = initialState();
  s.categories = s.categories.map((c) => ({ ...c, budget: OLD_BUDGETS[c.id] ?? 0 }));
  s.settings.expectedIncome = 500000;
  return s;
}
let n = 0;
const tx = (t: Partial<Tx>): Tx => ({ id: 't' + n++, type: 'expense', amount: 0, date: '2026-10-10', ...t });

test('revenu absent : aucun crash, consommation basée sur le revenu prévu', () => {
  const s = blank();
  s.txs.push(tx({ amount: 50000, categoryId: 'c_food', walletId: 'w_cash' }));
  const r = computeMonth(s, M, TODAY);
  assert.equal(r.incomeReceived, 0);
  assert.equal(r.consumptionPct, 10);
  assert.equal(r.totalCash, -50000);
  assert.equal(r.health, 'red'); // solde négatif
});

test('transfert interne : ni dépense, ni revenu, patrimoine inchangé', () => {
  const s = blank();
  s.txs.push(tx({ type: 'income', amount: 100000, categoryId: 'i_salary', walletId: 'w_bank' }));
  const before = computeMonth(s, M, TODAY);
  s.txs.push(tx({ type: 'transfer', amount: 20000, fromWalletId: 'w_bank', toWalletId: 'w_cash' }));
  const r = computeMonth(s, M, TODAY);
  assert.equal(r.spent, 0);
  assert.equal(r.incomeReceived, 100000);
  assert.equal(r.totalCash, before.totalCash);
  assert.equal(r.wallets.find((w) => w.id === 'w_cash')!.balance, 20000);
  assert.equal(r.wallets.find((w) => w.id === 'w_bank')!.balance, 80000);
});

test('remboursement : ne compte pas comme revenu, réduit la dépense nette', () => {
  const s = blank();
  s.txs.push(tx({ type: 'income', amount: 500000, categoryId: 'i_salary', walletId: 'w_bank' }));
  s.txs.push(tx({ amount: 10000, categoryId: 'c_resto', walletId: 'w_bank' }));
  s.txs.push(tx({ type: 'income', amount: 4000, categoryId: 'i_refund', walletId: 'w_bank' }));
  const r = computeMonth(s, M, TODAY);
  assert.equal(r.incomeReceived, 500000);
  assert.equal(r.refunds, 4000);
  assert.equal(r.spent, 6000);
});

test('épargne : comptée à part, pas comme consommation', () => {
  const s = blank();
  s.txs.push(tx({ type: 'income', amount: 500000, categoryId: 'i_salary', walletId: 'w_bank' }));
  s.txs.push(tx({ amount: 30000, categoryId: 'c_savings', walletId: 'w_bank' }));
  const r = computeMonth(s, M, TODAY);
  assert.equal(r.spent, 0);
  assert.equal(r.savingsDone, 30000);
  assert.equal(r.savingsRemaining, 20000);
});

test('reste à vivre = argent disponible − obligations restantes − épargne restante', () => {
  const s = blank();
  s.txs.push(tx({ type: 'income', amount: 500000, categoryId: 'i_salary', walletId: 'w_bank' }));
  s.txs.push(tx({ amount: 150000, categoryId: 'c_rent', walletId: 'w_bank' }));
  const r = computeMonth(s, M, TODAY);
  // obligations restantes : CIE 25k + SODECI 10k + scolarité 50k = 85k ; épargne 50k
  assert.equal(r.obligationsRemaining, 85000);
  assert.equal(r.totalCash, 350000);
  assert.equal(r.resteAVivre, 350000 - 85000 - 50000);
});

test('dépassement : rééquilibrage protège obligations et épargne', () => {
  const s = blank();
  s.txs.push(tx({ type: 'income', amount: 500000, categoryId: 'i_salary', walletId: 'w_bank' }));
  s.txs.push(tx({ amount: 70000, categoryId: 'c_transport', walletId: 'w_bank' })); // +10k
  const r = computeMonth(s, M, TODAY);
  assert.equal(r.overspent.length, 1);
  const p = proposeRebalance(s, r);
  assert.equal(p.overspend, 10000);
  assert.equal(p.covered, 10000);
  assert.equal(p.residualDeficit, 0);
  const touched = p.cuts.map((c) => s.categories.find((x) => x.id === c.id)!.kind);
  assert.ok(touched.every((k) => k === 'flexible'), 'flexibles réduits en premier');
  const cats = applyRebalance(s, p);
  for (const c of cats.filter((c) => c.kind === 'obligatory' || c.kind === 'savings'))
    assert.equal(c.budget, s.categories.find((x) => x.id === c.id)!.budget);
  assert.equal(cats.find((c) => c.id === 'c_transport')!.budget, 70000);
  // l'historique n'est jamais réécrit
  assert.equal(s.txs.length, 2);
});

test('dépassement trop grand : déficit résiduel affiché, pas d’équilibre artificiel', () => {
  const s = blank();
  s.txs.push(tx({ amount: 400000, categoryId: 'c_food', walletId: 'w_bank' }));
  const r = computeMonth(s, M, TODAY);
  const p = proposeRebalance(s, r);
  assert.ok(p.residualDeficit > 0);
  assert.equal(p.covered + p.residualDeficit, p.overspend);
});

test('simulation : ne modifie jamais l’état réel', () => {
  const s = blank();
  s.txs.push(tx({ type: 'income', amount: 500000, categoryId: 'i_salary', walletId: 'w_bank' }));
  const snapshot = JSON.stringify(s);
  const base = computeMonth(s, M, TODAY);
  const sim = simulate(s, [
    { id: 'a', kind: 'expense', amount: 40000, categoryId: 'c_unexpected', label: 'Facture imprévue' },
    { id: 'b', kind: 'income', amount: 100000, label: 'Prime' },
  ], M, TODAY);
  assert.equal(JSON.stringify(s), snapshot);
  assert.equal(sim.totalCash, base.totalCash + 60000);
  assert.equal(sim.projectedEndBalance > base.projectedEndBalance - 40000, true);
});

test('changement de mois : opérations isolées par mois, soldes cumulés', () => {
  const s = blank();
  s.txs.push(tx({ type: 'income', amount: 100000, categoryId: 'i_salary', walletId: 'w_bank', date: '2026-09-28' }));
  s.txs.push(tx({ amount: 10000, categoryId: 'c_food', walletId: 'w_bank', date: '2026-10-02' }));
  const oct = computeMonth(s, M, TODAY);
  const sep = computeMonth(s, shiftMonth(M, -1), TODAY);
  assert.equal(oct.incomeReceived, 0);
  assert.equal(sep.incomeReceived, 100000);
  assert.equal(oct.totalCash, 90000);
  assert.equal(sep.totalCash, 100000);
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});

test('saisie vocale : extraction du montant, catégorie et moyen de paiement', () => {
  const s = blank();
  const p = parseSentence("J'ai dépensé 2 500 francs pour le woro-woro avec Wave", s.categories, TODAY);
  assert.equal(p.amount, 2500);
  assert.equal(p.categoryId, 'c_transport');
  assert.equal(p.walletId, 'w_wave');
  assert.equal(parseAmount('cinq mille pour le garba'), 5000);
  assert.equal(parseAmount('15 000 F au marché'), 15000);
  assert.deepEqual(parseSentence('payé la facture CIE', s.categories, TODAY).missing, ['montant', 'moyen de paiement']);
});

test('doublon détecté', () => {
  const t = tx({ amount: 3500, categoryId: 'c_health', date: '2026-10-12' });
  assert.ok(findDuplicate([t], { type: 'expense', amount: 3500, date: '2026-10-12', categoryId: 'c_health' }));
  assert.equal(findDuplicate([t], { type: 'expense', amount: 3500, date: '2026-10-13', categoryId: 'c_health' }), undefined);
});

test('nouvel utilisateur : aucune opération, aucune donnée fictive', () => {
  const s = initialState();
  assert.equal(s.txs.length, 0);
  assert.ok(s.wallets.every((w) => w.initialBalance === 0));
});

test('scénario réaliste d’un mois complet', () => {
  const s = demoState(new Date(2026, 9, 29));
  const r = computeMonth(s, M, new Date(2026, 9, 29));
  assert.ok(r.overspent.some((c) => c.id === 'c_transport'), 'démo : transport dépassé');
  assert.ok(r.resteAVivre > 0);
});

test('groupes, échéances et objectifs', async () => {
  const { groupReports, monthDues, goalMonthly, goalSaved, savingsTrajectory } = await import('./engine');
  const s = blank();
  s.categories = s.categories.map((c) => ({ ...c, budget: c.id === 'c_rent' ? 60000 : c.id === 'c_food' ? 40000 : 0 }));
  s.txs.push(tx({ amount: 60000, categoryId: 'c_rent', walletId: 'w_bank', date: '2026-10-05' }));
  s.txs.push(tx({ amount: 5000, categoryId: 'c_food', walletId: 'w_cash' }));
  const r = computeMonth(s, M, TODAY);
  const g = groupReports(s, r);
  assert.equal(g.find((x) => x.id === 'g_home')!.spent, 60000);
  assert.equal(g.find((x) => x.id === 'g_daily')!.budget, 40000);
  const d = monthDues(s, r);
  assert.equal(d.length, 1);
  assert.equal(d[0].day, 5);
  assert.equal(d[0].paid, true);
  const goal = { id: 'g', name: 'Voyage', target: 120000, deadline: '2027-03', contributions: [{ date: '2026-10-01', amount: 20000 }], createdAt: '' };
  assert.equal(goalSaved(goal), 20000);
  assert.equal(goalMonthly(goal, '2026-10'), 17000); // 100 000 F restants sur 6 mois, arrondi aux 500 F
  assert.equal(savingsTrajectory(10000, 5000, '2026-10', 2).at(-1)!.value, 20000);
});

test('rythme : budget mensuel réparti par semaine, par jour ou à dates précises', async () => {
  const { occurrences, periodView, todayTodos } = await import('./engine');
  const base = blank().categories.find((c) => c.id === 'c_transport')!;
  // Novembre 2026 : lundis = 2, 9, 16, 23, 30 ; mercredis = 4, 11, 18, 25
  const weekly = { ...base, budget: 100000, plan: { freq: 'weekly' as const, weekdays: [1, 3] } };
  const occ = occurrences(weekly, '2026-11');
  assert.deepEqual(occ.map((o) => o.day), [2, 4, 9, 11, 16, 18, 23, 25, 30]);
  assert.equal(occ.reduce((a, o) => a + o.amount, 0), 100000);
  const daily = occurrences({ ...base, budget: 30000, plan: { freq: 'daily' } }, '2026-11');
  assert.equal(daily.length, 30);
  assert.equal(daily.reduce((a, o) => a + o.amount, 0), 30000);
  const dates = occurrences({ ...base, budget: 60000, plan: { freq: 'dates', dates: [5, 20, 31] } }, '2026-11');
  assert.deepEqual(dates.map((o) => [o.day, o.amount]), [[5, 20000], [20, 20000], [30, 20000]]);
  // Semaine en cours (mercredi 11 novembre : semaine du lundi 9 au dimanche 15)
  const s = blank();
  s.categories = s.categories.map((c) => (c.id === 'c_transport' ? weekly : c));
  s.txs.push(tx({ amount: 7000, categoryId: 'c_transport', walletId: 'w_cash', date: '2026-11-10' }));
  s.txs.push(tx({ amount: 9000, categoryId: 'c_transport', walletId: 'w_cash', date: '2026-11-03' })); // semaine précédente
  const pv = periodView(s, weekly, new Date(2026, 10, 11))!;
  assert.equal(pv.allotted, occ.filter((o) => o.day >= 9 && o.day <= 15).reduce((a, o) => a + o.amount, 0));
  assert.equal(pv.spent, 7000);
  const todo = todayTodos(s, new Date(2026, 10, 11));
  assert.ok(todo.some((t) => t.categoryId === 'c_transport'));
});
