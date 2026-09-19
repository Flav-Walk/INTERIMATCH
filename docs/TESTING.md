# Stratégie de tests et vérifications · InteriMatch

Ce document consigne la stratégie de test, l'outillage et les résultats factuels constatés sur le frontend d'InteriMatch à l'issue de la consolidation du Lot 8 (sous-lots 8A à 8D).

---

## 1. Résultats factuels constatés (Frontend)

À l'issue des sous-lots 8A, 8B, 8C et 8D, l'ensemble des contrôles automatisés s'exécute avec succès :

| Type de contrôle | Commande | Résultat | Périmètre couvert |
| --- | --- | --- | --- |
| **Typecheck** | `npm run typecheck` | **PASS** | Contrôle statique strict TypeScript (aucun `any` implicite, typage exhaustif). |
| **Linter** | `npm run lint` | **PASS** | ESLint 10 + règles TypeScript-ESLint (zéro avertissement, zéro erreur). |
| **Tests unitaires & intégration** | `npm test` | **230 PASS (17 fichiers)** | Services API, session, missions, candidatures, offres publiques, SEO, accessibilité, pages légales, composants de formulaires et modales. |
| **Compilation de production** | `npm run build` | **PASS** | Build Vite / Rolldown, minification, code splitting par route et génération des bundles sous `dist/`. |
| **Tests E2E Playwright** | `npm run test:e2e` | **66 PASS (9 fichiers)** | Parcours complets desktop (Chromium) et mobile (iPhone 13 émulation Chromium) sans secrets externes. |

---

## 2. Organisation de la suite de tests

### A. Tests unitaires et d'intégration Vitest (`npm test`)

Les 230 tests Vitest s'exécutent en mémoire ultra-rapide (Node.js) et couvrent :

1. **Services réseau & session :**
   * Client HTTP (`api.test.ts`), gestion du bearer en mémoire, interception 401 et renouvellement via `im_refresh` (`session.test.ts`, `session.retry.test.ts`).
   * Services métier : `missions.test.ts`, `applications.test.ts`, `profile.test.ts`, `publicOffers.test.ts`, `admin.test.ts`, `password.test.ts`, `tours.test.ts`.
2. **Composants d'interface :**
   * Badges de matching et explications de compatibilité (`MatchBadge.test.ts`, `MatchedProfiles.test.ts`, `MatchExplanation.test.ts`).
3. **Conformité, SEO et accessibilité (Lot 8) :**
   * `legal.test.tsx` : Rendu des mentions légales, de la politique de confidentialité, de la déclaration d'accessibilité, présence des liens du footer et mentions sur le formulaire d'inscription.
   * `seo.test.tsx` : Hook `usePageSeo`, balises méta dynamiques (titres, descriptions, directives `index,follow` vs `noindex,nofollow`), validation syntaxique et contenu strict de `robots.txt` et `sitemap.xml`.
   * `accessibility.test.tsx` : Landmarks HTML5, lien d'évitement (`.skip-link`), associations explicite `label`/`input`, avertissement `(nouvelle fenêtre)` sur les liens externes, trap focus et modales `role="dialog"`.

### B. Tests End-to-End Playwright (`npm run test:e2e`)

Playwright valide les scénarios réels dans deux environnements navigateurs :
* **Projet `desktop` :** Résolution standard Desktop Chrome.
* **Projet `mobile` :** Émulation iPhone 13 (Chromium mobile).

Le lanceur Playwright démarre automatiquement le serveur de développement Vite (port 5174) et un serveur d'API de test local avec base PostgreSQL éphémère (PGlite, port 3001). **Aucun secret distant ni service tiers externe n'est requis.**

Les 9 fichiers de spécifications couvrent :
* `foundation.spec.ts` : Authentification, redirections protégées, visites guidées, profils intérimaire/entreprise, tableau de bord, création/édition/publication de missions.
* `lifecycle.spec.ts` : Cycle de vie complet des missions, états d'avancement, clôture et annulation.
* `applications.spec.ts` : Dépôt de candidature par l'intérimaire, réception et traitement par l'entreprise.
* `matching.spec.ts` : Rapprochement algorithmique entre profil et offre, calcul et affichage du score.
* `attribution.spec.ts` : Attribution des postes et gestion des capacités.
* `engagement.spec.ts` : Détection et refus de double engagement sur le même créneau.
* `admin.spec.ts` : Consultation et gestion des comptes utilisateurs par un profil administrateur.
* `public-data.spec.ts` : Consultation des offres France Travail, absence de confusion avec InteriMatch, résilience aux données hostiles / partielles.
* `compliance.spec.ts` : Accès et navigation vers les pages légales depuis le footer, gestion des erreurs 404 avec directive `noindex`, et service statique des fichiers `robots.txt` et `sitemap.xml`.

---

## 3. Commandes d'exécution

Depuis le dossier `apps/frontend` :

```powershell
# Vérification du typage
npm run typecheck

# Analyse statique du code
npm run lint

# Exécution des 230 tests Vitest
npm test

# Exécution des tests avec mesure de couverture
npm run test:coverage

# Compilation de production
npm run build

# Exécution de la suite E2E Playwright
npm run test:e2e
```
