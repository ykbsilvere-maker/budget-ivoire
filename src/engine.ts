// =====================================================================
// MOTEUR DE CALCUL FINANCIER — BUDGET IVOIRE
// Logique 100 % déterministe et testée (voir engine.test.ts).
// Aucune décision financière n'est confiée à l'IA.
// =====================================================================

export type CategoryKind = 'obligatory' | 'adjustable' | 'flexible' | 'savings' | 'unexpected';
export type IncomeKind = 'income' | 'refund';

export interface Category {
  id: string;
  name: string;
  icon: string;
  kind: CategoryKind;
  budget: number;
  /** Logo importé par l'utilisateur (image réduite, data URL). */
  logo?: string;
  /** Groupe d'affichage (Logement, Vie quotidienne…). */
  group?: string;
  /** Jour du mois où la charge tombe (loyer le 5, CIE le 15…). */
  dueDay?: number;
  /** Rythme de dépense du budget mensuel, et rappels associés. */
  plan?: Plan;
  /** Pour les dépenses « ajustables » : réduction maximale autorisée (0–1). */
  maxCut?: number;
  hidden?: boolean;
}

export interface IncomeCategory {
  id: string;
  name: string;
  icon: string;
  logo?: string;
  kind: IncomeKind;
  hidden?: boolean;
}

export interface Wallet {
  id: string;
  name: string;
  icon: string;
  logo?: string;
  color?: string;
  /** Solde déclaré par l'utilisateur au moment de la création / du dernier ajustement. */
  initialBalance: number;
  /** 'declared' = saisi à la main. 'synced' réservé à une future intégration officielle. */
  source: 'declared' | 'synced';
  updatedAt: string;
  /** Argent mis de côté (épargne) : compte dans le patrimoine, pas dans l'argent disponible. */
  reserved?: boolean;
  hidden?: boolean;
}

export interface TxEdit {
  at: string;
  before: Partial<Tx>;
}

export interface Tx {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  /** Date comptable au format AAAA-MM-JJ (règle : date de l'opération, pas de la saisie). */
  date: string;
  categoryId?: string;
  walletId?: string;
  fromWalletId?: string;
  toWalletId?: string;
  note?: string;
  createdAt?: string;
  history?: TxEdit[];
}

export type PlanFreq = 'monthly' | 'weekly' | 'daily' | 'dates';
export interface Plan {
  freq: PlanFreq;
  /** Jours de la semaine (0 = dimanche … 6 = samedi) pour le rythme hebdomadaire. */
  weekdays?: number[];
  /** Dates du mois (1–31) pour le rythme « dates précises ». */
  dates?: number[];
  /** Recevoir un rappel sur le téléphone à chaque échéance. */
  remind?: boolean;
}

export interface ReminderSettings {
  /** Rappel quotidien « pense à noter tes dépenses ». */
  dailyLog: boolean;
  logTime: string; // HH:MM
  /** Rappels des échéances et des enveloppes planifiées. */
  dues: boolean;
  dueTime: string; // HH:MM
  dayBefore: boolean;
}

export interface Settings {
  reminders?: ReminderSettings;
  expectedIncome: number;
  /** % de consommation d'une enveloppe déclenchant l'orange. */
  warnPct: number;
  /** Tolérance (en points de %) entre consommation globale et temps écoulé. */
  paceMargin: number;
  presets: number[];
}

export interface Group { id: string; name: string; icon: string; color: string }

export interface Goal {
  id: string;
  name: string;
  target: number;
  /** Échéance AAAA-MM */
  deadline: string;
  image?: string;
  contributions: { date: string; amount: number; walletId?: string }[];
  createdAt: string;
}

export interface Debt {
  id: string;
  name: string;
  /** 'owe' = je dois rembourser ; 'owed' = on me doit (créance, jamais comptée comme revenu). */
  direction: 'owe' | 'owed';
  total: number;
  paid: number;
  monthly?: number;
  dueDay?: number;
}

export interface State {
  /** Date de la dernière modification locale (pour la synchronisation). */
  updatedAt?: string;
  /** Opérations supprimées, pour que la suppression se propage aux autres appareils. */
  deletedTxIds?: string[];
  groups?: Group[];
  goals?: Goal[];
  debts?: Debt[];
  categories: Category[];
  incomeCategories: IncomeCategory[];
  wallets: Wallet[];
  txs: Tx[];
  settings: Settings;
}

export type Health = 'green' | 'orange' | 'red';

export interface CategoryReport {
  id: string;
  name: string;
  icon: string;
  logo?: string;
  kind: CategoryKind;
  budget: number;
  spent: number;
  remaining: number;
  pct: number;
  projected: number;
  status: 'ok' | 'watch' | 'over';
}

export interface WalletReport {
  id: string;
  name: string;
  icon: string;
  logo?: string;
  source: Wallet['source'];
  updatedAt: string;
  reserved: boolean;
  initial: number;
  inflow: number;
  outflow: number;
  transfersIn: number;
  transfersOut: number;
  balance: number;
}

export interface MonthReport {
  month: string;
  daysInMonth: number;
  dayOfMonth: number;
  daysLeft: number;
  timePct: number;
  expectedIncome: number;
  incomeReceived: number;
  refunds: number;
  incomePending: number;
  spent: number;
  savingsPlanned: number;
  savingsDone: number;
  savingsRemaining: number;
  obligationsBudget: number;
  obligationsRemaining: number;
  flexBudget: number;
  flexSpent: number;
  flexRemaining: number;
  dailyAllowance: number;
  consumptionPct: number;
  totalCash: number;
  /** Patrimoine financier total, épargne comprise. */
  netWorth: number;
  /** Argent présent dans les portefeuilles moins obligations et épargne restant à faire. */
  resteAVivre: number;
  projectedFlexSpend: number;
  projectedEndBalance: number;
  fees: number;
  categories: CategoryReport[];
  wallets: WalletReport[];
  overspent: CategoryReport[];
  health: Health;
  healthReasons: string[];
  dailySpend: number[];
}

// ---------------------------------------------------------------------
// Utilitaires de date
// ---------------------------------------------------------------------
export const pad = (n: number) => String(n).padStart(2, '0');
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const daysIn = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
export const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

export const fmt = (n: number) => (Math.round(n) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ');
export const fmtF = (n: number) => `${fmt(n)} XOF`;
export const fmtK = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (a >= 10_000) return `${Math.round(n / 1000)} k`;
  if (a >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',').replace(',0', '')} k`;
  return fmt(n);
};

const FEES_ID = 'c_fees';

// ---------------------------------------------------------------------
// Soldes des portefeuilles (toutes dates jusqu'à `until` incluse)
// ---------------------------------------------------------------------
export function walletReports(state: State, until: string): WalletReport[] {
  return state.wallets
    .filter((w) => !w.hidden)
    .map((w) => {
      let inflow = 0, outflow = 0, tin = 0, tout = 0;
      for (const t of state.txs) {
        if (t.date > until) continue;
        if (t.type === 'income' && t.walletId === w.id) inflow += t.amount;
        else if (t.type === 'expense' && t.walletId === w.id) outflow += t.amount;
        else if (t.type === 'transfer') {
          if (t.toWalletId === w.id) tin += t.amount;
          if (t.fromWalletId === w.id) tout += t.amount;
        }
      }
      return {
        id: w.id, name: w.name, icon: w.icon, logo: w.logo, source: w.source, updatedAt: w.updatedAt, reserved: !!w.reserved,
        initial: w.initialBalance, inflow, outflow, transfersIn: tin, transfersOut: tout,
        balance: w.initialBalance + inflow - outflow + tin - tout,
      };
    });
}

// ---------------------------------------------------------------------
// Rapport mensuel
// ---------------------------------------------------------------------
export function computeMonth(state: State, month: string, today: Date): MonthReport {
  const dim = daysIn(month);
  const todayKey = monthKey(today);
  // Jour de référence : aujourd'hui pour le mois courant, dernier jour pour un mois passé, 0 pour un mois futur.
  const dayOfMonth = month === todayKey ? today.getDate() : month < todayKey ? dim : 0;
  const daysLeft = Math.max(0, dim - dayOfMonth + (month === todayKey ? 1 : 0));
  const timePct = dayOfMonth / dim;
  const { settings } = state;

  const catById = new Map(state.categories.map((c) => [c.id, c]));
  const incById = new Map(state.incomeCategories.map((c) => [c.id, c]));
  const monthTx = state.txs.filter((t) => t.date.startsWith(month));

  const spentBy = new Map<string, number>();
  const dailySpend = new Array(dim).fill(0);
  let incomeReceived = 0, refunds = 0, spent = 0, savingsDone = 0, fees = 0;

  for (const t of monthTx) {
    if (t.type === 'income') {
      const ic = t.categoryId ? incById.get(t.categoryId) : undefined;
      if (ic?.kind === 'refund') refunds += t.amount; // un remboursement n'est pas un revenu
      else incomeReceived += t.amount;
    } else if (t.type === 'expense') {
      const id = t.categoryId ?? 'unknown';
      spentBy.set(id, (spentBy.get(id) ?? 0) + t.amount);
      const c = catById.get(id);
      if (c?.kind === 'savings') savingsDone += t.amount; // l'épargne n'est pas une consommation
      else {
        spent += t.amount;
        const day = Number(t.date.slice(8, 10));
        if (c?.kind !== 'obligatory') dailySpend[day - 1] += t.amount;
      }
      if (id === FEES_ID) fees += t.amount;
    }
    // Les transferts internes ne sont ni des revenus ni des dépenses.
  }
  // Les remboursements réduisent la dépense nette sans gonfler les revenus.
  const netSpent = Math.max(0, spent - refunds);

  const elapsed = Math.max(1, dayOfMonth);
  const categories: CategoryReport[] = state.categories
    .filter((c) => !c.hidden || (spentBy.get(c.id) ?? 0) > 0)
    .map((c) => {
      const s = spentBy.get(c.id) ?? 0;
      const pace = dayOfMonth > 0 ? (s / elapsed) * dim : 0;
      const projected =
        c.kind === 'obligatory' || c.kind === 'savings' ? Math.max(s, c.budget) : dayOfMonth >= dim ? s : Math.max(s, pace);
      let status: CategoryReport['status'] = 'ok';
      const fixed = c.kind === 'obligatory' || c.kind === 'savings';
      if (s > c.budget) status = 'over';
      else if (
        !fixed &&
        c.budget > 0 &&
        ((s / c.budget) * 100 >= settings.warnPct ||
          (c.kind !== 'obligatory' && c.kind !== 'savings' && dayOfMonth >= 5 && projected > c.budget * 1.05))
      )
        status = 'watch';
      return {
        id: c.id, name: c.name, icon: c.icon, logo: c.logo, kind: c.kind, budget: c.budget, spent: s,
        remaining: c.budget - s, pct: c.budget > 0 ? Math.round((s / c.budget) * 100) : s > 0 ? 100 : 0,
        projected, status,
      };
    });

  const sum = (f: (c: CategoryReport) => boolean, v: (c: CategoryReport) => number) =>
    categories.filter(f).reduce((a, c) => a + v(c), 0);

  const isFlex = (c: CategoryReport) => c.kind === 'adjustable' || c.kind === 'flexible' || c.kind === 'unexpected';
  const obligationsBudget = sum((c) => c.kind === 'obligatory', (c) => c.budget);
  const obligationsRemaining = sum((c) => c.kind === 'obligatory', (c) => Math.max(0, c.remaining));
  const savingsPlanned = sum((c) => c.kind === 'savings', (c) => c.budget);
  const savingsRemaining = Math.max(0, savingsPlanned - savingsDone);
  const flexBudget = sum(isFlex, (c) => c.budget);
  const flexSpent = sum(isFlex, (c) => c.spent);
  const flexRemaining = flexBudget - flexSpent;
  const projectedFlexSpend = sum(isFlex, (c) => c.projected);

  const until = month === todayKey ? toISODate(today) : `${month}-${pad(dim)}`;
  const wallets = walletReports(state, until);
  const totalCash = wallets.filter((w) => !w.reserved).reduce((a, w) => a + w.balance, 0);
  const netWorth = wallets.reduce((a, w) => a + w.balance, 0);

  const incomePending = Math.max(0, settings.expectedIncome - incomeReceived);
  const resteAVivre = totalCash - obligationsRemaining - savingsRemaining;
  const projectedEndBalance =
    totalCash + incomePending - obligationsRemaining - savingsRemaining - Math.max(0, projectedFlexSpend - flexSpent);

  const base = incomeReceived > 0 ? incomeReceived : settings.expectedIncome;
  const consumptionPct = base > 0 ? Math.round((netSpent / base) * 100) : 0;
  const dailyAllowance = daysLeft > 0 ? Math.max(0, Math.min(flexRemaining, resteAVivre)) / daysLeft : 0;

  const overspent = categories.filter((c) => c.status === 'over');
  const reasons: string[] = [];
  let health: Health = 'green';
  if (resteAVivre < 0 || projectedEndBalance < 0) {
    health = 'red';
    reasons.push(resteAVivre < 0 ? 'Tes obligations dépassent l’argent disponible.' : 'Le solde prévu en fin de mois est négatif.');
  }
  if (flexRemaining < 0) {
    health = 'red';
    reasons.push('Le budget des dépenses courantes est épuisé.');
  }
  if (health !== 'red') {
    if (overspent.length) { health = 'orange'; reasons.push(`${overspent.length} enveloppe(s) dépassée(s).`); }
    const flexPct = flexBudget > 0 ? (flexSpent / flexBudget) * 100 : 0;
    if (flexPct > timePct * 100 + settings.paceMargin) {
      health = 'orange';
      reasons.push('Tu dépenses plus vite que le temps qui passe.');
    }
  }
  if (!reasons.length) reasons.push('Budget maîtrisé.');

  return {
    month, daysInMonth: dim, dayOfMonth, daysLeft, timePct,
    expectedIncome: settings.expectedIncome, incomeReceived, refunds, incomePending,
    spent: netSpent, savingsPlanned, savingsDone, savingsRemaining,
    obligationsBudget, obligationsRemaining, flexBudget, flexSpent, flexRemaining,
    dailyAllowance, consumptionPct, totalCash, netWorth, resteAVivre, projectedFlexSpend, projectedEndBalance, fees,
    categories, wallets, overspent, health, healthReasons: reasons, dailySpend,
  };
}

// ---------------------------------------------------------------------
// Assistant de rééquilibrage : protège obligations et épargne,
// puise d'abord dans les dépenses flexibles puis ajustables,
// n'invente jamais d'équilibre : affiche le déficit résiduel.
// ---------------------------------------------------------------------
export interface RebalanceProposal {
  overspend: number;
  covers: { id: string; from: number; to: number }[];
  cuts: { id: string; from: number; to: number; margin: number }[];
  covered: number;
  residualDeficit: number;
}

export function proposeRebalance(state: State, report: MonthReport): RebalanceProposal {
  const over = report.categories.filter((c) => c.spent > c.budget);
  const overspend = over.reduce((a, c) => a + (c.spent - c.budget), 0);
  const covers = over.map((c) => ({ id: c.id, from: c.budget, to: c.spent }));

  const margins = (kind: CategoryKind) =>
    report.categories
      .filter((c) => c.kind === kind && c.spent <= c.budget)
      .map((c) => {
        const cat = state.categories.find((x) => x.id === c.id)!;
        const floor = kind === 'adjustable' ? Math.max(c.spent, Math.round(c.budget * (1 - (cat.maxCut ?? 0.2)))) : c.spent;
        return { id: c.id, budget: c.budget, margin: Math.max(0, c.budget - floor) };
      })
      .filter((m) => m.margin > 0);

  let need = overspend;
  const cuts: RebalanceProposal['cuts'] = [];
  for (const kind of ['flexible', 'unexpected', 'adjustable'] as CategoryKind[]) {
    if (need <= 0) break;
    const ms = margins(kind);
    const total = ms.reduce((a, m) => a + m.margin, 0);
    if (total <= 0) continue;
    const take = Math.min(need, total);
    let taken = 0;
    ms.forEach((m, i) => {
      // Répartition proportionnelle à la marge, arrondie à 500 F ; le dernier absorbe l'arrondi.
      let cut = i === ms.length - 1 ? take - taken : Math.min(m.margin, Math.round((take * m.margin) / total / 500) * 500);
      cut = Math.max(0, Math.min(cut, m.margin));
      taken += cut;
      if (cut > 0) cuts.push({ id: m.id, from: m.budget, to: m.budget - cut, margin: m.margin });
    });
    need -= taken;
  }
  const covered = overspend - Math.max(0, need);
  return { overspend, covers, cuts, covered, residualDeficit: Math.max(0, need) };
}

/** Applique une proposition : ne modifie que les plafonds, jamais l'historique ni les obligations. */
export function applyRebalance(state: State, p: RebalanceProposal): Category[] {
  const next = new Map<string, number>();
  for (const c of p.covers) next.set(c.id, c.to);
  for (const c of p.cuts) next.set(c.id, c.to);
  return state.categories.map((c) => {
    if (!next.has(c.id)) return c;
    if (c.kind === 'obligatory' || c.kind === 'savings') {
      // Une obligation dépassée peut être relevée, jamais réduite.
      return { ...c, budget: Math.max(c.budget, next.get(c.id)!) };
    }
    return { ...c, budget: next.get(c.id)! };
  });
}

// ---------------------------------------------------------------------
// Simulateur « Et si… ? » : travaille sur une copie, jamais sur l'état réel.
// ---------------------------------------------------------------------
export type ScenarioItem =
  | { id: string; kind: 'expense'; amount: number; categoryId: string; walletId?: string; label: string }
  | { id: string; kind: 'income'; amount: number; walletId?: string; label: string }
  | { id: string; kind: 'cut'; amount: number; categoryId: string; label: string }
  | { id: string; kind: 'transfer'; amount: number; fromWalletId: string; toWalletId: string; label: string };

export function simulate(state: State, items: ScenarioItem[], month: string, today: Date): MonthReport {
  const date = month === monthKey(today) ? toISODate(today) : `${month}-01`;
  const sim: State = {
    ...state,
    categories: state.categories.map((c) => ({ ...c })),
    txs: [...state.txs],
    settings: { ...state.settings },
  };
  const firstWallet = state.wallets[0]?.id;
  for (const it of items) {
    if (it.kind === 'expense')
      sim.txs.push({ id: 'sim_' + it.id, type: 'expense', amount: it.amount, date, categoryId: it.categoryId, walletId: it.walletId ?? firstWallet });
    else if (it.kind === 'income') {
      // Revenu supplémentaire : s'ajoute au revenu prévu pour ne pas « consommer » le salaire attendu.
      sim.txs.push({ id: 'sim_' + it.id, type: 'income', amount: it.amount, date, categoryId: 'i_other', walletId: it.walletId ?? firstWallet });
      sim.settings.expectedIncome += it.amount;
    }
    else if (it.kind === 'transfer')
      sim.txs.push({ id: 'sim_' + it.id, type: 'transfer', amount: it.amount, date, fromWalletId: it.fromWalletId, toWalletId: it.toWalletId });
    else if (it.kind === 'cut') {
      const c = sim.categories.find((x) => x.id === it.categoryId);
      if (c && c.kind !== 'obligatory') c.budget = Math.max(0, c.budget - it.amount);
    }
  }
  return computeMonth(sim, month, today);
}

// ---------------------------------------------------------------------
// Aide à la saisie : catégorie suggérée et analyse d'une phrase vocale
// ---------------------------------------------------------------------
const KEYWORDS: [RegExp, string][] = [
  [/(woro|gbaka|taxi|transport|yango|uber|heetch|sotra|bus|carburant|essence|gasoil|moto)/i, 'c_transport'],
  [/(march[ée]|vivres|alimentation|supermarch|carrefour|prosuma|riz|attiéké|attieke|boutique|pain)/i, 'c_food'],
  [/(cie\b|[ée]lectricit|courant|compteur)/i, 'c_cie'],
  [/(sodeci|eau\b)/i, 'c_sodeci'],
  [/(loyer|bail)/i, 'c_rent'],
  [/(pharma|m[ée]dic|h[oô]pital|clinique|sant[ée]|docteur|ordonnance)/i, 'c_health'],
  [/(maquis|restau|allocodrome|garba|dibi|choukouya|bar\b|boisson)/i, 'c_resto'],
  [/(cr[ée]dit t[ée]l|forfait|internet|data|recharge|unit[ée]s)/i, 'c_phone'],
  [/(école|ecole|scolarit|formation|cours|fournitures)/i, 'c_school'],
  [/(famille|parents|maman|papa|soutien|tonton|tantie)/i, 'c_family'],
  [/(sortie|cin[ée]ma|loisir|match|f[eê]te|concert)/i, 'c_leisure'],
  [/(habit|v[eê]tement|pagne|chaussure|coiffure|tresse)/i, 'c_clothes'],
  [/(frais|commission)/i, FEES_ID],
  [/(tontine|[ée]pargne)/i, 'c_savings'],
  [/(d[iî]me|offrande|don\b|quête)/i, 'c_gifts'],
];

export function suggestCategory(text: string, categories: Category[]): string | undefined {
  for (const [re, id] of KEYWORDS) if (re.test(text) && categories.some((c) => c.id === id && !c.hidden)) return id;
  const lower = text.toLowerCase();
  return categories.find((c) => !c.hidden && lower.includes(c.name.toLowerCase().split(/[ (&]/)[0]))?.id;
}

const WALLET_WORDS: [RegExp, string][] = [
  [/wave/i, 'w_wave'],
  [/orange/i, 'w_om'],
  [/(mtn|momo)/i, 'w_mtn'],
  [/moov/i, 'w_moov'],
  [/(esp[eè]ces|cash|liquide)/i, 'w_cash'],
  [/(banque|carte|compte)/i, 'w_bank'],
];

const NUM_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50, cent: 100,
};

export function parseAmount(text: string): number | undefined {
  const t = text.toLowerCase().replace(/\b(xof|fcfa|francs?|cfa)\b/g, ' ').replace(/(\d)[\s  .](?=\d{3}\b)/g, '$1');
  const m = t.match(/(\d+(?:[,.]\d+)?)\s*(mille|k\b|milles)?/);
  if (m) {
    let n = parseFloat(m[1].replace(',', '.'));
    if (m[2]) n *= 1000;
    return Math.round(n);
  }
  const w = t.match(/\b(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quinze|vingt|trente|quarante|cinquante|cent)\s+(mille)\b/);
  if (w) return NUM_WORDS[w[1]] * 1000;
  if (/\bmille\b/.test(t)) return 1000;
  return undefined;
}

export function parseSentence(text: string, categories: Category[], today: Date) {
  const amount = parseAmount(text);
  const categoryId = suggestCategory(text, categories);
  const walletId = WALLET_WORDS.find(([re]) => re.test(text))?.[1];
  let date = toISODate(today);
  if (/hier/i.test(text)) date = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  const missing: string[] = [];
  if (!amount) missing.push('montant');
  if (!categoryId) missing.push('catégorie');
  if (!walletId) missing.push('moyen de paiement');
  return { amount, categoryId, walletId, date, missing };
}

/** Doublon probable : même montant, même date, même catégorie ou même note. */
export function findDuplicate(txs: Tx[], t: Pick<Tx, 'amount' | 'date' | 'categoryId' | 'note' | 'type'>) {
  return txs.find(
    (x) =>
      x.type === t.type && x.amount === t.amount && x.date === t.date &&
      (x.categoryId === t.categoryId || (!!t.note && x.note?.toLowerCase() === t.note.toLowerCase())),
  );
}

// ---------------------------------------------------------------------
// Export CSV
// ---------------------------------------------------------------------
export function toCSV(state: State) {
  const cat = (id?: string) =>
    state.categories.find((c) => c.id === id)?.name ?? state.incomeCategories.find((c) => c.id === id)?.name ?? '';
  const wal = (id?: string) => state.wallets.find((w) => w.id === id)?.name ?? '';
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [['Date', 'Type', 'Montant (XOF)', 'Catégorie', 'Portefeuille', 'Vers', 'Note'].join(';')];
  for (const t of [...state.txs].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push(
      [
        t.date,
        t.type === 'expense' ? 'Dépense' : t.type === 'income' ? 'Revenu' : 'Transfert',
        String(t.amount),
        esc(cat(t.categoryId)),
        esc(wal(t.walletId ?? t.fromWalletId)),
        esc(wal(t.toWalletId)),
        esc(t.note ?? ''),
      ].join(';'),
    );
  }
  return '﻿' + rows.join('\n');
}

// ---------------------------------------------------------------------
// Groupes, échéances, objectifs
// ---------------------------------------------------------------------
export interface GroupReport extends Group { budget: number; spent: number; cats: CategoryReport[] }

export function groupReports(state: State, r: MonthReport): GroupReport[] {
  const groups = state.groups ?? [];
  const catGroup = new Map(state.categories.map((c) => [c.id, c.group ?? 'g_other']));
  return groups
    .map((g) => {
      const cats = r.categories.filter((c) => catGroup.get(c.id) === g.id && (c.budget > 0 || c.spent > 0));
      return { ...g, cats, budget: cats.reduce((a, c) => a + c.budget, 0), spent: cats.reduce((a, c) => a + c.spent, 0) };
    })
    .filter((g) => g.cats.length > 0);
}

export interface Due { categoryId: string; name: string; icon: string; logo?: string; day: number; amount: number; paid: boolean; color: string }

/** Échéances et dépenses planifiées du mois, jour par jour (charges fixes + enveloppes à rythme). */
export function monthDues(state: State, r: MonthReport): Due[] {
  const color = new Map((state.groups ?? []).map((g) => [g.id, g.color]));
  const out: Due[] = [];
  for (const c of state.categories) {
    if (c.hidden || c.budget <= 0) continue;
    const occ = occurrences(c, r.month);
    const monthly = planOf(c)?.freq === 'monthly';
    const rep = r.categories.find((x) => x.id === c.id);
    for (const o of occ) {
      const dayKey = `${r.month}-${pad(o.day)}`;
      const spentDay = state.txs.filter((t) => t.type === 'expense' && t.categoryId === c.id && t.date === dayKey).reduce((a, t) => a + t.amount, 0);
      out.push({
        categoryId: c.id, name: c.name, icon: c.icon, logo: c.logo, amount: o.amount, day: o.day,
        paid: monthly ? (rep?.spent ?? 0) >= c.budget : spentDay >= o.amount,
        color: color.get(c.group ?? '') ?? '#A3A9B3',
      });
    }
  }
  return out.sort((a, b) => a.day - b.day);
}

export const goalSaved = (g: Goal) => g.contributions.reduce((a, c) => a + c.amount, 0);

/** Nombre de mois entre deux clés AAAA-MM (b - a). */
export const monthsBetween = (a: string, b: string) => {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
};

/** Combien mettre de côté par mois pour atteindre l'objectif à temps. */
export function goalMonthly(g: Goal, month: string) {
  const left = Math.max(0, g.target - goalSaved(g));
  const months = Math.max(1, monthsBetween(month, g.deadline) + 1);
  return Math.ceil(left / months / 500) * 500;
}

/** Trajectoire d'épargne : cumul prévu mois par mois au rythme de l'épargne planifiée. */
export function savingsTrajectory(start: number, monthly: number, fromMonth: string, months = 12) {
  return Array.from({ length: months + 1 }, (_, i) => ({ month: shiftMonth(fromMonth, i), value: start + monthly * i }));
}

// ---------------------------------------------------------------------
// Rythme des enveloppes : un budget mensuel réparti sur des jours précis
// ---------------------------------------------------------------------
export const WEEKDAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** Rythme effectif d'une catégorie (une charge avec jour d'échéance = mensuel ce jour-là). */
export function planOf(c: Category): Plan | null {
  if (c.plan) return c.plan;
  if (c.dueDay) return { freq: 'monthly', remind: c.kind === 'obligatory' };
  return null;
}

/** Jours du mois où cette enveloppe est prévue, avec le montant affecté à chacun. */
export function occurrences(c: Category, month: string): { day: number; amount: number }[] {
  const p = planOf(c);
  if (!p || c.budget <= 0) return [];
  const dim = daysIn(month);
  const [y, m] = month.split('-').map(Number);
  let days: number[] = [];
  if (p.freq === 'monthly') days = c.dueDay ? [Math.min(c.dueDay, dim)] : [];
  else if (p.freq === 'daily') days = Array.from({ length: dim }, (_, i) => i + 1);
  else if (p.freq === 'weekly') {
    const wd = p.weekdays?.length ? p.weekdays : [1];
    days = Array.from({ length: dim }, (_, i) => i + 1).filter((d) => wd.includes(new Date(y, m - 1, d).getDay()));
  } else if (p.freq === 'dates') days = [...new Set((p.dates ?? []).map((d) => Math.min(d, dim)))].sort((a, b) => a - b);
  if (!days.length) return [];
  // Répartition au franc près : le dernier jour absorbe l'arrondi.
  const base = Math.floor(c.budget / days.length / 50) * 50;
  return days.map((day, i) => ({ day, amount: i === days.length - 1 ? c.budget - base * (days.length - 1) : base }));
}

export interface PeriodView { label: string; allotted: number; spent: number; remaining: number }

/** Situation de la période en cours (jour ou semaine) pour une enveloppe à rythme quotidien / hebdomadaire. */
export function periodView(state: State, c: Category, today: Date): PeriodView | null {
  const p = planOf(c);
  if (!p || (p.freq !== 'daily' && p.freq !== 'weekly')) return null;
  const month = monthKey(today);
  const occ = occurrences(c, month);
  const d = today.getDate();
  let from = d, to = d;
  if (p.freq === 'weekly') {
    const back = (today.getDay() + 6) % 7; // lundi = début de semaine
    from = Math.max(1, d - back);
    to = Math.min(daysIn(month), d + (6 - back));
  }
  const allotted = occ.filter((o) => o.day >= from && o.day <= to).reduce((a, o) => a + o.amount, 0);
  const inRange = (t: Tx) => t.type === 'expense' && t.categoryId === c.id && t.date >= `${month}-${pad(from)}` && t.date <= `${month}-${pad(to)}`;
  const spent = state.txs.filter(inRange).reduce((a, t) => a + t.amount, 0);
  return { label: p.freq === 'daily' ? 'aujourd’hui' : 'cette semaine', allotted, spent, remaining: allotted - spent };
}

export interface Todo { categoryId: string; name: string; icon: string; logo?: string; amount: number; kind: CategoryKind; done: number }

/** Ce qui est prévu aujourd'hui (charges à payer, enveloppes du jour), avec ce qui est déjà noté. */
export function todayTodos(state: State, today: Date): Todo[] {
  const month = monthKey(today);
  const iso = toISODate(today);
  return state.categories
    .filter((c) => !c.hidden)
    .flatMap((c) => {
      const o = occurrences(c, month).find((x) => x.day === today.getDate());
      if (!o) return [];
      const done = state.txs.filter((t) => t.type === 'expense' && t.categoryId === c.id && t.date === iso).reduce((a, t) => a + t.amount, 0);
      return [{ categoryId: c.id, name: c.name, icon: c.icon, logo: c.logo, amount: o.amount, kind: c.kind, done }];
    });
}
