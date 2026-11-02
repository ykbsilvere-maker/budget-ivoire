// Identité de l'application : modifiez ces valeurs pour renommer l'app
// ou changer le logo, sans toucher au reste du code.
export const APP = {
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
