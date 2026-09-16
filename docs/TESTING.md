# Vérifications — Lot 0 terminé

## Résultats actuels

Le 16 septembre 2026, dans chaque application : dépendances installées, typecheck, lint, tests avec coverage et build réussis. Backend : 8 tests ; frontend : 5 tests unitaires et 4 tests Playwright (desktop/mobile Chromium). Smoke test du backend compilé sur le port temporaire 3099 : GET /api/v1/health → 200 avec le JSON documenté ; processus arrêté après contrôle.

Tests backend : healthcheck sans services externes, headers, 404, JSON invalide, corps trop volumineux, CORS, rate limiting, config et factories non configurées. Frontend : client API, erreur serveur, bearer, réponse vide, refus de cible absolue ; navigateur : routes des deux rôles, 404, connexion désactivée explicitement, absence de débordement, lien d’évitement clavier, absence d’erreur JavaScript. Captures desktop/mobile inspectées ; correction de l’encodage des accents effectuée avant la validation finale.

Coverage Vitest (lignes) : backend **88,88 %**, frontend **53,19 %**. Rapports HTML et JSON dans coverage/ de chaque application. La couverture frontend inclut les composants TSX non couverts par les tests unitaires ; les parcours Playwright ne sont pas fusionnés dans ce chiffre. Connexions externes non testées, aucune couverture métier revendiquée.

Commandes : npm run typecheck ; npm run lint ; npm run test:coverage ; npm run build. Frontend : npm run test:e2e. Les tests Vitest sont limités aux sources pour ne pas exécuter les artefacts compilés.

Avertissements restants : Vite/Rolldown signale les directives use client de React Router/Lucide dans cette SPA ; build réussi et parcours navigateur validés. npm signale le script d’installation esbuild non approuvé, sans empêcher les outils exécutés. Playwright a initialement rencontré un certificat manquant ; installation réussie avec `node --use-system-ca node_modules/playwright/cli.js install chromium`, sans désactiver TLS.

## Exécuté pendant l’audit

- Lecture des six sources et extraction de toutes les pages/slides.
- Consultation Git : échec explicite, absence de dépôt.
- Inspection de la documentation et des modèles d’environnement.

Lors de l’audit initial seulement, aucun test applicatif n’était possible. Ce constat est désormais remplacé par les résultats ci-dessus.

## Reprise du Lot 0

Prévoir scripts `typecheck`, `lint`, `test`, `test:coverage`, `build`. Backend : tests du healthcheck, 404, validation de configuration, format d’erreur, CORS et headers de sécurité. Frontend : compilation, navigation de base, erreurs de configuration explicites et inspection responsive/clavier. Vérifier que les secrets serveur n’apparaissent jamais dans le build navigateur.

## Tests critiques à chaque lot

Auth : inscription/login classiques, mot de passe hashé, session invalide/expirée/révoquée, validation Google, refus d’escalade admin et d’accès aux ressources d’autrui. Profils/missions : validation et propriétaire. Matching : cas nominaux et limites de D04, minuit, intervalles contigus, disponibilité partielle, géolocalisation manquante, égalités, poids/seuils invalides et paliers.

Propositions : accepter/refuser uniquement les siennes, idempotence, expiration, mission fermée. Attribution : capacité et conflits sous concurrence avec tests d’intégration PostgreSQL réels. Événements : rollback ne produit pas d’envoi, doublon, signature invalide, retry et panne externe. E2E : entreprise publie → candidat reçoit/accepte → entreprise attribue → mission pourvue.

Coverage généré et conservé comme livrable final ; pas de pourcentage revendiqué avant exécution. Le Lot 8 consolide les preuves, il ne reporte pas les tests jusque-là.
