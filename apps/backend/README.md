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

Noms dans `.env.example`. Aucun secret ne doit être versionné ni écrit dans un log. `DB_SSL_INSECURE` est un repli de développement : le démarrage échoue si elle est vraie avec `NODE_ENV=production`.

Documentation commune dans le worktree voisin `Piscine Epitech/docs`. Les commits et les push sont réalisés par Flavien seul.
