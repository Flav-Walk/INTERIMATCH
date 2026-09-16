# Architecture — Lot 1

Deux applications indépendantes, chacune avec son `package.json` et son lockfile : `apps/frontend` et `apps/backend`, dans leurs worktrees respectifs. Documentation commune sur `main`.

## Frontend — React 19 / TypeScript / Vite / React Router

`src/` : `components`, `pages`, `layouts`, `services`, `hooks`, `styles`.

**Routes.** `/` accueil public ; `/login` et `/register` sous `PublicRoute` ; `/auth/callback` ; `/onboarding/role`, `/onboarding/worker`, `/onboarding/company` sous `ProtectedRoute onboarding` ; `/worker`, `/worker/profile`, `/company`, `/company/profile` sous `ProtectedRoute role` ; redirections de compatibilité `/connexion`, `/interimaire`, `/entreprise` ; 404 explicite.

**Gardes.** `ProtectedRoute` attend la fin du chargement de session avant de décider, distingue « non connecté » (redirection vers `/login`) de « service injoignable » (écran de reprise, pour ne pas déconnecter sur une panne réseau), puis applique une règle unique : `destination(user)` place chaque compte au seul endroit légitime selon son rôle et son état d'onboarding. Un intérimaire n'atteint pas `/company`, un compte sans onboarding n'atteint pas son espace, un compte terminé ne revient pas dans l'onboarding. La garde est un confort d'interface : l'autorisation réelle est refaite côté serveur à chaque requête.

**Session.** `services/session.ts` garde le bearer **en mémoire** — jamais dans `localStorage` ni `sessionStorage`, donc hors de portée d'un script injecté. La persistance entre rechargements vient du cookie `im_refresh` HttpOnly : au démarrage, `AuthProvider` tente un `/auth/refresh` puis `/me`. Un 401 sur une route métier déclenche un renouvellement unique — partagé entre appels concurrents — puis rejoue l'appel ; si le renouvellement échoue, un événement `session-expired` vide l'état sans boucler.

**Supabase.** `services/supabase.ts` n'instancie le client que si l'URL et la clé publiable sont présentes, en PKCE avec `detectSessionInUrl: false` : l'échange du code est fait explicitement par la page `/auth/callback`, pas par un effet de bord au chargement. Le JWT Supabase obtenu n'est utilisé qu'une fois, pour être présenté au backend. Il n'est jamais envoyé aux routes métier.

**Style.** Tokens OKLCH dans `styles/tokens.css`, dérivés de `image.png` : vert forêt, orange d'accent, fond crème, rayon 12 px. Responsive à 900 px et 560 px. Focus visible, lien d'évitement, `role="alert"` sur les erreurs, `role="status"` sur les chargements, libellés associés, `prefers-reduced-motion` respecté.

## Backend — Node 24 / TypeScript / Express 5

`app.ts` est construit séparément de `server.ts` pour être testable sans écouter un port. Config Zod, Helmet, CORS sur une origine unique, limite de 100 requêtes/minute/IP en mémoire, JSON limité à 100 Ko, erreurs centralisées, request id serveur, logs Pino sans corps ni en-têtes, arrêt gracieux. Aucun `trust proxy` par défaut : la topologie Render doit être revue avant déploiement.

**Module auth** (`src/auth/`) :

- `schemas.ts` — schémas Zod stricts. Tout champ non déclaré est rejeté, ce qui empêche notamment d'injecter `role` dans un corps d'onboarding.
- `service.ts` — logique métier. Argon2id (19456 Kio, 2 passes) via la bibliothèque `argon2`, aucune cryptographie maison. Les jetons sont 32 octets aléatoires ; seul leur SHA-256 est stocké. Une vérification Argon2 factice est exécutée pour un compte inconnu afin d'égaliser les temps de réponse.
- `routes.ts` — transport. `requireAuth` relit le profil en base à chaque requête ; `requireRole` refuse un espace qui ne correspond pas au rôle persisté. Un contrôle d'`Origin` couvre les routes d'authentification, et un limiteur dédié de 30 tentatives par quart d'heure freine le brute force.

**Convergence des deux authentifications.** Auth classique et Google produisent le **même** profil applicatif et la **même** session opaque. Google est vérifié côté serveur (`supabase.auth.getUser`) : email confirmé et identité `google` exigés. Le rattachement se fait sur `auth_user_id`, jamais sur la seule égalité d'email — un email déjà lié à un compte mot de passe donne 409 IDENTITY_CONFLICT plutôt qu'une fusion silencieuse. Un verrou consultatif transactionnel sérialise les premières connexions Google concurrentes de la même identité, pour qu'il n'en résulte qu'un profil.

**Base.** `db.ts` expose `query` et `transaction` ; toutes les écritures multi-tables de l'onboarding passent par une transaction. `migrations/001_accounts.sql` crée `profiles`, `credentials`, `sessions`, `worker_profiles`, `company_profiles`, `skills`, `worker_skills`, `experiences`, `availabilities`, active RLS et révoque `anon`/`authenticated` sur chacune : l'accès passe uniquement par l'API, pas par PostgREST. `scripts/migrate.ts` applique les fichiers sous verrou consultatif avec table de suivi et checksum.

`integrations/clients.ts` prépare les factories Supabase admin, PostgreSQL et MongoDB sans connexion automatique ; une configuration absente produit une erreur explicite à l'appel. MongoDB reste non utilisé au Lot 1.

`matching/config.ts` centralise poids 45/25/20/10, seuils 70/60/50 et version 1.0, sans moteur. `events/business-event.ts` valide l'enveloppe versionnée, sans émetteur ni dispatcher ni outbox.

## Ce qui n'existe pas encore

Missions, matching, propositions, attribution, outbox, émission d'événements, webhooks n8n, EmailService/Brevo, MongoDB, administration, réinitialisation de mot de passe, vérification d'email, signature et retry.

## Lots suivants

PostgreSQL reste la source de vérité ; MongoDB recevra les traces de calcul désensibilisées. Moteur de matching en TypeScript pur et déterministe. Attribution en transaction atomique avec outbox transactionnelle. n8n possède les emails métier ; le backend possède les emails d'auth via un EmailService à créer.

Vercel déploiera le frontend depuis `apps/frontend`, Render le backend depuis `apps/backend`. Aucun déploiement effectué.
