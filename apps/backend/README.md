# InteriMatch — backend

Node 24. API Express/TypeScript : comptes, sessions, rôles et onboarding. Contrat complet dans `Piscine Epitech/docs/API_CONTRACT.md`.

## Démarrer

```powershell
npm ci
npm run dev
```

`http://localhost:3000/api/v1/health`.

Sans `DATABASE_URL`, seul `/health` répond : le routeur de comptes n'est pas monté et toutes les autres routes renvoient 404. Voir `docs/DECISIONS.md` D08 pour la connexion Supabase — utiliser le **Session Pooler**, pas l'hôte direct.

## Base de données

```powershell
npm run db:check     # Supabase + PostgreSQL, liste les tables
npm run db:migrate   # applique migrations/, idempotent (checksum)
npm run db:seed      # comptes Jimmy, exige ALLOW_DEMO_SEED=true et DEMO_PASSWORD
```

Le seed refuse de s'exécuter en production, refuse de modifier un compte non `demo`, et révoque les sessions existantes du compte à chaque réinitialisation.

## Vérifications

```powershell
npm run typecheck ; npm run lint ; npx prettier --check . ; npm run test:coverage ; npm run build
```

Les tests d'auth s'exécutent sur un vrai moteur PostgreSQL éphémère (PGlite) avec la migration réelle : ils ne touchent aucun service distant.

## Environnement

Noms dans `.env.example`. Aucun secret ne doit être versionné ni écrit dans un log.

TLS de la base : `DB_SSL=true` suffit et la connexion est chiffrée, sans exiger de certificat. `DB_SSL_CA_PATH` est facultatif — fourni et lisible, il active en plus la vérification du certificat ; illisible, il est signalé et ignoré, sans empêcher le démarrage.

Documentation commune dans le worktree voisin `Piscine Epitech/docs`. Les commits et les push sont réalisés par Flavien seul.

## Événements vers n8n

Le backend publie les événements métier via `N8N_WEBHOOK_URL` et
`N8N_WEBHOOK_SECRET`. Les deux variables doivent être définies ensemble ; si elles
sont absentes, la livraison est désactivée. Une valeur partielle bloque le démarrage
afin de rendre l'erreur de configuration visible.

La livraison HMAC est asynchrone et réessaie les erreurs réseau, timeouts et réponses
5xx. Les réponses 400 et 401 sont permanentes. Le POC conserve l'événement en mémoire
pendant ces tentatives : une outbox persistante sera nécessaire avant production pour
survivre à un redémarrage du backend.

Prérequis n8n avant production : remplacer le stockage interne de déduplication du
workflow par un stockage persistant imposant une contrainte d'unicité sur `event_id`.

## Administration

Les routes `/api/v1/admin/users` sont réservées au rôle `admin`, déjà prévu par
le schéma de données. Un administrateur ne peut pas retirer son propre rôle afin
d'éviter de perdre accidentellement le dernier accès à l'administration.

Cette fonctionnalité ne promeut aucun compte existant automatiquement. Le premier
compte administrateur doit être désigné explicitement par une opération contrôlée
sur l'environnement concerné avant que l'interface `/admin` puisse être utilisée.
