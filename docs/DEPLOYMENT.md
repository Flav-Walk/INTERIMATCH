# Git et déploiement

Origin : https://github.com/Flav-Walk/INTERIMATCH.git.

## État Git

Le commit initial `chore: initialize InteriMatch project` existe sur `main`, et les trois worktrees en descendent : le rattachement décrit au Lot 0 est fait, il n'y a pas d'historiques parallèles.

```
C:/Users/flavi/Desktop/Piscine Epitech        [main]
C:/Users/flavi/Desktop/InteriMatch-frontend   [frontend]
C:/Users/flavi/Desktop/InteriMatch-backend    [backend]
```

Les applications ne sont pas encore enregistrées : `apps/frontend` et `apps/backend` sont non suivis dans leurs worktrees respectifs.

**Règle en vigueur : Flavien réalise seul les commits et les push.** Les assistants peuvent lire Git — `status`, `diff`, `log`, branches, worktrees — et ne doivent exécuter aucun `commit`, `push`, `merge`, `rebase`, `cherry-pick` ni `tag`, ni créer de PR, ni modifier `user.name` / `user.email`. Aucune attribution d'IA dans les messages de commit ou les métadonnées.

Avant chaque enregistrement : `git status`, puis vérification qu'aucun secret ne part. Les `.env` réels sont ignorés ; `.env.example` ne contient que des noms. Ne pas utiliser `git add .` sans avoir regardé la liste des fichiers.

## Configuration de la base

Voir D08 de [DECISIONS.md](DECISIONS.md). En résumé : l'hôte direct `db.<ref>.supabase.co` n'est joignable qu'en IPv6 et échoue depuis les environnements de développement du projet. Utiliser le **Session Pooler**.

Dans Supabase → **Connect** → onglet **Session pooler** (et non Transaction pooler) :

Copier la chaîne proposée par Supabase, dont les composants sont :

| Composant | Valeur |
| --- | --- |
| Schéma | `postgresql` |
| Utilisateur | `postgres.<project-ref>` — le point et la référence projet sont obligatoires |
| Mot de passe | celui de la base, jamais versionné |
| Hôte | `aws-0-<region>.pooler.supabase.com` |
| Port | `5432` — surtout pas `6543` |
| Base | `postgres` |

Le code utilise des verrous consultatifs et `SELECT … FOR UPDATE` : le mode transaction (port 6543) ne convient pas.

TLS : le pooler présente un certificat signé par l'autorité Supabase, absente des magasins système.

- Développement local : `DB_SSL_INSECURE=true`.
- Render : télécharger le certificat dans Supabase → **Settings → Database → SSL Configuration**, le déposer sur l'instance, renseigner `DB_SSL_CA_PATH`, et laisser `DB_SSL_INSECURE` vide. Le démarrage échoue volontairement si `DB_SSL_INSECURE=true` avec `NODE_ENV=production`.

## Cibles non déployées

| Service | Branche | Racine | Build | Démarrage/sortie |
| --- | --- | --- | --- | --- |
| Vercel | frontend | apps/frontend | `npm ci` puis `npm run build` | `dist` |
| Render | backend | apps/backend | `npm ci` puis `npm run build` | `npm start` |

Node 24. Backend prévu sur https://interimatch.onrender.com, healthcheck `/api/v1/health`. Réécriture SPA dans `apps/frontend/vercel.json`. `VITE_API_URL` inclut `/api/v1` ; `FRONTEND_URL` est une origine sans slash final. Jamais de déploiement depuis `main`.

### Variables à définir avant publication

Render (backend) : `NODE_ENV=production`, `PORT`, `FRONTEND_URL` (l'origine Vercel exacte), `DATABASE_URL` (Session Pooler), `DB_SSL_CA_PATH`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. Ne pas définir `ALLOW_DEMO_SEED` ni `DEMO_PASSWORD` en production.

Vercel (frontend) : `VITE_API_URL` pointant sur l'API Render, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Aucune clé serveur ne doit jamais porter le préfixe `VITE_` : elle serait incluse dans le bundle navigateur.

### À vérifier avant publication

Cookie de session : en production il est émis en `Secure; SameSite=None` pour traverser Vercel → Render. Confirmer que les deux domaines sont en HTTPS, sinon la session ne persistera pas.

`trust proxy` n'est pas activé : derrière le proxy Render, le limiteur verra l'IP du proxy et non celle du client. Revoir ce point avant de compter sur le rate limiting en production.

Supabase → Authentication → URL Configuration : ajouter l'origine Vercel en Site URL et `https://<domaine-vercel>/auth/callback` en Redirect URL, en plus des entrées localhost. Google Cloud OAuth garde un seul callback, celui de Supabase.
