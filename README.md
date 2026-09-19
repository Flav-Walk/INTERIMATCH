# InteriMatch — Frontend

Plateforme de mise en relation dans le secteur de l'hôtellerie-restauration (POC EPITECH). Ce dépôt correspond à la branche `frontend` (worktree `InteriMatch-frontend`) au terme du **Lot 8** (sous-lots 8A, 8B, 8C et 8D).

---

## 1. Stack technique

* **Environnement :** Node 24, npm 11
* **Framework :** React 19, React Router 7 (SPA)
* **Outillage :** Vite 8 / Rolldown, TypeScript 6
* **Styles :** CSS moderne (tokens OKLCH, responsive mobile-first, conformité accessibilité)
* **Qualité & Tests :** Vitest 5 (tests unitaires & intégration), Playwright 1.63 (tests E2E), ESLint 10, Prettier

---

## 2. Architecture Frontend

L'application est organisée en modules clairs dans `apps/frontend/src/` :
* `components/` : Éléments d'interface réutilisables (modale native `ConfirmDialog`, boîte de dialogue `GuidedTour`, badges de matching, formulaires avec gestion d'erreurs d'accessibilité).
* `pages/` : Vues applicatives chargées à la demande (`React.lazy()` / `Suspense`) pour préserver les performances et respecter les principes d'écoconception (RGESN).
* `layouts/` : Gabarit principal (`AppLayout`) intégrant les repères sémantiques HTML5, le lien d'évitement (`.skip-link`), la navigation principale et le pied de page légal.
* `hooks/` : Gestion du contexte d'authentification (`AuthContext`), des données entreprise (`CompanyData`) et des métadonnées SEO dynamiques (`usePageSeo`).
* `services/` : Client API typé, gestion de session sécurisée (jeton en mémoire, cookie HttpOnly `im_refresh`), services métier (missions, candidatures, offres publiques).

---

## 3. Fonctionnalités présentes

* **Accueil & Pages légales :**
  * Accueil public (`/`).
  * Pages de conformité : `/mentions-legales`, `/politique-confidentialite`, `/accessibilite`.
* **Authentification & Gestion des accès :**
  * Connexion et inscription classique (email / mot de passe fort).
  * Authentification Google (via Supabase Auth).
  * Cloisonnement strict des espaces selon le rôle (`worker`, `company`, `admin`).
* **Espace Intérimaire (`/worker`) :**
  * Tableau de bord synthétique, visite guidée interactive.
  * Gestion du profil (métiers, compétences, mobilité, créneaux de disponibilité).
  * Consultation des missions compatibles avec affichage transparent du score de matching et explication détaillée des critères.
  * Suivi des candidatures et historique des missions.
  * Consultation des offres publiques France Travail (`/worker/public-offers`).
* **Espace Entreprise (`/company`) :**
  * Tableau de bord, gestion du profil établissement.
  * Création, modification (avec calcul de diff) et publication de propositions de mission.
  * Examen des candidatures reçues, acceptation, refus et attribution des postes.
* **Espace Administration (`/admin`) :**
  * Supervision des utilisateurs et attribution des rôles.

---

## 4. Données publiques France Travail

* **Isolation complète :** Les offres d'emploi publiques sont stockées dans une table dédiée `public_job_offers`, distincte des missions internes.
* **Absence de confusion :** Aucun matching automatique ni calcul de score n'est effectué sur les offres publiques. Aucun bouton de candidature interne InteriMatch n'est affiché.
* **Redirection externe :** Chaque offre dispose d'un lien sécurisé (`target="_blank"`, `rel="noopener noreferrer"`) renvoyant directement vers le portail `candidat.francetravail.fr`.
* **Alimentation :** Données importées de manière reproductible via un script CLI backend depuis un jeu de données représentatif (fixture). Le connecteur live temps réel à l'API France Travail n'est pas encore activé.

---

## 5. Conformité, Accessibilité et SEO (Lot 8)

* **RGPD (8A) :** Minimisation des données collectées, absence totale de cookies tiers ou traceurs publicitaires, stockage sécurisé du jeton d'accès en mémoire applicative.
* **SEO (8B) :**
  * Domaine canonique : `https://interimatch-five.vercel.app`.
  * Indexation autorisée (`index,follow`) sur les 4 pages publiques canoniques.
  * Directive stricte `noindex,nofollow` sur les parcours d'authentification, les espaces protégés et la page d'erreur 404 (`NotFound`).
  * Fichiers `robots.txt` et `sitemap.xml` servis statiquement à la racine.
* **Accessibilité & Écoconception (8C) :**
  * Déclaration de conformité affichant légalement « Accessibilité : non conforme » (en attente d'un audit formel complet).
  * Repères structurels HTML5, lien d'évitement, contour de focus contrasté, labels de formulaires explicites, avertissement `(nouvelle fenêtre)` sur les liens externes, piège de focus sur les modales.
  * Écoconception (RGESN) : fractionnement du bundle par route (lazy loading), pagination bornée à 12 offres sur France Travail, absence totale de requêtes en boucle (polling).
* **Consolidation (8D) :** Documentation alignée avec la réalité du code et suite de tests E2E de conformité.

Pour le détail exhaustif, consulter [docs/CONFORMITE.md](docs/CONFORMITE.md).

---

## 6. Commandes de test et vérifications

Depuis `apps/frontend` :

```powershell
# Validation des types TypeScript
npm run typecheck

# Analyse statique ESLint
npm run lint

# Tests unitaires et d'intégration Vitest (230 tests PASS)
npm test

# Compilation de production Vite
npm run build

# Tests End-to-End Playwright (66 tests PASS, desktop & mobile)
npm run test:e2e
```

---

## 7. Déploiement

* **Plateforme :** Vercel
* **URL de production :** `https://interimatch-five.vercel.app`
* **Configuration :** `apps/frontend/vercel.json` gère les réécritures SPA tout en préservant le service direct des assets statiques (`/assets/*`), de `/robots.txt` et de `/sitemap.xml`.
