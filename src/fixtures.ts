// Données fictives utilisées UNIQUEMENT par les tests automatiques (jamais dans l'application).
import type { State, Tx } from './engine';
import { monthKey, pad } from './engine';
import { initialState } from './data';

const now = () => new Date().toISOString();

/** Jeu de démonstration ivoirien — fictif, toujours marqué `demo: true`. */
export function demoTransactions(today: Date): Tx[] {
  const m = monthKey(today);
  const lastDay = today.getDate();
  const d = (day: number) => `${m}-${pad(day)}`;
  const list: Omit<Tx, 'id' | 'date'>[] & { day?: number }[] = [];
  const add = (day: number, t: Omit<Tx, 'id' | 'date'>) => (list as any).push({ ...t, day });

  add(1, { type: 'income', amount: 750000, categoryId: 'i_salary', walletId: 'w_bank', note: 'Salaire du mois' });
  add(1, { type: 'expense', amount: 50000, categoryId: 'c_savings', walletId: 'w_bank', note: 'Tontine du quartier' });
  add(1, { type: 'expense', amount: 10000, categoryId: 'c_phone', walletId: 'w_om', note: 'Forfait internet mensuel' });
  add(2, { type: 'expense', amount: 150000, categoryId: 'c_rent', walletId: 'w_bank', note: 'Loyer Cocody' });
  add(3, { type: 'transfer', amount: 70000, fromWalletId: 'w_bank', toWalletId: 'w_cash', note: 'Retrait GAB' });
  add(3, { type: 'transfer', amount: 120000, fromWalletId: 'w_bank', toWalletId: 'w_wave', note: 'Banque → Wave' });
  add(3, { type: 'transfer', amount: 50000, fromWalletId: 'w_bank', toWalletId: 'w_om', note: 'Banque → Orange Money' });
  add(4, { type: 'expense', amount: 18000, categoryId: 'c_food', walletId: 'w_cash', note: 'Marché Gouro' });
  add(5, { type: 'expense', amount: 24500, categoryId: 'c_cie', walletId: 'w_wave', note: 'Facture CIE' });
  add(5, { type: 'expense', amount: 5000, categoryId: 'c_gifts', walletId: 'w_cash', note: 'Offrande' });
  add(7, { type: 'expense', amount: 6000, categoryId: 'c_resto', walletId: 'w_cash', note: 'Garba + jus' });
  add(8, { type: 'expense', amount: 8200, categoryId: 'c_sodeci', walletId: 'w_om', note: 'Facture SODECI' });
  add(9, { type: 'expense', amount: 6000, categoryId: 'c_transport', walletId: 'w_cash', note: 'Taxi compteur Plateau' });
  add(10, { type: 'expense', amount: 50000, categoryId: 'c_school', walletId: 'w_wave', note: 'Frais de scolarité' });
  add(11, { type: 'expense', amount: 22000, categoryId: 'c_food', walletId: 'w_wave', note: 'Supermarché' });
  add(12, { type: 'expense', amount: 25000, categoryId: 'c_family', walletId: 'w_wave', note: 'Soutien maman' });
  add(12, { type: 'expense', amount: 250, categoryId: 'c_fees', walletId: 'w_wave', note: 'Frais d’envoi Wave' });
  add(12, { type: 'expense', amount: 5000, categoryId: 'c_gifts', walletId: 'w_cash', note: 'Dîme' });
  add(13, { type: 'expense', amount: 6000, categoryId: 'c_home', walletId: 'w_cash', note: 'Produits d’entretien' });
  add(14, { type: 'expense', amount: 7500, categoryId: 'c_health', walletId: 'w_cash', note: 'Pharmacie' });
  add(14, { type: 'transfer', amount: 70000, fromWalletId: 'w_bank', toWalletId: 'w_cash', note: 'Retrait GAB' });
  add(18, { type: 'transfer', amount: 25000, fromWalletId: 'w_bank', toWalletId: 'w_wave', note: 'Banque → Wave' });
  add(15, { type: 'expense', amount: 12000, categoryId: 'c_resto', walletId: 'w_om', note: 'Allocodrome entre amis' });
  add(16, { type: 'expense', amount: 8000, categoryId: 'c_leisure', walletId: 'w_wave', note: 'Cinéma' });
  add(17, { type: 'expense', amount: 8000, categoryId: 'c_transport', walletId: 'w_wave', note: 'Carburant moto' });
  add(18, { type: 'expense', amount: 20000, categoryId: 'c_food', walletId: 'w_cash', note: 'Marché d’Adjamé' });
  add(19, { type: 'expense', amount: 12000, categoryId: 'c_clothes', walletId: 'w_om', note: 'Pagne' });
  add(19, { type: 'expense', amount: 5000, categoryId: 'c_gifts', walletId: 'w_cash', note: 'Offrande' });
  add(20, { type: 'expense', amount: 3000, categoryId: 'c_phone', walletId: 'w_om', note: 'Recharge crédit' });
  add(20, { type: 'income', amount: 35000, categoryId: 'i_business', walletId: 'w_wave', note: 'Vente de pagnes' });
  add(21, { type: 'expense', amount: 5000, categoryId: 'c_resto', walletId: 'w_cash', note: 'Maquis' });
  add(22, { type: 'expense', amount: 15000, categoryId: 'c_unexpected', walletId: 'w_wave', note: 'Réparation téléphone' });
  add(23, { type: 'income', amount: 5000, categoryId: 'i_refund', walletId: 'w_cash', note: 'Remboursement collègue' });
  add(24, { type: 'expense', amount: 5000, categoryId: 'c_transport', walletId: 'w_cash', note: 'Taxi nuit' });
  add(25, { type: 'expense', amount: 19000, categoryId: 'c_food', walletId: 'w_wave', note: 'Marché Cocody' });
  add(26, { type: 'expense', amount: 3200, categoryId: 'c_health', walletId: 'w_cash', note: 'Pharmacie' });
  add(26, { type: 'expense', amount: 5000, categoryId: 'c_gifts', walletId: 'w_cash', note: 'Offrande' });
  add(27, { type: 'expense', amount: 3500, categoryId: 'c_transport', walletId: 'w_om', note: 'VTC Yango' });
  add(28, { type: 'expense', amount: 3500, categoryId: 'c_resto', walletId: 'w_cash', note: 'Garba' });
  add(28, { type: 'expense', amount: 4500, categoryId: 'c_food', walletId: 'w_cash', note: 'Pain & lait' });

  // Trajets quotidiens en woro-woro / gbaka les jours ouvrés
  for (let day = 1; day <= lastDay; day++) {
    const wd = new Date(today.getFullYear(), today.getMonth(), day).getDay();
    if (wd !== 0 && wd !== 6) add(day, { type: 'expense', amount: 2000, categoryId: 'c_transport', walletId: 'w_cash', note: day % 2 ? 'Woro-woro' : 'Gbaka' });
  }

  return (list as any[])
    .filter((t) => t.day <= lastDay)
    .map(({ day, ...t }, i) => ({ ...t, id: `demo_${i}`, date: d(day), createdAt: now() }));
}


export function demoState(today: Date): State {
  const s = initialState();
  s.settings.expectedIncome = 750000;
  const B: Record<string, number> = {
    c_rent: 150000, c_cie: 25000, c_sodeci: 10000, c_school: 50000, c_food: 100000, c_transport: 60000, c_phone: 15000,
    c_health: 20000, c_family: 40000, c_gifts: 20000, c_home: 10000, c_fees: 5000, c_resto: 30000, c_leisure: 20000,
    c_clothes: 15000, c_unexpected: 20000, c_savings: 50000,
  };
  s.categories = s.categories.map((c) => ({ ...c, budget: B[c.id] ?? 0 }));
  s.goals = [{ id: 'goal1', name: 'Voyage à Assinie', target: 350000, deadline: '2027-06', createdAt: now(), contributions: [{ date: `${monthKey(today)}-02`, amount: 126000 }] }];
  s.debts = [{ id: 'd1', name: 'Prêt moto', direction: 'owe', total: 400000, paid: 150000, monthly: 25000, dueDay: 28 }];
  const init: Record<string, number> = { w_cash: 8000, w_wave: 12000, w_om: 5000, w_mtn: 3000, w_bank: 35000, w_savings: 100000 };
  s.wallets = s.wallets.map((w) => ({ ...w, initialBalance: init[w.id] ?? 0 }));
  s.txs = demoTransactions(today);
  return s;
}
