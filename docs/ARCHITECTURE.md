# Architecture — Lot 2

Deux applications indépendantes, chacune avec son `package.json` et son lockfile : `apps/frontend` et `apps/backend`, dans leurs worktrees respectifs. Documentation commune sur `main`.

## Frontend — React 19 / TypeScript / Vite / React Router

`src/` : `components`, `pages`, `layouts`, `services`, `hooks`, `styles`.

**Routes.** `/` accueil public ; `/login` et `/register` sous `PublicRoute` ; `/auth/callback`. Deux espaces cloisonnés sous `ProtectedRoute role` :

| Espace intérimaire | Espace entreprise |
| --- | --- |
| `/worker` tableau de bord | `/company` tableau de bord |
| `/worker/profile` profil | `/company/profile` établissement |
| `/worker/missions` propositions | `/company/missions` missions |
| — | `/company/candidates` candidats |

Redirections de compatibilité `/connexion`, `/interimaire`, `/entreprise` ; 404 explicite.

**Gardes.** `ProtectedRoute` attend la fin du chargement de session avant de décider — aucun clignotement d'interface pendant la restauration — et distingue « non connecté » (redirection vers `/login`) de « service injoignable » (écran de reprise, pour ne pas déconnecter sur une panne réseau). `destination(user)` place ensuite chaque compte dans l'espace de son rôle. La garde est un confort d'interface : l'autorisation réelle est refaite côté serveur à chaque requête, qui relit le rôle en base et répond 403 pour un espace étranger. Saisir `/company` en intérimaire ne donne donc accès à rien, même si la garde était contournée.

**Visite guidée.** `components/GuidedTour.tsx` découpe un trou dans un voile sombre à l'aplomb de la cible (masque SVG), l'entoure d'un anneau, et place une bulle à côté. La cible est désignée par un attribut `data-tour` ; les étapes vivent dans `services/tours.ts`, une liste par rôle. La bulle n'est ancrée à la cible que si elle y tient entièrement, sinon elle se range en bas de l'écran — comportement systématique sous 720 px. La cible est amenée dans le viewport avant mesure, et la position est recalculée au redimensionnement et au défilement, de sorte qu'aucune étape ne désigne un élément hors écran. Clavier : `Échap` passe, les flèches naviguent, le focus entre dans la bulle à chaque étape, l'ensemble est un `role="dialog"` `aria-modal`. La visite ne démarre que sur le tableau de bord, seul écran portant toutes les ancres.

**Session.** `services/session.ts` garde le bearer **en mémoire** — jamais dans `localStorage` ni `sessionStorage`, donc hors de portée d'un script injecté. La persistance entre rechargements vient du cookie `im_refresh` HttpOnly : au démarrage, `AuthProvider` tente un `/auth/refresh` puis `/me`. Un 401 sur une route métier déclenche un renouvellement unique — partagé entre appels concurrents — puis rejoue l'appel ; si le renouvellement échoue, un événement `session-expired` vide l'état sans boucler.

**Supabase.** `services/supabase.ts` n'instancie le client que si l'URL et la clé publiable sont présentes, en PKCE avec `detectSessionInUrl: false` : l'échange du code est fait explicitement par la page `/auth/callback`, pas par un effet de bord au chargement. Le JWT Supabase obtenu n'est utilisé qu'une fois, pour être présenté au backend. Il n'est jamais envoyé aux routes métier.

**Style.** Tokens OKLCH dans `styles/tokens.css`, dérivés de `image.png` : vert forêt, orange d'accent, fond crème, rayon 12 px. Responsive à 900 px et 560 px. Focus visible, lien d'évitement, `role="alert"` sur les erreurs, `role="status"` sur les chargements, libellés associés, `prefers-reduced-motion` respecté.

## Backend — Node 24 / TypeScript / Express 5

`app.ts` est construit séparément de `server.ts` pour être testable sans écouter un port. Config Zod, Helmet, CORS sur une origine unique, limite de 100 requêtes/minute/IP en mémoire, JSON limité à 100 Ko, erreurs centralisées, request id serveur, logs Pino sans corps ni en-têtes, arrêt gracieux. Aucun `trust proxy` par défaut : la topologie Render doit être revue avant déploiement.

**Rôles.** Le rôle n'est pas une entrée utilisateur (D11). Un déclencheur `BEFORE INSERT` sur `profiles` lit `company_accounts` : adresse présente → `company`, sinon → `worker`. `login` et `google` réappliquent la règle, pour qu'une adresse ajoutée après coup prenne effet à la connexion suivante. Ajouter une entreprise est un `INSERT`, pas un déploiement. `profiles.role` est `NOT NULL` et aucun endpoint ne permet de le choisir.

**Vocabulaire métier.** `src/domain/reference.ts` déclare secteurs et statuts ATS une seule fois, servis par `GET /api/v1/reference` pour que l'interface ne les redéclare pas.

**Module auth** (`src/auth/`) :

- `schemas.ts` — schémas Zod stricts. Tout champ non déclaré est rejeté, ce qui empêche notamment d'injecter `role` dans un corps d'onboarding.
- `service.ts` — logique métier. Argon2id (19456 Kio, 2 passes) via la bibliothèque `argon2`, aucune cryptographie maison. Les jetons sont 32 octets aléatoires ; seul leur SHA-256 est stocké. Une vérification Argon2 factice est exécutée pour un compte inconnu afin d'égaliser les temps de réponse.
- `routes.ts` — transport. `requireAuth` relit le profil en base à chaque requête ; `requireRole` refuse un espace qui ne correspond pas au rôle persisté. Un contrôle d'`Origin` couvre les routes d'authentification, et un limiteur dédié de 30 tentatives par quart d'heure freine le brute force.

**Convergence des deux authentifications.** Auth classique et Google produisent le **même** profil applicatif et la **même** session opaque. Google est vérifié côté serveur (`supabase.auth.getUser`) : email confirmé et identité `google` exigés. Le rattachement se fait sur `auth_user_id`, jamais sur la seule égalité d'email — un email déjà lié à un compte mot de passe donne 409 IDENTITY_CONFLICT plutôt qu'une fusion silencieuse. Un verrou consultatif transactionnel sérialise les premières connexions Google concurrentes de la même identité, pour qu'il n'en résulte qu'un profil.

**Base.** `db.ts` expose `query` et `transaction` ; toutes les écritures multi-tables du profil passent par une transaction. `migrations/001_accounts.sql` crée `profiles`, `credentials`, `sessions`, `worker_profiles`, `company_profiles`, `skills`, `worker_skills`, `experiences`, `availabilities` ; `migrations/002_roles_and_tour.sql` ajoute `company_accounts`, le déclencheur d'attribution de rôle et `profiles.tour_version`. RLS est activée et `anon`/`authenticated` révoqués sur chaque table : l'accès passe uniquement par l'API, pas par PostgREST. `scripts/migrate.ts` applique les fichiers sous verrou consultatif avec table de suivi et checksum.

`integrations/clients.ts` prépare les factories Supabase admin, PostgreSQL et MongoDB sans connexion automatique ; une configuration absente produit une erreur explicite à l'appel. MongoDB reste non utilisé au Lot 1.

`matching/config.ts` centralise poids 45/25/20/10, seuils 70/60/50 et version 1.0, sans moteur. `events/business-event.ts` valide l'enveloppe versionnée, sans émetteur ni dispatcher ni outbox.

## Ce qui n'existe pas encore

Missions, matching, propositions, attribution, outbox, émission d'événements, webhooks n8n, EmailService/Brevo, MongoDB, administration, réinitialisation de mot de passe, vérification d'email, signature et retry. Les statuts de mission et de candidature sont déclarés mais aucune transition n'est implémentée. Le questionnaire intérimaire détaillé (préférences, contraintes, types de contrats, qualifications) reste à construire : le formulaire de profil actuel en couvre le socle — métier, compétences, expérience, localisation, mobilité, disponibilité.

## Lots suivants

PostgreSQL reste la source de vérité ; MongoDB recevra les traces de calcul désensibilisées. Moteur de matching en TypeScript pur et déterministe. Attribution en transaction atomique avec outbox transactionnelle. n8n possède les emails métier ; le backend possède les emails d'auth via un EmailService à créer.

Vercel déploiera le frontend depuis `apps/frontend`, Render le backend depuis `apps/backend`. Aucun déploiement effectué.
