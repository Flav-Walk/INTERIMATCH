# Vérifications — Lot 1 terminé

## Résultats du Lot 1

Exécution complète le 16 septembre 2026 dans les deux applications. Tous les chiffres ci-dessous proviennent d'exécutions réelles, pas d'estimations.

| Vérification | Backend | Frontend |
| --- | --- | --- |
| `npm run typecheck` | réussi | réussi |
| `npm run lint` | réussi | réussi |
| `npx prettier --check .` | réussi | réussi |
| `npm test` | **42 tests réussis, 0 échec** (4 fichiers) | **17 tests réussis, 0 échec** (3 fichiers) |
| `npm run build` | réussi | réussi |
| `npm run test:e2e` | — | **8 tests réussis, 0 échec** (desktop + mobile) |

Coverage lignes : backend **87,60 %** (87,84 % instructions, 80 % branches) ; frontend **94,73 %** sur la couche logique (93,65 % instructions). Rapports HTML et JSON dans `coverage/` de chaque application.

### Portée du coverage, et pourquoi

Backend : `src/server.ts` et `src/scripts/**` sont exclus. Ce sont des points d'entrée qui s'exécutent à l'import (top-level await, connexion, `process.exit`) ; ils sont vérifiés par exécution réelle — `db:migrate`, `db:seed`, `db:check` ci-dessous — et non par test unitaire.

Frontend : Vitest mesure `src/services/**`, la couche logique. Les vues React (`pages`, `layouts`, `components`) sont couvertes par la suite Playwright, qui traverse les parcours complets dans un vrai navigateur. Les deux chiffres sont rapportés séparément et ne sont pas fusionnés : additionner un pourcentage Vitest et des parcours navigateur produirait un nombre qui ne veut rien dire.

## Ce que les tests vérifient réellement

### Backend — 42 tests

`src/app.test.ts` (10) : healthcheck sans service externe, en-têtes de sécurité, absence de `x-powered-by`, `X-Request-Id`, 404 structuré, JSON malformé sans fuite du parseur, corps trop volumineux, CORS limité à l'origine configurée, limiteur à 100 requêtes, validation de configuration sans exposer de valeur, échec explicite des factories non configurées, vérification TLS active par défaut et refus de `DB_SSL_INSECURE` en production.

`src/auth/accounts.test.ts` (24) : suite exécutée sur un **vrai moteur PostgreSQL** éphémère (PGlite) avec la migration réelle, pas sur des mocks.

- Sessions : refus sans jeton, refus d'un jeton invalide, expiration de l'access, renouvellement par cookie, invalidation du bearer précédent, refus d'un refresh expiré, révocation du bearer et du refresh au logout.
- Inscription/connexion : validation email et mot de passe, hash stocké au format `$argon2id$` et jamais égal au mot de passe, cookie HttpOnly, inscription en double refusée atomiquement, mot de passe faux et compte inconnu traités identiquement, compte désactivé refusé à la connexion comme sur une session existante.
- Origine : une requête d'authentification sans l'en-tête Origin attendu est refusée.
- Rôles : `admin` refusé en auto-attribution, choix du rôle verrouillé après coup, espace intérimaire interdit à une entreprise et inversement, onboarding de l'autre rôle refusé.
- Onboarding : entrée incomplète refusée, persistance transactionnelle complète relue via `/me`, compétence inconnue refusée, champ non déclaré refusé, profil entreprise créé sans modifier le profil intérimaire.
- Google : absence de bridge signalée en 503, identité Google créant **un seul** profil InteriMatch réutilisé à la connexion suivante, aucun credential fabriqué pour un compte provider, convergence sur les mêmes règles de rôle et d'onboarding que l'auth classique, et refus explicite de fusionner une identité Google avec un compte mot de passe de même email.

`src/events/business-event.test.ts` (4) et `src/matching/config.test.ts` (4) : verrouillent les contrats documentés — enveloppe stricte avec clé d'idempotence obligatoire et version épinglée ; poids 45/25/20/10 totalisant 100, seuils 70/60/50 ordonnés, configuration gelée et versionnée. Ces tests existent pour qu'une modification silencieuse de D04 casse la suite.

### Frontend — 17 tests

`src/services/api.test.ts` (5) : échec explicite sans configuration, préfixe et bearer, conservation de l'erreur serveur et du request id, succès vide 204, refus d'une cible absolue.

`src/services/session.test.ts` (7) : routage post-connexion (sans rôle → choix du rôle ; rôle sans onboarding → onboarding du rôle ; onboarding complet → espace ; `admin` sans espace inventé) et messages d'erreur (explication serveur conservée, réseau injoignable expliqué sans jargon, valeur non-Error jamais divulguée).

`src/services/session.retry.test.ts` (5) : renouvellement silencieux d'un bearer expiré puis rejeu de l'appel initial, signal `session-expired` sans boucle quand le renouvellement échoue, absence de renouvellement sur un échec de connexion, envoi systématique des credentials pour que le cookie de refresh circule, et partage d'un seul renouvellement entre appels concurrents.

### Navigateur — 8 tests Playwright

`e2e/foundation.spec.ts`, exécuté sur deux projets (Desktop Chrome et iPhone 13/Chromium), contre un backend réel branché sur PGlite (`src/scripts/test-server.ts`) : aucun service distant n'est appelé.

- Garde anonyme : `/worker` et `/company` renvoient vers `/login`, navigation vers l'inscription, erreur d'identifiants affichée en `role="alert"`.
- Parcours complet ×2 rôles : inscription → choix du rôle → tentative de contournement de l'onboarding (refusée) → formulaire complet → espace → rechargement conservant la session → tentative d'accès à l'espace de l'autre rôle (refusée) → absence de débordement horizontal → capture d'écran → page profil → déconnexion → `/worker` de nouveau protégé. Aucune erreur JavaScript tolérée : la liste `pageerror` doit être vide.
- Retour Google en erreur : `?error=access_denied` affiche un message d'annulation, et le premier `Tab` atteint le lien d'évitement.

## Vérifications exécutées hors suites automatisées

Contre le **vrai** projet Supabase, via le Session Pooler (voir D08) :

- `npm run db:migrate` → `Applied 001_accounts.sql`. Relancé : aucune réapplication, le checksum est reconnu.
- `npm run db:check` → clé publiable OK, clé serveur OK, PostgreSQL authentifié, 10 tables applicatives listées. Une table `test` sans rapport avec InteriMatch préexiste dans le schéma `public` ; elle n'a pas été touchée.
- `npm run db:seed` → `jimmy.worker@example.test` et `jimmy.company@example.test` créés. Relancé : toujours 2 profils, 6 liens de compétences, 3 disponibilités, 2 expériences, 8 compétences au catalogue, 1 migration. Aucun doublon.
- Serveur `npm run dev` puis parcours HTTP réel : login 200 avec cookie HttpOnly, `/me` 200 avec rôle/compétences/disponibilités attendus, `/companies/me` 403 pour un intérimaire, logout 204, `/me` 401 après logout.
- Chemins d'erreur réels : jeton Google invalide → 401 INVALID_GOOGLE_TOKEN ; absence d'Origin → 403 INVALID_ORIGIN ; mot de passe faux → 401 INVALID_CREDENTIALS ; inscription en double → 409 ACCOUNT_UNAVAILABLE.
- Logs Pino inspectés : method, status, durée et request id uniquement. Aucun corps, en-tête, mot de passe, jeton ni clé.

Le parcours Google complet dans un navigateur n'a **pas** été exécuté : il exige une connexion interactive à un compte Google réel. Le provider est activé côté Supabase (vérifié : `google, email`), la validation serveur du JWT est testée, mais le trajet bout en bout reste à confirmer manuellement par Flavien.

## Commandes

```powershell
# Dans chaque application
npm run typecheck ; npm run lint ; npx prettier --check . ; npm run test:coverage ; npm run build
# Frontend seulement, première fois : npx playwright install chromium
npm run test:e2e
# Backend seulement, base requise
npm run db:migrate ; npm run db:check ; npm run db:seed
```

## Avertissements restants

Vite/Rolldown signale les directives `use client` de React Router et Lucide dans cette SPA : build réussi, parcours navigateur validés. npm signale le script d'installation esbuild non approuvé, sans effet sur les outils exécutés. Playwright a nécessité `node --use-system-ca node_modules/playwright/cli.js install chromium` lors de l'installation initiale, sans désactiver TLS.

## Tests critiques des lots suivants

Profils/missions : validation et contrôle du propriétaire. Matching : cas nominaux et limites de D04, passage de minuit, intervalles contigus, disponibilité partielle, géolocalisation manquante, égalités, poids/seuils invalides et paliers. Propositions : n'accepter ou refuser que les siennes, idempotence, expiration, mission fermée. Attribution : capacité et conflits sous concurrence, avec tests d'intégration PostgreSQL réels. Événements : un rollback ne produit aucun envoi, doublon, signature invalide, retry et panne externe. E2E : entreprise publie → candidat reçoit et accepte → entreprise attribue → mission pourvue.

Le Lot 8 consolide les preuves, il ne reporte pas les tests jusque-là.
