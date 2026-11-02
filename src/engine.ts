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
  /** Compte d'où vient l'argent de l'enveloppe (approvisionnement, paiement par défaut). */
  sourceWalletId?: string;
  /** Mois concernés (1–12). Vide = tous les mois. */
  months?: number[];
  /** Budget différent pour certains mois (« AAAA-MM » → montant). */
  budgets?: Record<string, number>;
}

/** Approvisionnement d'une enveloppe depuis un compte : l'argent reste sur le compte, réservé à l'enveloppe. */
export interface Funding { id: string; date: string; categoryId: string; walletId: string; amount: number; note?: string }

/** Dépense prévue ponctuelle (posée sur une date du calendrier). */
export interface Planned { id: string; date: string; categoryId: string; amount: number; walletId?: string; note?: string }

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
  /** Lien vers une dépense prévue (« catégorie@AAAA-MM-JJ ») réglée via « ✓ Payé ». */
  planKey?: string;
  /** Justificatifs (reçu, facture…) : fichiers gardés sur l'appareil et dans la sauvegarde en ligne. */
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  /** Date d'ajout. */
  addedAt?: string;
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
  /** Description du projet (ce que l'objectif doit financer). */
  project?: string;
  /** Banque / portefeuille depuis lequel l'objectif est approvisionné. */
  sourceWalletId?: string;
  /** Versement mensuel prévu (sinon calculé d'après l'échéance) et jour du versement. */
  monthly?: number;
  day?: number;
  remind?: boolean;
  /** Objectif mis en pause : plus de versement proposé. */
  paused?: boolean;
  /** Projet réalisé (date). */
  doneAt?: string;
  contributions: Contribution[];
  createdAt: string;
}

/** Versement vers un objectif. L'argent reste BLOQUÉ sur `heldIn` jusqu'à ce qu'on le débloque (montant négatif). */
export interface Contribution {
  date: string;
  amount: number;
  /** Compte d'où vient l'argent. */
  walletId?: string;
  /** Compte où l'argent est gardé (bloqué). Par défaut : Épargne. */
  heldIn?: string;
  /** Déblocage (montant négatif) : l'argent redevient utilisable. */
  release?: boolean;
  /** Déblocage pour payer le projet lui-même (la progression est conservée). */
  forProject?: boolean;
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
  /** Dépenses prévues volontairement sautées (« Pas cette fois »). */
  skipped?: string[];
  /** Approvisionnements des enveloppes. */
  fundings?: Funding[];
  /** Dépenses prévues ponctuelles. */
  planned?: Planned[];
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
  /** Part du solde bloquée pour des objectifs / projets. */
  locked: number;
  /** Part réservée aux enveloppes du budget (approvisionnements non encore dépensés, mois en cours). */
  reservedBudget: number;
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

/** Montants masqués (mode discret) : tous les affichages passent par fmt / fmtK. */
let MASK = false;
export const setMaskAmounts = (v: boolean) => { MASK = v; };
export const isMaskOn = () => MASK;
export const MASK_TEXT = '• • •';
/** Format brut, jamais masqué (saisie, exports, calculs). */
export const fmtN = (n: number) => (Math.round(n) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ');
export const fmt = (n: number) => (MASK ? MASK_TEXT : fmtN(n));
export const fmtF = (n: number) => `${fmt(n)} XOF`;
export const fmtK = (n: number) => {
  if (MASK) return MASK_TEXT;
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
export function walletReports(state: State, until: string, month?: string): WalletReport[] {
  const env = month ? envelopeReservations(state, month) : new Map<string, { categoryId: string; name: string; amount: number }[]>();
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
      const balance = w.initialBalance + inflow - outflow + tin - tout;
      return {
        id: w.id, name: w.name, icon: w.icon, logo: w.logo, source: w.source, updatedAt: w.updatedAt, reserved: !!w.reserved,
        initial: w.initialBalance, inflow, outflow, transfersIn: tin, transfersOut: tout,
        balance, locked: Math.min(lockedIn(state, w.id), Math.max(0, balance)),
        reservedBudget: (env.get(w.id) ?? []).reduce((a, x) => a + x.amount, 0),
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
  const categories: CategoryReport[] = catsForMonth(state.categories, month)
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
  const wallets = walletReports(state, until, month);
  // L'argent bloqué pour un projet n'est pas « disponible ».
  const totalCash = wallets.filter((w) => !w.reserved).reduce((a, w) => a + w.balance - w.locked, 0);
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
export function applyRebalance(state: State, p: RebalanceProposal, month?: string): Category[] {
  const next = new Map<string, number>();
  for (const c of p.covers) next.set(c.id, c.to);
  for (const c of p.cuts) next.set(c.id, c.to);
  return state.categories.map((c) => {
    if (!next.has(c.id)) return c;
    const cur = month ? budgetFor(c, month) : c.budget;
    // Une obligation dépassée peut être relevée, jamais réduite.
    const v = c.kind === 'obligatory' || c.kind === 'savings' ? Math.max(cur, next.get(c.id)!) : next.get(c.id)!;
    // Budget propre à ce mois : on ne change que ce mois-là.
    if (month && c.budgets?.[month] !== undefined) return { ...c, budgets: { ...c.budgets, [month]: v } };
    return { ...c, budget: v };
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

export interface Due { categoryId: string; name: string; icon: string; logo?: string; day: number; date: string; amount: number; paid: boolean; color: string }

/** Échéances et dépenses planifiées du mois, jour par jour (charges fixes + enveloppes à rythme). */
export function monthDues(state: State, r: MonthReport): Due[] {
  const color = new Map((state.groups ?? []).map((g) => [g.id, g.color]));
  const out: Due[] = [];
  for (const c of state.categories) {
    if (c.hidden || budgetFor(c, r.month) <= 0) continue;
    const occ = occurrences(c, r.month);
    const monthly = planOf(c)?.freq === 'monthly';
    const rep = r.categories.find((x) => x.id === c.id);
    for (const o of occ) {
      const dayKey = `${r.month}-${pad(o.day)}`;
      const key = planKey(c.id, dayKey);
      const linked = state.txs.filter((t) => t.type === 'expense' && t.planKey === key).reduce((a, t) => a + t.amount, 0);
      const spentDay = state.txs.filter((t) => t.type === 'expense' && t.categoryId === c.id && t.date === dayKey && !t.planKey).reduce((a, t) => a + t.amount, 0);
      out.push({
        categoryId: c.id, name: c.name, icon: c.icon, logo: c.logo, amount: o.amount, day: o.day, date: dayKey,
        paid: (state.skipped ?? []).includes(key) || linked >= o.amount || (monthly ? (rep?.spent ?? 0) >= budgetFor(c, r.month) : spentDay + linked >= o.amount),
        color: color.get(c.group ?? '') ?? '#A3A9B3',
      });
    }
  }
  return out.sort((a, b) => a.day - b.day);
}

/** Épargné pour l'objectif (un déblocage « pour réaliser le projet » ne fait pas reculer la progression). */
export const goalSaved = (g: Goal) => g.contributions.reduce((a, c) => a + (c.forProject ? 0 : c.amount), 0);

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
  const budget = budgetFor(c, month);
  if (!p || budget <= 0) return [];
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
  const base = Math.floor(budget / days.length / 50) * 50;
  return days.map((day, i) => ({ day, amount: i === days.length - 1 ? budget - base * (days.length - 1) : base }));
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

// ---------------------------------------------------------------------
// « À régler » : ce qui est prévu et pas encore marqué comme payé
// ---------------------------------------------------------------------
export type PendingStatus = 'overdue' | 'today' | 'soon';
export interface PendingItem {
  key: string;
  kind: 'category' | 'goal' | 'planned';
  refId: string;
  plannedId?: string;
  name: string;
  icon: string;
  logo?: string;
  date: string;
  /** Montant prévu restant à régler. */
  amount: number;
  planned: number;
  status: PendingStatus;
  obligatory: boolean;
  walletId?: string;
}

export const planKey = (categoryId: string, date: string) => `${categoryId}@${date}`;
export const goalKey = (goalId: string, month: string) => `goal:${goalId}@${month}`;
export const plannedKey = (id: string) => `plan:${id}`;

/** Effective monthly saving for a goal (fixed amount or computed from the deadline). */
export const goalPlanned = (g: Goal, month: string) => (g.monthly && g.monthly > 0 ? g.monthly : goalMonthly(g, month));

/**
 * Liste simple de ce qui reste à régler : en retard, aujourd'hui, et les `horizon` prochains jours.
 * Une échéance est réglée si une opération lui est liée (planKey), si elle est sautée,
 * ou — pour les opérations notées « à la main » — si la dépense de ce jour (ou du mois pour une charge mensuelle) la couvre.
 */
export function pendingItems(state: State, today: Date, horizon = 7): PendingItem[] {
  const month = monthKey(today);
  const iso = toISODate(today);
  const last = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + horizon));
  const weekAgo = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));
  const skipped = new Set(state.skipped ?? []);
  const exp = state.txs.filter((t) => t.type === 'expense');
  const out: PendingItem[] = [];
  const status = (d: string): PendingStatus => (d < iso ? 'overdue' : d === iso ? 'today' : 'soon');
  const months = today.getDate() + horizon > daysIn(month) ? [month, shiftMonth(month, 1)] : [month];

  for (const c of state.categories) {
    if (c.hidden) continue;
    const p = planOf(c);
    if (!p) continue;
    let soon = 0;
    for (const m of months) {
      const occ = occurrences(c, m);
      for (const o of occ) {
        const date = `${m}-${pad(o.day)}`;
        if (date > last) continue;
        // Quotidien : seulement aujourd'hui. Hebdomadaire / dates : seulement la prochaine échéance à venir.
        if (p.freq === 'daily' && date !== iso) continue;
        if (date > iso && p.freq !== 'monthly' && soon >= 1) continue;
        // Retards : tout le mois pour une charge mensuelle, 7 jours pour le reste, rien pour le quotidien.
        if (date < iso && (p.freq === 'daily' || (p.freq !== 'monthly' && date < weekAgo) || m !== month)) continue;
        const key = planKey(c.id, date);
        if (skipped.has(key)) continue;
        const linked = exp.filter((t) => t.planKey === key).reduce((a, t) => a + t.amount, 0);
        let manual = 0;
        if (p.freq === 'monthly') {
          // Dépenses du mois non liées à une autre échéance.
          manual = exp.filter((t) => t.categoryId === c.id && !t.planKey && t.date.startsWith(m)).reduce((a, t) => a + t.amount, 0);
        } else {
          manual = exp.filter((t) => t.categoryId === c.id && !t.planKey && t.date === date).reduce((a, t) => a + t.amount, 0);
        }
        const left = o.amount - linked - manual;
        if (left <= 0) continue;
        if (date > iso) soon++;
        out.push({
          key, kind: 'category', refId: c.id, name: c.name, icon: c.icon, logo: c.logo, date,
          amount: left, planned: o.amount, status: status(date), obligatory: c.kind === 'obligatory', walletId: c.sourceWalletId,
        });
      }
    }
  }

  // Dépenses prévues ponctuellement sur une date
  const monthStart = `${month}-01`;
  for (const pl of state.planned ?? []) {
    if (pl.date > last || pl.date < monthStart && pl.date < weekAgo) continue;
    const key = plannedKey(pl.id);
    if (skipped.has(key)) continue;
    const c = state.categories.find((x) => x.id === pl.categoryId);
    const done = exp.filter((t) => t.planKey === key).reduce((a, t) => a + t.amount, 0);
    if (done >= pl.amount) continue;
    out.push({
      key, kind: 'planned', refId: pl.categoryId, plannedId: pl.id, name: pl.note || c?.name || 'Dépense prévue', icon: c?.icon ?? 'tag', logo: c?.logo,
      date: pl.date, amount: pl.amount - done, planned: pl.amount, status: status(pl.date), obligatory: c?.kind === 'obligatory', walletId: pl.walletId ?? c?.sourceWalletId,
    });
  }

  for (const g of state.goals ?? []) {
    if (g.paused || g.doneAt || !g.day || g.remind === false) continue;
    if (goalSaved(g) >= g.target) continue;
    for (const m of months) {
      if (m > g.deadline) continue;
      const date = `${m}-${pad(Math.min(g.day, daysIn(m)))}`;
      if (date > last || (date < iso && m !== month)) continue;
      const key = goalKey(g.id, m);
      if (skipped.has(key)) continue;
      const planned = Math.min(goalPlanned(g, m), g.target - goalSaved(g));
      const done = g.contributions.filter((c) => c.date.startsWith(m)).reduce((a, c) => a + c.amount, 0);
      const left = planned - done;
      if (left <= 0) continue;
      out.push({
        key, kind: 'goal', refId: g.id, name: g.name, icon: 'piggy', logo: g.image, date, amount: left, planned,
        status: status(date), obligatory: false, walletId: g.sourceWalletId,
      });
    }
  }
  const rank = { overdue: 0, today: 1, soon: 2 } as const;
  return out.sort((a, b) => rank[a.status] - rank[b.status] || a.date.localeCompare(b.date) || Number(b.obligatory) - Number(a.obligatory));
}

// ---------------------------------------------------------------------
// Argent bloqué pour les objectifs / projets
// ---------------------------------------------------------------------
export const heldInOf = (c: Contribution) => c.heldIn ?? 'w_savings';

/** Montants bloqués par compte, objectif par objectif. */
export function lockedByWallet(state: State): Map<string, { goalId: string; name: string; amount: number }[]> {
  const out = new Map<string, { goalId: string; name: string; amount: number }[]>();
  for (const g of state.goals ?? []) {
    const per = new Map<string, number>();
    for (const c of g.contributions) per.set(heldInOf(c), (per.get(heldInOf(c)) ?? 0) + c.amount);
    for (const [w, amount] of per) {
      if (amount <= 0) continue;
      out.set(w, [...(out.get(w) ?? []), { goalId: g.id, name: g.name, amount }]);
    }
  }
  return out;
}
export const lockedIn = (state: State, walletId: string) => (lockedByWallet(state).get(walletId) ?? []).reduce((a, x) => a + x.amount, 0);
/** Montant bloqué pour un objectif sur un compte donné. */
export const goalLockedIn = (g: Goal, walletId: string) => g.contributions.filter((c) => heldInOf(c) === walletId).reduce((a, c) => a + c.amount, 0);

export interface Availability { balance: number; locked: number; available: number; goals: { goalId: string; name: string; amount: number }[] }
/** Ce qu'on peut vraiment utiliser sur un compte (solde moins l'argent bloqué). */
export function availability(state: State, walletId: string, until = '9999-12-31'): Availability {
  const w = walletReports({ ...state, wallets: state.wallets.map((x) => ({ ...x, hidden: false })) }, until).find((x) => x.id === walletId);
  const balance = w?.balance ?? 0;
  const goals = lockedByWallet(state).get(walletId) ?? [];
  const locked = w?.locked ?? 0;
  return { balance, locked, available: balance - locked, goals };
}

/**
 * Une sortie d'argent touche-t-elle l'argent bloqué ? Renvoie le blocage à afficher, ou null.
 * (Si le solde est déjà insuffisant sans blocage, on laisse passer : le solde déclaré peut être en retard.)
 */
export function lockCheck(state: State, walletId: string | undefined, amount: number): (Availability & { missing: number }) | null {
  if (!walletId || amount <= 0) return null;
  const a = availability(state, walletId);
  if (a.locked <= 0 || amount <= a.available) return null;
  return { ...a, missing: amount - Math.max(0, a.available) };
}

// ---------------------------------------------------------------------
// Séquences : mois concernés et budget propre à chaque mois
// ---------------------------------------------------------------------
export const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Budget de l'enveloppe pour un mois donné (0 si le mois n'est pas concerné). */
export function budgetFor(c: Category, month: string): number {
  const m = Number(month.slice(5, 7));
  if (c.months?.length && !c.months.includes(m)) return 0;
  return c.budgets?.[month] ?? c.budget;
}
export const catsForMonth = (cats: Category[], month: string): Category[] =>
  cats.map((c) => { const b = budgetFor(c, month); return b === c.budget ? c : { ...c, budget: b }; });

/** Évolution mois par mois : budget, dépensé, reste (pour une enveloppe ou pour tout le budget). */
export function monthlyEvolution(state: State, from: string, count: number, categoryId?: string) {
  const isConso = (c?: Category) => !!c && c.kind !== 'savings';
  return Array.from({ length: count }, (_, i) => {
    const month = shiftMonth(from, i);
    const cats = state.categories.filter((c) => (categoryId ? c.id === categoryId : isConso(c) && !c.hidden));
    const budget = cats.reduce((a, c) => a + budgetFor(c, month), 0);
    const ids = new Set(cats.map((c) => c.id));
    const spent = state.txs.filter((t) => t.type === 'expense' && t.date.startsWith(month) && ids.has(t.categoryId ?? '')).reduce((a, t) => a + t.amount, 0);
    return { month, budget, spent, remaining: budget - spent };
  });
}

// ---------------------------------------------------------------------
// Enveloppes approvisionnées depuis les comptes
// ---------------------------------------------------------------------
export interface EnvelopeView {
  categoryId: string;
  month: string;
  budget: number;
  spent: number;
  /** Ce qui reste dans le budget du mois. */
  remaining: number;
  /** Total approvisionné ce mois. */
  funded: number;
  /** Encore à approvisionner pour couvrir le budget. */
  toFund: number;
  /** Argent encore réservé sur chaque compte (approvisionné − dépensé). */
  byWallet: { walletId: string; funded: number; reserved: number }[];
  reserved: number;
}

export function envelopeView(state: State, c: Category, month: string): EnvelopeView {
  const budget = budgetFor(c, month);
  const fund = new Map<string, number>();
  for (const f of state.fundings ?? []) if (f.categoryId === c.id && f.date.startsWith(month)) fund.set(f.walletId, (fund.get(f.walletId) ?? 0) + f.amount);
  const spentW = new Map<string, number>();
  let spent = 0;
  for (const t of state.txs) {
    if (t.type !== 'expense' || t.categoryId !== c.id || !t.date.startsWith(month)) continue;
    spent += t.amount;
    const w = t.walletId ?? '';
    spentW.set(w, (spentW.get(w) ?? 0) + t.amount);
  }
  // Les dépenses consomment d'abord l'argent réservé sur le même compte, puis celui des autres comptes.
  const rem = new Map(fund);
  let overflow = 0;
  for (const [w, sp] of spentW) {
    const r = rem.get(w) ?? 0;
    const take = Math.min(r, sp);
    if (rem.has(w)) rem.set(w, r - take);
    overflow += sp - take;
  }
  for (const [w, r] of [...rem].sort((a, b) => b[1] - a[1])) {
    if (overflow <= 0) break;
    const take = Math.min(r, overflow);
    rem.set(w, r - take);
    overflow -= take;
  }
  const funded = [...fund.values()].reduce((a, b) => a + b, 0);
  const byWallet = [...fund].map(([walletId, f]) => ({ walletId, funded: f, reserved: Math.max(0, rem.get(walletId) ?? 0) }));
  return {
    categoryId: c.id, month, budget, spent, remaining: budget - spent, funded, toFund: Math.max(0, budget - funded),
    byWallet, reserved: byWallet.reduce((a, x) => a + x.reserved, 0),
  };
}

/** Argent réservé aux enveloppes, compte par compte (mois donné). */
export function envelopeReservations(state: State, month: string) {
  const out = new Map<string, { categoryId: string; name: string; amount: number }[]>();
  if (!state.fundings?.length) return out;
  const ids = new Set(state.fundings.filter((f) => f.date.startsWith(month)).map((f) => f.categoryId));
  for (const c of state.categories) {
    if (!ids.has(c.id)) continue;
    for (const w of envelopeView(state, c, month).byWallet) {
      if (w.reserved <= 0) continue;
      out.set(w.walletId, [...(out.get(w.walletId) ?? []), { categoryId: c.id, name: c.name, amount: w.reserved }]);
    }
  }
  return out;
}

/**
 * Une dépense dépasse-t-elle ce qui reste dans l'enveloppe ? Renvoie le montant manquant (0 sinon).
 * Les enveloppes sans budget ne sont pas concernées.
 */
export function envelopeShortfall(state: State, categoryId: string | undefined, amount: number, month: string): { left: number; missing: number; budget: number } | null {
  const c = state.categories.find((x) => x.id === categoryId);
  if (!c || amount <= 0) return null;
  const budget = budgetFor(c, month);
  if (budget <= 0) return null;
  const spent = state.txs.filter((t) => t.type === 'expense' && t.categoryId === c.id && t.date.startsWith(month)).reduce((a, t) => a + t.amount, 0);
  const left = budget - spent;
  return amount > left ? { left, missing: amount - Math.max(0, left), budget } : null;
}

/** Compléter une enveloppe depuis un compte : budget du mois relevé + approvisionnement. */
export function topUpEnvelope(state: State, categoryId: string, walletId: string, amount: number, date: string, id: string): State {
  const month = date.slice(0, 7);
  return {
    ...state,
    categories: state.categories.map((c) => (c.id === categoryId ? { ...c, budgets: { ...(c.budgets ?? {}), [month]: budgetFor(c, month) + amount } } : c)),
    fundings: [...(state.fundings ?? []), { id, date, categoryId, walletId, amount, note: 'Complément' }],
  };
}

/** Approvisionner une enveloppe ; si on dépasse le budget du mois, il est relevé d'autant. */
export function fundEnvelope(state: State, f: Funding): State {
  const month = f.date.slice(0, 7);
  const c = state.categories.find((x) => x.id === f.categoryId);
  if (!c) return state;
  const funded = envelopeView(state, c, month).funded + f.amount;
  const budget = budgetFor(c, month);
  return {
    ...state,
    categories: funded > budget ? state.categories.map((x) => (x.id === c.id ? { ...x, budgets: { ...(x.budgets ?? {}), [month]: funded } } : x)) : state.categories,
    fundings: [...(state.fundings ?? []), f],
  };
}

/** Solde, part bloquée (projets), part réservée (enveloppes) et part libre d'un compte. */
export function walletFree(state: State, walletId: string, month: string) {
  const w = walletReports({ ...state, wallets: state.wallets.map((x) => ({ ...x, hidden: false })) }, '9999-12-31', month).find((x) => x.id === walletId);
  if (!w) return { balance: 0, locked: 0, reserved: 0, free: 0 };
  return { balance: w.balance, locked: w.locked, reserved: w.reservedBudget, free: w.balance - w.locked - w.reservedBudget };
}
