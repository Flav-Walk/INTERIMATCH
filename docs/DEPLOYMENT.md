# Git et déploiement

Origin : https://github.com/Flav-Walk/INTERIMATCH.git. Fetch réussi, aucune ref distante au contrôle. Aucun commit local, push ou PR.

Worktrees Desktop : Piscine Epitech (main), InteriMatch-frontend (frontend), InteriMatch-backend (backend). Branches **unborn** : HEAD nommé, aucun commit ni ref matérialisée. git branch peut être vide ; git worktree list montre les trois espaces.

## Plus tard : historique commun

Pas nécessaire pour continuer à coder. Flavien créera d’abord le premier commit main, puis rattachera les deux branches AVANT leurs premiers commits applicatifs. Ne pas créer trois historiques indépendants.

Depuis Piscine Epitech, au moment choisi :

```powershell
git add -- .gitignore README.md PRODUCT.md config docs CAHIER_DES_CHARGES.md CONTEXTE_PROJET.md N8N_HANDOFF_TEMPLATE.md D-WEB-901-project.pdf 'Interimatch_Note_Cadrage_Presentation (1).pptx' image.png
git diff --cached --stat
git commit -m "docs: fondations et architecture InteriMatch"
git -C '../InteriMatch-frontend' reset --soft main
git -C '../InteriMatch-frontend' reset --mixed HEAD
git -C '../InteriMatch-backend' reset --soft main
git -C '../InteriMatch-backend' reset --mixed HEAD
```

Applicable uniquement tant que frontend/backend sont sans commit : rattache HEAD/index sans toucher aux applications non suivies. Les documents communs apparaîtront supprimés car absents des worktrees. Après vérification qu’aucun nouveau document local ne sera écrasé, restaurer ces chemins précis :

```powershell
git -C '../InteriMatch-frontend' restore --worktree -- README.md PRODUCT.md config docs CAHIER_DES_CHARGES.md CONTEXTE_PROJET.md N8N_HANDOFF_TEMPLATE.md D-WEB-901-project.pdf 'Interimatch_Note_Cadrage_Presentation (1).pptx' image.png
git -C '../InteriMatch-backend' restore --worktree -- README.md PRODUCT.md config docs CAHIER_DES_CHARGES.md CONTEXTE_PROJET.md N8N_HANDOFF_TEMPLATE.md D-WEB-901-project.pdf 'Interimatch_Note_Cadrage_Presentation (1).pptx' image.png
git -C '../InteriMatch-frontend' add -- .gitignore apps/frontend
git -C '../InteriMatch-frontend' diff --cached --stat
git -C '../InteriMatch-frontend' commit -m "feat: socle frontend InteriMatch"
git -C '../InteriMatch-backend' add -- .gitignore apps/backend
git -C '../InteriMatch-backend' diff --cached --stat
git -C '../InteriMatch-backend' commit -m "feat: socle backend InteriMatch"
```

Commandes fournies, NON exécutées. Push ultérieur par Flavien après fetch/vérification : git push -u origin main, puis frontend/backend. Aucun force push.

## Cibles non déployées

| Service | Branche | Racine | Build | Démarrage/sortie |
| --- | --- | --- | --- | --- |
| Vercel | frontend | apps/frontend | npm ci puis npm run build | dist |
| Render | backend | apps/backend | npm ci puis npm run build | npm start |

Node 24. Backend prévu https://interimatch.onrender.com, healthcheck /api/v1/health. Réécriture SPA dans apps/frontend/vercel.json. VITE_API_URL inclut /api/v1 ; FRONTEND_URL est une origine sans slash final. Vérifier proxy/limiteur, HTTPS des bases, CORS, secrets et callbacks OAuth avant publication. Jamais de déploiement depuis main.
