import type { Category, Group, IncomeCategory, State, Wallet } from './engine';

/** Groupes de dépenses : une couleur douce par groupe, utilisée dans l'anneau et le schéma « Où part ton argent ». */
export const DEFAULT_GROUPS: Group[] = [
  { id: 'g_home', name: 'Logement', icon: 'house', color: '#A88A2E' },
  { id: 'g_daily', name: 'Vie quotidienne', icon: 'cart', color: '#2F9E8F' },
  { id: 'g_transport', name: 'Transports', icon: 'taxi', color: '#3D6FD1' },
  { id: 'g_family', name: 'Famille & engagements', icon: 'family', color: '#8E5BC9' },
  { id: 'g_fun', name: 'Sorties & shopping', icon: 'party', color: '#D2564F' },
  { id: 'g_subs', name: 'Abonnements', icon: 'tv', color: '#5865C9' },
  { id: 'g_debt', name: 'Crédits', icon: 'bank', color: '#6B7280' },
  { id: 'g_other', name: 'Imprévus & autres', icon: 'alert', color: '#A3A9B3' },
  { id: 'g_savings', name: 'Épargne', icon: 'piggy', color: '#2E9E5B' },
];

/** Images proposées d'office (photos fournies + pictogrammes). Modifiables dans chaque fiche. */
export const DEFAULT_IMAGES: Record<string, string> = {
  c_cie: 'img/c_cie.png',
  c_clothes: 'img/c_clothes.png',
  c_family: 'img/c_family.png',
  c_fees: 'img/c_fees.png',
  c_food: 'img/c_food.jpg',
  c_gifts: 'img/c_gifts.png',
  c_health: 'img/c_health.jpg',
  c_home: 'img/c_home.png',
  c_leisure: 'img/c_leisure.jpg',
  c_loan: 'img/c_loan.png',
  c_other: 'img/c_other.png',
  c_phone: 'img/c_phone.jpg',
  c_rent: 'img/c_rent.jpg',
  c_resto: 'img/c_resto.png',
  c_savings: 'img/c_savings.png',
  c_school: 'img/c_school.png',
  c_sodeci: 'img/c_sodeci.png',
  c_subs: 'img/c_subs.png',
  c_transport: 'img/c_transport.jpg',
  c_unexpected: 'img/c_unexpected.png',
  w_bank: 'img/w_bank.jpg',
  w_cash: 'img/w_cash.jpg',
  w_moov: 'img/w_moov.png',
  w_mtn: 'img/w_mtn.jpg',
  w_om: 'img/w_om.jpg',
  w_savings: 'img/w_savings.png',
  w_wave: 'img/w_wave.jpg',
};
export const withDefaultImage = <T extends { id: string; logo?: string }>(x: T): T =>
  x.logo === undefined && DEFAULT_IMAGES[x.id] ? { ...x, logo: DEFAULT_IMAGES[x.id] } : x;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'c_rent', name: 'Loyer', icon: 'house', kind: 'obligatory', budget: 0, group: 'g_home', dueDay: 5 },
  { id: 'c_cie', name: 'Électricité CIE', icon: 'zap', kind: 'obligatory', budget: 0, group: 'g_home', dueDay: 15 },
  { id: 'c_sodeci', name: 'Eau SODECI', icon: 'droplet', kind: 'obligatory', budget: 0, group: 'g_home', dueDay: 15 },
  { id: 'c_school', name: 'Scolarité', icon: 'school', kind: 'obligatory', budget: 0, group: 'g_family', dueDay: 10 },
  { id: 'c_loan', name: 'Remboursement de crédit', icon: 'bank', kind: 'obligatory', budget: 0, group: 'g_debt', dueDay: 30 },
  { id: 'c_food', name: 'Courses & marché', icon: 'cart', kind: 'adjustable', budget: 0, group: 'g_daily', maxCut: 0.15 },
  { id: 'c_transport', name: 'Transport', icon: 'taxi', kind: 'adjustable', budget: 0, group: 'g_transport', maxCut: 0.15 },
  { id: 'c_phone', name: 'Internet & tél.', icon: 'phone', kind: 'adjustable', budget: 0, group: 'g_daily', maxCut: 0.2 },
  { id: 'c_health', name: 'Santé', icon: 'health', kind: 'adjustable', budget: 0, group: 'g_daily', maxCut: 0 },
  { id: 'c_family', name: 'Famille', icon: 'family', kind: 'adjustable', budget: 0, group: 'g_family', maxCut: 0.25 },
  { id: 'c_gifts', name: 'Dîmes & dons', icon: 'church', kind: 'adjustable', budget: 0, group: 'g_family', maxCut: 0.25 },
  { id: 'c_home', name: 'Maison & entretien', icon: 'clean', kind: 'adjustable', budget: 0, group: 'g_home', maxCut: 0.3 },
  { id: 'c_fees', name: 'Frais Mobile Money', icon: 'fees', kind: 'adjustable', budget: 0, group: 'g_daily', maxCut: 0 },
  { id: 'c_resto', name: 'Maquis & restos', icon: 'food', kind: 'flexible', budget: 0, group: 'g_fun' },
  { id: 'c_leisure', name: 'Loisirs & sorties', icon: 'party', kind: 'flexible', budget: 0, group: 'g_fun' },
  { id: 'c_clothes', name: 'Shopping & habits', icon: 'bag', kind: 'flexible', budget: 0, group: 'g_fun' },
  { id: 'c_subs', name: 'Autres abonnements', icon: 'tv', kind: 'flexible', budget: 0, group: 'g_subs' },
  { id: 'c_other', name: 'Autres', icon: 'box', kind: 'flexible', budget: 0, group: 'g_other' },
  { id: 'c_unexpected', name: 'Imprévus', icon: 'alert', kind: 'unexpected', budget: 0, group: 'g_other' },
  { id: 'c_savings', name: 'Épargne & tontine', icon: 'piggy', kind: 'savings', budget: 0, group: 'g_savings' },
];

export const DEFAULT_INCOME: IncomeCategory[] = [
  { id: 'i_salary', name: 'Salaire', icon: 'work', kind: 'income' },
  { id: 'i_bonus', name: 'Prime', icon: 'star', kind: 'income' },
  { id: 'i_business', name: 'Activité commerciale', icon: 'store', kind: 'income' },
  { id: 'i_side', name: 'Revenu complémentaire', icon: 'puzzle', kind: 'income' },
  { id: 'i_rent', name: 'Loyer perçu', icon: 'key', kind: 'income' },
  { id: 'i_transfer', name: 'Transfert reçu', icon: 'in', kind: 'income' },
  { id: 'i_refund', name: 'Remboursement', icon: 'refund', kind: 'refund' },
  { id: 'i_other', name: 'Autre revenu', icon: 'plus', kind: 'income' },
];

const now = () => new Date().toISOString();

export const DEFAULT_WALLETS = (): Wallet[] => [
  { id: 'w_cash', name: 'Espèces', icon: 'cash', initialBalance: 0, source: 'declared', updatedAt: now() },
  { id: 'w_wave', name: 'Wave', icon: '', initialBalance: 0, source: 'declared', updatedAt: now() },
  { id: 'w_om', name: 'Orange Money', icon: '', initialBalance: 0, source: 'declared', updatedAt: now() },
  { id: 'w_mtn', name: 'MTN MoMo', icon: '', initialBalance: 0, source: 'declared', updatedAt: now() },
  { id: 'w_moov', name: 'Moov Money', icon: '', initialBalance: 0, source: 'declared', updatedAt: now() },
  { id: 'w_bank', name: 'Compte bancaire', icon: 'bank', initialBalance: 0, source: 'declared', updatedAt: now() },
  { id: 'w_savings', name: 'Épargne', icon: 'piggy', initialBalance: 0, source: 'declared', updatedAt: now(), reserved: true },
];

/** Budgets proposés en part du revenu (repères modifiables, pas des recommandations universelles). */
export const BUDGET_SHARES: Record<string, number> = {
  c_rent: 0.2, c_cie: 0.033, c_sodeci: 0.013, c_school: 0.067, c_food: 0.133, c_transport: 0.08, c_phone: 0.02,
  c_health: 0.027, c_family: 0.053, c_gifts: 0.027, c_home: 0.013, c_fees: 0.007, c_resto: 0.04, c_leisure: 0.027,
  c_clothes: 0.02, c_unexpected: 0.027, c_savings: 0.067,
};
export const suggestBudget = (id: string, income: number) => Math.round(((BUDGET_SHARES[id] ?? 0) * income) / 500) * 500;

/** Abonnements proposés au démarrage (noms uniquement, sans logos de marque). */
export const SUBSCRIPTION_CHOICES = [
  'Canal+', 'Netflix', 'Spotify', 'YouTube Premium', 'Prime Video', 'Disney+', 'Apple Music', 'Deezer',
  'Box internet', 'Forfait mobile', 'Salle de sport', 'Assurance',
];
/** Icône simple par abonnement générique (les services de marque gardent leurs initiales ou ton logo importé). */
export const SUBSCRIPTION_ICONS: Record<string, string> = {
  'Box internet': 'wifi', 'Forfait mobile': 'phone', 'Salle de sport': 'sport', Assurance: 'shield',
};

export function initialState(): State {
  return {
    groups: DEFAULT_GROUPS.map((g) => ({ ...g })),
    goals: [],
    debts: [],
    categories: DEFAULT_CATEGORIES.map((c) => withDefaultImage({ ...c })),
    incomeCategories: DEFAULT_INCOME.map((c) => ({ ...c })),
    wallets: DEFAULT_WALLETS().map(withDefaultImage),
    txs: [],
    settings: { expectedIncome: 0, warnPct: 85, paceMargin: 10, presets: [500, 1000, 2000, 5000, 10000, 25000] },
  };
}
