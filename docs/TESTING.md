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

## Frontière production / test / démo

- Le serveur Playwright et le serveur de démonstration construisent chacun leur propre `PGlite` en mémoire. Ils ne lisent jamais `DATABASE_URL` et n'appellent aucun service distant.
- `db:seed` exige à la fois `NODE_ENV` hors production, `ALLOW_DEMO_SEED=true` et une URL PostgreSQL dont l'hôte est la boucle locale. Une URL Supabase ou toute autre cible distante est refusée avant ouverture de connexion.
- Les fixtures France Travail versionnées sont refusées sur une base distante. Un import distant réel exige explicitement `NODE_ENV=production` et un fichier hors du répertoire de fixtures.
- Le serveur de production refuse les inscriptions, connexions et sessions portant un domaine réservé `.test`. Les tests locaux les autorisent volontairement.
- Ces barrières protègent les chemins applicatifs et les scripts livrés. Un accès SQL privilégié reste capable d'écrire directement : les droits et procédures Supabase demeurent donc une frontière opérationnelle obligatoire.

## Workflow documentaire

`contracts.test.ts` applique toutes les migrations dans PGlite et couvre
candidature non acceptée, unicité, PDF serveur, snapshot immuable, ordre et
idempotence des validations, finalisation, outbox, panne email sans rollback,
listes, IDOR et téléchargement. `email.test.ts` remplace `fetch` : aucun test ne
contacte Brevo et les logs sont vérifiés sans secret ni contenu. La configuration
absente ou partielle est testée séparément.

Le premier scénario `e2e/applications.spec.ts` est full-stack : acceptation,
création, validation worker, validation entreprise, finalisation et PDF retrouvé
par les deux comptes. Il tourne en desktop et mobile avec PGlite, stockage
mémoire et email mocké ; aucun service distant n'est appelé.

### Données personnelles et conservation proposée

Le snapshot conserve identités et coordonnées, mission, rémunération, date
d'acceptation et traces de validation. PostgreSQL contient métadonnées/traces,
Supabase privé les PDF et Brevo reçoit nom, email et contenu transactionnel.
Finalité : préparer, valider et restituer le document de mission. L'accès est
limité aux deux parties authentifiées.

Aucune suppression automatique n'est implémentée. Avant production, le
responsable de traitement doit fixer base légale, information, durée de
conservation, procédure d'exercice des droits et arbitrer effacement ou
anonymisation avec les obligations de conservation contractuelle. Sauvegardes
et purge Brevo doivent intégrer cette politique.

## Lot SL2e — Données publiques France Travail

- **Normaliseur France Travail (`apps/backend/src/public-data/normalizer.test.ts`)** :
  - Extraction et normalisation sur les 2 fixtures versionnées dans `apps/backend/src/public-data/fixtures/`.
  - Cas limites vérifiés : entreprise vide, salaire vide, compétences/qualités absentes, coordonnées GPS absentes, recherches à 0 résultat, rejet des offres sans ID ou sans titre, tolérance aux champs inconnus, chaînes longues, caractères accentués, neutralisation d'URLs dangereuses.
- **Service et API (`apps/backend/src/public-data/public-data.test.ts`)** :
  - Import initial, idempotence stricte lors de ré-imports identiques, mise à jour ciblée sur modification de contenu.
  - Dédoublonnage au sein d'un même lot avec priorité à la version source la plus récente, et imports concurrents.
  - Filtrage (search, rome, location, contract_type) et pagination.
  - Consultation par UUID et par identifiant externe, ambiguïté UUID externe, autorisation worker et 404.
- **Service Frontend (`apps/frontend/src/services/publicOffers.test.ts`)** :
  - Construction des requêtes avec et sans filtres, encodage des identifiants et filtrage des URLs externes.
- **E2E Playwright (`apps/frontend/e2e/public-data.spec.ts`)** :
  - Validation sur Desktop et Mobile : connexion intérimaire, navigation, consultation de la liste et du détail, distinction stricte avec les missions InteriMatch, support des données partielles, états vide/erreur, contenu hostile rendu comme texte, lien externe dangereux neutralisé, absence d'overflow horizontal et 0 erreur console.
  - Les routes API des offres publiques sont interceptées : il s'agit d'un E2E UI, pas d'un E2E full-stack frontend/backend/PostgreSQL.
