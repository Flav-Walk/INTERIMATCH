# InteriMatch — Lot 0 terminé

POC EPITECH hôtellerie-restauration. Socles exécutables, sans métier persistant ni migration. Aucun service externe configuré.

## Organisation

Origin : https://github.com/Flav-Walk/INTERIMATCH.git ; fetch réussi, remote vide. Aucun commit/push. Worktrees sans premier commit :

| Branche | Dossier depuis ici | Contenu |
| --- | --- | --- |
| main | . | Documentation et références |
| frontend | ../InteriMatch-frontend | apps/frontend |
| backend | ../InteriMatch-backend | apps/backend |

Avant les premiers commits applicatifs, rattacher les branches au premier commit main : [procédure](docs/DEPLOYMENT.md).

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

Frontend http://localhost:5173 ; API http://localhost:3000/api/v1/health. Aucun secret nécessaire. Exemples d’environnement dans chaque application. Frontend : .env.local avec VITE_API_URL=http://localhost:3000/api/v1 pour préparer le client ; backend : .env. Jamais de secret dans VITE.

Vérifications dans chaque application : `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run build`. Frontend : `npx playwright install chromium`, puis `npm run test:e2e`.

## Sources et documentation

Le PDF prime sur le cahier des charges. Selon la précision de Flavien, image.png est la référence **Intérimaire**, et la direction artistique commune. L’Entreprise possède ses propres contenus et parcours.

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

Lot suivant : auth classique backend, Google Supabase, rôles et onboarding. Aucun compte ne peut encore être créé ; aucun workflow n8n/Brevo disponible.
