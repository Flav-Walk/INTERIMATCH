# InteriMatch — frontend

Node 24. SPA React 19 / TypeScript / Vite 8 / React Router 7 : accueil public, pages légales, connexion et inscription, connexion Google, onboarding Intérimaire et Entreprise, espaces protégés, consultation des offres France Travail, gestion des missions et candidatures.

## Déploiement

* **Production (Vercel) :** `https://interimatch-five.vercel.app`
* Routage SPA et fichiers statiques (`robots.txt`, `sitemap.xml`) configurés dans `vercel.json`.

## Démarrer en local

```powershell
npm ci
npm run dev
```

Application disponible sur `http://localhost:5173`. Le backend doit tourner sur `http://localhost:3000` avec une base configurée, sinon la connexion échouera avec un message explicite.

## Environnement

Fichier `.env.local` (voir `.env.example`) :
* `VITE_API_URL` : URL de l'API (inclut `/api/v1`).
* `VITE_SUPABASE_URL` : URL de l'instance Supabase.
* `VITE_SUPABASE_PUBLISHABLE_KEY` : Clé anonyme publiable.

> **Sécurité :** Seules les variables préfixées par `VITE_` sont exposées au navigateur. Jamais de clé de service secrète dans le frontend.

## Session et sécurité

* Le jeton d'accès (bearer) est conservé **strictement en mémoire**, jamais dans `localStorage`.
* La persistance de session s'appuie sur le cookie `im_refresh` avec attribut `HttpOnly` émis par le backend.
* En cas d'expiration (401), un rafraîchissement transparent unique est déclenché avant de rejouer la requête.

## Données publiques France Travail

* Espace intérimaire : section dédiée « Offres France Travail » (`/worker/public-offers`).
* Les offres publiques sont strictement séparées des missions internes (aucun matching, aucune candidature InteriMatch).
* Redirection vers le portail officiel externe `candidat.francetravail.fr` pour postuler.

## Vérifications et tests

```powershell
# Typage et analyse statique
npm run typecheck
npm run lint

# Tests unitaires et intégration (230 tests validés)
npm test
npm run test:coverage

# Compilation de production
npm run build

# Tests End-to-End Playwright (desktop et mobile)
npm run test:e2e
```

* **Vitest :** 230 tests couvrant les services, hooks, composants, pages légales (`/mentions-legales`, `/politique-confidentialite`, `/accessibilite`), SEO et accessibilité.
* **Playwright :** 66 tests (desktop et mobile) validant les parcours utilisateur complets, démarrant localement un serveur Vite et une API de test avec base PGlite éphémère (aucun secret ni service distant requis).
