# Architecture — Lot 0

Deux applications indépendantes avec package et lockfile : apps/frontend et apps/backend dans leurs worktrees respectifs. Documentation commune sur main ; aucun commit.

Frontend React/TypeScript/Vite/Router : components, pages, layouts, services, hooks, styles. Routes /interimaire, /entreprise, /connexion et fallback 404 ; accueil vers Intérimaire. Aperçus sans données métier, pas de fausse protection d’accès. Tokens OKLCH, responsive, navigation clavier. Connexion chargée à la demande. Client API JSON avec bearer fourni par callback, erreurs structurées et AbortSignal via RequestInit. Client Supabase optionnel et hook de session fournisseur : aucune autorisation métier encore.

Backend Node 24/TypeScript/Express : app.ts testable séparément de server.ts, config Zod, Helmet, CORS sur origine unique, limite de 100 requêtes/minute/IP en mémoire, JSON limité à 100 Ko, erreurs centralisées, request ID serveur, logs Pino sans corps/headers/query sensibles, arrêt gracieux. Aucun trust proxy par défaut : revoir la topologie Render avant déploiement.

integrations/clients.ts prépare les factories Supabase admin, PostgreSQL et MongoDB sans connexion automatique ; config absente = erreur explicite à l’appel. Aucune migration/table/collection. services et repositories sont des emplacements documentés.

matching/config.ts centralise poids 45/25/20/10, seuils 70/60/50 et version 1.0, sans moteur. events/business-event.ts valide l’enveloppe versionnée, sans émetteur/dispatcher/outbox.

## Lots suivants

Auth classique backend + Google Supabase (D01), session applicative et permissions serveur. PostgreSQL source de vérité ; contrôle de propriété et privilèges/RLS restrictifs. MongoDB pour traces désensibilisées. Matching pur TypeScript, transactions atomiques et outbox transactionnelle. n8n possède les emails métier ; backend les emails auth via EmailService à créer. Signature/retry/idempotence non implémentés. Pas de service ATS séparé.

Vercel déploiera frontend depuis apps/frontend ; Render backend depuis apps/backend. Aucun déploiement effectué.
