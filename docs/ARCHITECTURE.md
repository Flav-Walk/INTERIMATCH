# Architecture — Lot 0

Deux applications indépendantes avec package et lockfile : apps/frontend et apps/backend dans leurs worktrees respectifs. Documentation commune sur main ; aucun commit.

Frontend React/TypeScript/Vite/Router : components, pages, layouts, services, hooks, styles. Routes /interimaire, /entreprise, /connexion et fallback 404 ; accueil vers Intérimaire. Aperçus sans données métier, pas de fausse protection d’accès. Tokens OKLCH, responsive, navigation clavier. Connexion chargée à la demande. Client API JSON avec bearer fourni par callback, erreurs structurées et AbortSignal via RequestInit. Client Supabase optionnel et hook de session fournisseur : aucune autorisation métier encore.

Backend Node 24/TypeScript/Express : app.ts testable séparément de server.ts, config Zod, Helmet, CORS sur origine unique, limite de 100 requêtes/minute/IP en mémoire, JSON limité à 100 Ko, erreurs centralisées, request ID serveur, logs Pino sans corps/headers/query sensibles, arrêt gracieux. Aucun trust proxy par défaut : revoir la topologie Render avant déploiement.

integrations/clients.ts prépare les factories Supabase admin, PostgreSQL et MongoDB sans connexion automatique ; config absente = erreur explicite à l’appel. Aucune migration/table/collection. services et repositories sont des emplacements documentés.

matching/config.ts centralise poids 45/25/20/10, seuils 70/60/50 et version 1.0. `events/business-event.ts` valide l’enveloppe versionnée ; `events/dispatcher.ts` signe et livre les événements à n8n avec retries bornés. Les services worker, missions et candidatures publient après commit. Il n’existe pas encore d’outbox persistante.

## Lots suivants

Auth classique backend + Google Supabase (D01), session applicative et permissions serveur. PostgreSQL source de vérité ; contrôle de propriété et privilèges/RLS restrictifs. MongoDB pour traces désensibilisées. Une outbox transactionnelle reste à ajouter pour garantir la reprise des événements après un arrêt du processus. n8n possède les emails métier ; backend les emails auth via EmailService à créer. Pas de service ATS séparé.

Vercel déploiera frontend depuis apps/frontend ; Render backend depuis apps/backend. Aucun déploiement effectué.

## Workflow documentaire

Après le commit d'une décision `accepted`, `ApplicationService` appelle
`ContractService`. Celui-ci fige les données PostgreSQL réelles, crée au plus un
contrat par candidature, génère le PDF avec `pdf-lib` et l'archive dans le bucket
Supabase privé `contract-documents`. Un échec documentaire n'annule jamais
l'acceptation déjà committée.

Machine d'état : `draft` → `awaiting_worker_signature` →
`awaiting_company_signature` → `awaiting_finalization` → `completed`. Une
mission annulée place les documents non finalisés en `cancelled`. PostgreSQL
garantit les relations, l'unicité, l'immutabilité et les transitions ; le service
verrouille la ligne pendant chaque validation.

Les intentions d'email sont persistées transactionnellement puis livrées via
Brevo API v3 après commit et reprises au démarrage. n8n reste inchangé pour les
événements existants mais n'intervient pas dans ce workflow.

La migration 011 ajoute `contracts` (source, snapshot, état, chemins privés et
empreintes), `contract_signature_events` (journal logique, une validation par
rôle) et `contract_email_deliveries` (outbox, tentatives et état). Le
récupérateur s'exécute au boot puis toutes les 60 secondes pour reprendre PDF et
emails ; une revendication `sending` abandonnée depuis cinq minutes redevient
éligible. L'UUID persistant de chaque livraison est également transmis à Brevo
comme en-tête de message `Idempotency-Key` lors de chaque reprise.
