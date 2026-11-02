# Budget Ivoire — mise en ligne sur Netlify et création de l’APK

Application de budget personnel en FCFA organisée en 5 onglets (Patrimoine, Objectifs, Activité, Budget, Stats), démarrage pas à pas (salaire puis chaque charge avec son jour du mois), 4 modèles d’interface aux couleurs sobres (Émeraude, Nuit dorée, Wax, Lagune), logos personnalisables (importez vos propres images), calendrier, portefeuilles Mobile Money, rééquilibrage automatique, simulateur « Et si… ? », mode hors ligne. Aucune donnée fictive : l’application démarre vide.

---

## 1. Comptes et sauvegarde en ligne (Supabase) — déjà en place

- Projet Supabase **budget-ivoire** (région Paris, offre gratuite), id `qgdzvtpuvoouivkhtwzd`.
- Fonction serveur **api** (`supabase/functions/api/`) : inscription, connexion, sauvegarde, suppression du compte.
- Tables `bi_users`, `bi_data`, `bi_config` (`supabase/migrations/`) : sécurité « RLS » active, aucune lecture possible
  depuis l’extérieur ; seule la fonction serveur y accède.
- L’application (web et APK) l’utilise automatiquement : adresse dans `src/config.tsx` (`apiBase`).

### Comment marchent les comptes
- Les données sont **toujours** enregistrées sur le téléphone, même sans Internet.
- Connecté, chaque modification est envoyée au serveur 2 secondes après (ou au retour du réseau). L’icône nuage indique : *en attente*, *synchronisation*, *synchronisé*, *hors connexion* ou *erreur*.
- Nouveau téléphone : écran d’accueil › **J’ai déjà un compte · me reconnecter** › tout revient.
- Deux téléphones sur le même compte : les opérations des deux sont fusionnées, aucune n’est perdue ; une suppression se propage.
- Mots de passe chiffrés (scrypt), 5 essais ratés = blocage 15 min, session valable 90 jours, suppression du compte possible depuis l’app.

---

## 2. APK Android et site web (automatiques sur GitHub)

À chaque envoi sur la branche `main` du dépôt GitHub :
- **Build APK Android** (`.github/workflows/android-apk.yml`) compile l’APK avec Capacitor.
  Téléchargement : onglet **Actions** › dernier « Build APK Android » › **Artifacts** › `budget-ivoire-apk` (contient `budget-ivoire.apk`).
- **Site web** (`.github/workflows/pages.yml`) publie la version web sur GitHub Pages (dépôt public) :
  `https://ykbsilvere-maker.github.io/budget-ivoire/`

Installer l’APK : envoyez-le sur le téléphone (WhatsApp, Drive, câble) › ouvrez-le › autorisez « Installer des applications inconnues ».
L’APK actuel est une version de test (*debug*) : parfait pour l’utiliser et le partager. Pour le Google Play Store, il faudra une version signée (*release*) et un compte développeur Google (25 $ une fois).

Autre option sans compilation : **pwabuilder.com** à partir de l’adresse du site web.

---

## 3. Développement

```bash
npm install
npm test        # tests du moteur, de la fusion et de l’API comptes
npm run build   # produit dist/
npx serve dist  # aperçu local
```

| Fichier | Rôle |
|---|---|
| `src/engine.ts` | Moteur de calcul financier déterministe (reste à vivre, obligations, rééquilibrage, simulation) |
| `src/engine.test.ts` | Tests : revenu absent, solde négatif, transfert, remboursement, dépassement, changement de mois… |
| `src/data.ts` | Catégories ivoiriennes, portefeuilles, budgets proposés selon le revenu |
| `src/fixtures.ts` | Données fictives réservées aux tests automatiques (jamais affichées dans l’app) |
| `src/icons.tsx` | Icônes simples + import de logos personnels |
| `src/sheets/Welcome.tsx` | Démarrage pas à pas : salaire, puis chaque charge (montant + jour), anneau « restant » |
| `src/screens/Budget.tsx` | Onglet Budget : anneau, groupes, schéma « Où part ton argent » |
| `src/screens/Goals.tsx` | Objectifs d’épargne, crédits/prêts, trajectoire |
| `src/sheets/GoalSheets.tsx` | Création d’objectifs, versements, crédits, groupes |
| `src/config.tsx` | **Nom et logo de l’application** (modifiables sans toucher au reste) |
| `src/styles.css` | Les 4 modèles d’interface (variables de couleurs) |
| `src/screens/` | Accueil, Calendrier, Mon argent, Analyse + Et si… |
| `src/sheets/` | Ajout rapide (voix, scan, répétition), rééquilibrage, réglages… |
| `netlify/functions/analyze-receipt.mjs` | Analyse IA des reçus côté serveur |
| `supabase/functions/api/` | Comptes (inscription, connexion) et sauvegarde en ligne (fonction Supabase) |
| `supabase/migrations/` | Tables et règles de sécurité de la base |
| `src/services/account.ts` | Connexion, synchronisation hors ligne → serveur |
| `src/sync.ts` | Fusion des données entre téléphones |

## Ce qui est en place / ce qui reste à faire
- ✅ Données enregistrées sur l’appareil, hors connexion, export CSV + sauvegarde/restauration JSON.
- ✅ Aucune connexion bancaire ou Mobile Money, aucun code PIN demandé.
- ✅ Comptes et sauvegarde en ligne, reconnexion sur un autre téléphone, fonctionnement hors connexion.
- ⚠️ Pas encore de « mot de passe oublié » par e-mail (il faudrait un service d’envoi d’e-mails).
- ⚠️ Verrouillage par code / empreinte : à ajouter dans la version APK (plugin Capacitor biométrie).
- ⚠️ La dictée vocale dépend du navigateur (fonctionne dans Chrome Android) ; sinon, une phrase écrite est analysée.
