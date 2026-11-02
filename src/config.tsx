// Identité de l'application : modifiez ces valeurs pour renommer l'app
// ou changer le logo, sans toucher au reste du code.
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

export const APP = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
  builtAt: typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '',
  name: 'Budget Ivoire',
  tagline: 'Ton assistant budget',
  currency: 'XOF',
  /** Serveur des comptes et de la sauvegarde en ligne (fonction Supabase « api »).
   *  Utilisé par la version web ET par l'APK. */
  apiBase: 'https://qgdzvtpuvoouivkhtwzd.supabase.co/functions/v1',
};

/** Logo original : feuille stylisée + portefeuille + courbe de croissance. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="var(--s-primary)" />
      <rect x="12" y="24" width="40" height="26" rx="7" fill="#fff" opacity=".95" />
      <rect x="38" y="32" width="14" height="10" rx="4" fill="var(--s-primary)" opacity=".18" />
      <circle cx="44" cy="37" r="2.4" fill="var(--s-primary)" />
      <path d="M17 44 L25 37 L30 40 L38 31" stroke="var(--s-primary)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M33 22 C33 12 41 8 50 8 C50 17 45 23 35 23 Z" fill="#fff" />
      <path d="M35 21.5 C39 17 43 14 47.5 11" stroke="var(--s-primary)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Nouveautés affichées dans Réglages › À propos (la plus récente en premier). */
export const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  { version: '1.6', date: '2 novembre 2026', items: [
    '« Prévision du jour » : le détail de ce qui est prévu aujourd’hui selon tes rythmes (ex. Transport 10 000)',
    'Pour chaque ligne : Oui (montant prévu), Non (rien aujourd’hui) ou un autre montant ; Modifier après coup',
    'Rappels avec boutons « Oui, dépensé », « Non », « Autre montant » directement dans la notification',
    'Rappel du soir avec le détail de la prévision du jour',
    'Choisir un rythme semaine / jour / dates active le rappel de ces jours-là',
  ] },
  { version: '1.5', date: '2 novembre 2026', items: [
    'Masquage compte par compte (et du patrimoine) : l’écran reste affiché, le code ou l’empreinte montre le montant',
    'Onglets protégés : visibles, montants masqués jusqu’au code',
    'Approvisionner une enveloppe depuis un compte : l’argent y est réservé, solde avant → après',
    'Compte source par enveloppe ; « pas assez » : compléter depuis un compte',
    'Calendrier : sur une date, Prévoir une dépense, Approvisionner ou Noter',
    'Mois concernés et budget différent selon le mois ; évolution mois par mois',
    'Enveloppes en cartes, lisibles d’un coup d’œil comme les comptes',
  ] },
  { version: '1.4', date: '2 novembre 2026', items: [
    'Images proposées d’office (tes photos + pictogrammes), téléchargeables ; icône devinée d’après le nom',
    '« À régler » : un geste « ✓ Payé » pour chaque dépense prévue (ou « Pas cette fois »)',
    'Justificatifs : photo ou PDF joint à une dépense, à voir et télécharger, sauvegardés en ligne',
    'Masquer les montants (œil) ; code à 4 chiffres ou empreinte pour les afficher, ouvrir l’app ou des onglets',
    'Projets : description, banque d’approvisionnement, versement mensuel avec rappel',
    'Argent bloqué pour un projet : impossible de le dépenser sans le débloquer dans le projet',
    'Bouton Retour du téléphone : revient à l’écran précédent au lieu de quitter',
  ] },
  { version: '1.3.1', date: '2 novembre 2026', items: [
    'Textes et montants qui ne débordent plus des cases, même sur petit écran',
    'Noms des groupes en entier, montants sous la barre',
    'Agrandissement des textes par Android limité pour garder une mise en page propre',
  ] },
  { version: '1.3', date: '2 novembre 2026', items: [
    'Numéro de version et nouveautés visibles dans les réglages',
    'Version Android mise à jour automatiquement à chaque compilation',
  ] },
  { version: '1.2', date: '2 novembre 2026', items: [
    'Montants en XOF',
    'Rythme des enveloppes : par mois, semaine, jour ou dates précises',
    'Rappels sur le téléphone et rappel du soir pour noter ses dépenses',
    'Ajout au Google Agenda et fichier calendrier (.ics)',
    'Carte « Prévu aujourd’hui » dans l’onglet Budget',
  ] },
  { version: '1.1', date: '2 novembre 2026', items: [
    'Comptes et sauvegarde en ligne, reconnexion sur un autre téléphone',
    'Plus de 100 icônes et logos personnalisés',
    '5 onglets : Patrimoine, Objectifs, Activité, Budget, Stats',
  ] },
];
