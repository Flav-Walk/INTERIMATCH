# InteriMatch — Lot 2 terminé

POC EPITECH hôtellerie-restauration. Un compte peut être créé, se connecter, entrer directement dans l'espace de son rôle, découvrir l'interface par une visite guidée et compléter son profil. Aucune mission, aucun matching, aucune automatisation.

## Organisation

Origin : https://github.com/Flav-Walk/INTERIMATCH.git. Un commit initial existe sur `main` ; les trois worktrees en descendent.

| Branche | Dossier depuis ici | Contenu |
| --- | --- | --- |
| main | . | Documentation et références |
| frontend | ../InteriMatch-frontend | apps/frontend |
| backend | ../InteriMatch-backend | apps/backend |

Les commits et les push sont réalisés par Flavien seul.

## Lancement

Node 24, npm 11. Dans deux terminaux depuis ce dossier :

```powershell
Set-Location '../InteriMatch-backend/apps/backend'
npm ci
npm run dev
```

```powershell
Set-Location '../InteriMatch-frontend/apps/frontend'
npm ci
npm run dev
```

Frontend http://localhost:5173 ; API http://localhost:3000/api/v1/health.

Le backend a maintenant besoin d'une base : sans `DATABASE_URL`, seul `/health` répond et toutes les routes de comptes renvoient 404. Voir [DEPLOYMENT.md](docs/DEPLOYMENT.md) pour la configuration Supabase, et [DECISIONS.md](docs/DECISIONS.md) D08 pour le choix du Session Pooler.

Préparation de la base, depuis `apps/backend` :

```powershell
npm run db:check     # vérifie Supabase et PostgreSQL
npm run db:migrate   # applique les migrations, idempotent
npm run db:seed      # comptes de démonstration, exige ALLOW_DEMO_SEED et DEMO_PASSWORD
```

Exemples d'environnement dans chaque application et dans `config/`. Aucun secret ne doit être versionné, et aucun secret ne doit entrer dans une variable `VITE_` autre que les clés publiables prévues pour le navigateur.

## Vérifications

Dans chaque application : `npm run typecheck`, `npm run lint`, `npx prettier --check .`, `npm test`, `npm run test:coverage`, `npm run build`. Frontend : `npx playwright install chromium` puis `npm run test:e2e`.

Dernière exécution complète : backend 46 tests, frontend 25 tests, navigateur 10 tests, tous réussis. Détail et portée dans [TESTING.md](docs/TESTING.md).

## Ce qui fonctionne au Lot 2

Inscription et connexion classiques (Argon2id, sessions opaques révocables), connexion Google via Supabase convergeant vers le **même** profil applicatif, renouvellement silencieux de session par cookie HttpOnly, déconnexion révoquant réellement la session.

**Rôles.** Tout nouveau compte est intérimaire. L'accès à l'espace Entreprise est décidé par la table `company_accounts`, pas par du code : ajouter une entreprise est un `INSERT`. Aucun endpoint ne permet de choisir ou de changer un rôle, et l'autorisation est refaite côté serveur à chaque requête.

**Deux espaces cloisonnés.** Intérimaire (`/worker`) : tableau de bord, profil, missions. Entreprise (`/company`) : tableau de bord, établissement, missions, candidats. Un intérimaire qui saisit `/company` n'obtient rien.

**Visite guidée.** À la première ouverture de l'espace, une visite met en surbrillance les zones réelles de l'interface, avec bulle explicative, étapes, Passer/Précédent/Suivant, navigation clavier et repli en bas d'écran sur mobile. Une visite par rôle. La progression est en base et versionnée : augmenter `CURRENT_TOUR_VERSION` la rejoue pour tout le monde, et « Revoir la visite » la relance à la demande.

## Ce qui n'existe pas encore

Missions, matching, propositions, attribution, événements émis, workflows n8n, emails Brevo, MongoDB, espace admin, réinitialisation de mot de passe, vérification d'email.

## Sources et documentation

Le PDF prime sur le cahier des charges. `image.png` est la référence de direction artistique commune ; son contenu correspond à un tableau de bord **Entreprise** (voir [UI_REFERENCE.md](docs/UI_REFERENCE.md), point à confirmer avec l'équipe).

- [Audit initial](docs/AUDIT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Décisions](docs/DECISIONS.md)
- [API réelle](docs/API_CONTRACT.md)
- [Passation n8n](docs/N8N_HANDOFF.md)
- [Git/déploiement](docs/DEPLOYMENT.md)
- [Tests](docs/TESTING.md)
- [Données publiques](docs/DATA_PUBLIC.md)
- [Référence visuelle](docs/UI_REFERENCE.md)
- [Roadmap](docs/ROADMAP.md)

Lot suivant : questionnaire intérimaire complet et disponibilités multiples, puis missions.
