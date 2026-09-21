# InteriMatch — frontend

Node 24. SPA React 19 / TypeScript / Vite / React Router : accueil public, connexion et inscription, connexion Google, choix du rôle, onboarding Intérimaire et Entreprise, espaces protégés.

## Démarrer

```powershell
npm ci
npm run dev
```

`http://localhost:5173`. Le backend doit tourner sur `http://localhost:3000` avec une base configurée, sinon la connexion échouera avec un message explicite.

## Environnement

`.env.local`, noms dans `.env.example` : `VITE_API_URL` (inclut `/api/v1`), `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

Le bouton Google n'apparaît utilisable que si l'URL et la clé publiable Supabase sont présentes ; sinon un message d'erreur invite à utiliser email et mot de passe. **Aucune clé serveur ne doit porter le préfixe `VITE_`** : tout ce qui est préfixé ainsi finit dans le bundle navigateur.

## Session

Le bearer est gardé **en mémoire**, jamais dans `localStorage`. La persistance entre rechargements vient du cookie `im_refresh` HttpOnly posé par le backend. Un 401 sur une route métier déclenche un renouvellement unique puis rejoue l'appel.

## Vérifications

```powershell
npm run typecheck ; npm run lint ; npx prettier --check . ; npm run test:coverage ; npm run build
npx playwright install chromium   # première fois
npm run test:e2e
```

La suite Playwright démarre elle-même le frontend et un backend sur moteur PostgreSQL éphémère : aucun service distant n'est appelé, et elle s'exécute sur desktop et mobile.

Vitest mesure la couche `src/services` ; les vues React sont couvertes par Playwright. Voir `docs/TESTING.md` et `docs/DECISIONS.md` D09.

Documentation commune dans le worktree voisin `Piscine Epitech/docs`. Les commits et les push sont réalisés par Flavien seul.
