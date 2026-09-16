# API réelle — Lot 1

Toutes les routes listées ici existent dans `apps/backend/src`. Rien n'est anticipé : une route absente de ce document n'est pas implémentée.

Préfixe : `/api/v1`. Local : `http://localhost:3000/api/v1`. Production prévue : `https://interimatch.onrender.com/api/v1` (non déployée).

## Disponibilité conditionnelle

`routes/health.ts` est toujours monté. Le routeur de comptes (`auth/routes.ts`) n'est monté que si `DATABASE_URL` est configurée : `server.ts` ne construit `AccountService` qu'avec une base. Sans base, toutes les routes ci-dessous sauf `/health` répondent 404 NOT_FOUND.

## Conventions

| Règle | Détail |
| --- | --- |
| Session | Bearer opaque de 32 octets, `Authorization: Bearer <access_token>`, validité 15 minutes |
| Renouvellement | Cookie `im_refresh`, HttpOnly, `path=/api/v1/auth`, validité 7 jours, `SameSite=Lax` en développement et `Secure; SameSite=None` en production |
| Stockage serveur | Seuls les SHA-256 des jetons sont en base (`sessions.access_hash`, `sessions.refresh_hash`) ; les jetons en clair n'existent que dans la réponse |
| En-tête Origin | Obligatoire et strictement égal à `FRONTEND_URL` sur toutes les routes `/auth/*`, sinon 403 INVALID_ORIGIN |
| Rôle | Lu en base à chaque requête, jamais accepté depuis le corps, l'URL ou un jeton client |
| Corps | JSON, 100 Ko maximum, schémas Zod stricts : tout champ non déclaré est refusé |

## Public

### GET /health

Public, sans base ni service externe. 200 :

```json
{ "status": "ok", "service": "interimatch-api", "version": "0.0.0" }
```

## Authentification — Origin exigé

Limite dédiée sur `register`, `login` et `google` : 30 requêtes par 15 minutes et par IP, puis 429 AUTH_RATE_LIMIT.

### POST /auth/register

Corps `{ "email": string, "password": string }`. Mot de passe : 12 à 128 caractères. L'email est normalisé en minuscules.

201 : `{ "access_token": "...", "expires_in": 900 }` + cookie `im_refresh`.

Le compte est créé sans rôle et sans onboarding : `role` vaut `null`, `onboarding_completed` vaut `false`.

Erreurs : 400 INVALID_REQUEST ; 409 ACCOUNT_UNAVAILABLE (email déjà pris — message volontairement identique quel que soit le mode de création du compte existant, pour ne pas énumérer les comptes) ; 429 AUTH_RATE_LIMIT.

### POST /auth/login

Corps `{ "email": string, "password": string }`. 200 : `{ "access_token": "...", "expires_in": 900 }` + cookie.

Erreurs : 400 INVALID_REQUEST ; 401 INVALID_CREDENTIALS (mot de passe faux, compte inconnu ou compte désactivé : même code, même message, et une vérification Argon2 est exécutée même pour un compte inconnu afin d'égaliser les temps de réponse) ; 429 AUTH_RATE_LIMIT.

### POST /auth/google

Corps `{ "access_token": string }` où la valeur est le JWT de session Supabase obtenu côté navigateur après le retour OAuth.

Le backend appelle `supabase.auth.getUser(jwt)` avec sa clé serveur et exige : utilisateur existant, email présent, email confirmé, et une identité de provider `google`. Il établit ensuite **sa propre** session applicative : le JWT Supabase n'est jamais accepté comme jeton d'API.

200 : `{ "access_token": "...", "expires_in": 900 }` + cookie.

Erreurs : 400 INVALID_REQUEST ; 401 INVALID_GOOGLE_TOKEN ; 403 ACCOUNT_INACTIVE ; 409 IDENTITY_CONFLICT (l'email est déjà utilisé par un compte mot de passe : aucune fusion automatique, voir D01) ; 503 GOOGLE_UNAVAILABLE (Supabase serveur non configuré).

### POST /auth/refresh

Aucun corps. Le cookie `im_refresh` est requis. 200 : `{ "access_token": "...", "expires_in": 900 }`.

Le bearer précédent est immédiatement invalidé : `sessions.access_hash` est remplacé. Le refresh conserve sa date d'expiration initiale (pas de prolongation glissante).

Erreurs : 401 UNAUTHORIZED (cookie absent, invalide, expiré, révoqué, ou compte désactivé).

### POST /auth/logout

Révoque la ligne de session correspondant au cookie et celle correspondant au bearer, puis efface le cookie. 204, sans corps. Idempotent : un logout répété répond aussi 204.

## Compte connecté — Bearer exigé

401 UNAUTHORIZED si l'en-tête `Authorization` est absent, mal formé, trop long (> 4096), inconnu ou expiré.

### GET /me

200 : le profil et son détail métier.

```json
{
  "id": "uuid",
  "auth_user_id": null,
  "email": "personne@example.test",
  "role": "worker",
  "first_name": "Jimmy",
  "last_name": "Martin Démo",
  "avatar_url": null,
  "onboarding_completed": true,
  "active": true,
  "demo": true,
  "created_at": "…Z",
  "updated_at": "…Z",
  "profile": {
    "profile_id": "uuid",
    "city": "Lyon",
    "postal_code": "69002",
    "latitude": 45.75,
    "longitude": 4.85,
    "mobility_radius_km": 15,
    "main_job": "Serveur / Chef de rang",
    "skills": [{ "id": "uuid", "name": "Service en salle" }],
    "experiences": [
      { "id": "uuid", "job_title": "Serveur", "employer": "…", "years": 2 }
    ],
    "availabilities": [
      { "id": "uuid", "starts_at": "…Z", "ends_at": "…Z" }
    ]
  }
}
```

`profile` est `{}` tant que l'onboarding n'a pas eu lieu. Pour un rôle `company`, `profile` contient la ligne `company_profiles` : `profile_id`, `legal_name`, `establishment_name`, `sector`, `address`, `city`, `postal_code`, `latitude`, `longitude`, `phone`, `description` — et aucune liste.

Les clés de premier niveau retournées sont exactement : `id`, `auth_user_id`, `role`, `first_name`, `last_name`, `email`, `avatar_url`, `onboarding_completed`, `active`, `demo`, `created_at`, `updated_at`, `profile`. Aucun hash, aucun jeton et aucune donnée de session ne sortent de l'API.

### PUT /me/role

Corps `{ "role": "worker" | "company" }`. 200 : la même charge utile que `GET /me`.

Le rôle ne peut être posé qu'une fois : la mise à jour n'écrit que si `role IS NULL` ou si le rôle demandé est identique.

Erreurs : 400 INVALID_REQUEST (`admin` est refusé par le schéma, aucune auto-attribution possible) ; 409 ROLE_LOCKED.

### GET /skills

200 : `[{ "id": "uuid", "name": "Service en salle" }]`, catalogue trié par nom. 8 compétences insérées par la migration 001.

### GET /workers/me

Rôle `worker` exigé. 200 : identique à `GET /me`. 403 FORBIDDEN sinon.

### GET /companies/me

Rôle `company` exigé. 200 : identique à `GET /me`. 403 FORBIDDEN sinon.

### PUT /onboarding/worker

Rôle `worker` exigé. Écriture transactionnelle : profil, compétences, expériences et disponibilités sont remplacés ensemble ou pas du tout.

```json
{
  "first_name": "Jimmy",
  "last_name": "Martin",
  "city": "Lyon",
  "postal_code": "69002",
  "latitude": 45.75,
  "longitude": 4.85,
  "main_job": "Serveur",
  "mobility_radius_km": 15,
  "skill_ids": ["uuid"],
  "experiences": [{ "job_title": "Serveur", "employer": "…", "years": 2 }],
  "availabilities": [{ "starts_at": "…Z", "ends_at": "…Z" }]
}
```

Contraintes : `postal_code` exactement 5 chiffres ; `mobility_radius_km` entier de 0 à 250 ; 1 à 20 compétences sans doublon ; 0 à 10 expériences ; 1 à 30 disponibilités, chacune avec `ends_at > starts_at` et sans chevauchement entre elles.

200 : la charge utile de `GET /me`, `onboarding_completed` passé à `true`.

Erreurs : 400 INVALID_REQUEST ; 400 INVALID_SKILLS (identifiant de compétence inconnu) ; 403 FORBIDDEN.

### PUT /onboarding/company

Rôle `company` exigé. Écriture transactionnelle.

```json
{
  "first_name": "Jimmy",
  "last_name": "Laurent",
  "city": "Lyon",
  "postal_code": "69002",
  "latitude": 45.75,
  "longitude": 4.85,
  "legal_name": "…",
  "establishment_name": "…",
  "sector": "restaurant",
  "address": "…",
  "phone": "+33000000000",
  "description": "…"
}
```

`sector` ∈ `restaurant`, `hotel`, `brasserie`, `traiteur`. `description` peut être vide, 1500 caractères maximum.

200 : la charge utile de `GET /me`. Erreurs : 400 INVALID_REQUEST ; 403 FORBIDDEN.

## Erreurs globales

Toutes les erreurs partagent la même forme, et l'en-tête `X-Request-Id` est présent sur chaque réponse.

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route introuvable.",
    "request_id": "UUID généré par le serveur"
  }
}
```

| Statut | Code | Cause |
| --- | --- | --- |
| 400 | INVALID_REQUEST | JSON malformé ou schéma Zod refusé |
| 400 | INVALID_SKILLS | Compétence inconnue à l'onboarding intérimaire |
| 401 | UNAUTHORIZED | Session absente, invalide, expirée ou révoquée |
| 401 | INVALID_CREDENTIALS | Échec de connexion classique |
| 401 | INVALID_GOOGLE_TOKEN | JWT Supabase refusé par le backend |
| 403 | FORBIDDEN | Rôle incompatible avec l'espace demandé |
| 403 | INVALID_ORIGIN | En-tête Origin absent ou différent de FRONTEND_URL |
| 403 | ACCOUNT_INACTIVE | Compte désactivé au retour Google |
| 404 | NOT_FOUND | Route inexistante |
| 409 | ACCOUNT_UNAVAILABLE | Email déjà utilisé à l'inscription |
| 409 | IDENTITY_CONFLICT | Email déjà lié à une autre méthode de connexion |
| 409 | ROLE_LOCKED | Rôle déjà choisi |
| 413 | PAYLOAD_TOO_LARGE | Corps au-delà de 100 Ko |
| 429 | RATE_LIMITED | Plus de 100 requêtes/minute/IP |
| 429 | AUTH_RATE_LIMIT | Plus de 30 tentatives/15 minutes/IP sur register, login ou google |
| 500 | INTERNAL_ERROR | Erreur non prévue, sans pile ni détail |

Le limiteur est en mémoire, donc non distribué : il ne protège qu'une instance. Aucun `trust proxy` n'est activé ; la topologie Render doit être revue avant de s'appuyer sur l'IP cliente.

## Vérification manuelle

Toutes les routes `/auth/*` exigent l'en-tête Origin ; un curl sans Origin reçoit 403 INVALID_ORIGIN, ce qui est le comportement attendu.

```bash
curl.exe -i http://localhost:3000/api/v1/health
curl.exe -i -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" -H "Origin: http://localhost:5173" \
  -d '{"email":"jimmy.worker@example.test","password":"<DEMO_PASSWORD local>"}'
curl.exe -i http://localhost:3000/api/v1/me -H "Authorization: Bearer <access_token>"
```

## Absent du Lot 1

Aucune route missions, matching, propositions, attribution, n8n, webhook, email, administration ni réinitialisation de mot de passe. Aucun événement métier n'est émis : `events/business-event.ts` ne fournit que l'enveloppe validée.
