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

## Photos de mission — à configurer avant la mise en production

### 1. Compartiment Supabase Storage

Créer un compartiment nommé **`mission-media`**, en accès **public en lecture**.

L'écriture n'est jamais ouverte aux clients : elle passe par la clé de service
déjà configurée (`SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`), donc par
le backend, qui a préalablement vérifié le rôle et la propriété. Aucun jeton
d'écriture n'atteint le navigateur.

Sans ce compartiment, l'import échoue en `502 STORAGE_UNAVAILABLE` ; la
bibliothèque Unsplash, elle, continue de fonctionner.

### 2. Clé Unsplash

Créer une application sur <https://unsplash.com/developers> et reporter sa
**Access Key** dans `UNSPLASH_ACCESS_KEY`, **côté serveur uniquement**.

- Ne jamais la préfixer `VITE_` : tout ce qui porte ce préfixe finit dans le
  bundle navigateur.
- Le quota est celui de l'application : 50 requêtes/heure en mode démonstration,
  1000/heure une fois l'application validée par Unsplash. Une clé lisible
  publiquement est un quota que n'importe qui peut épuiser.
- Variable absente : la bibliothèque est désactivée proprement et l'import
  depuis l'ordinateur reste la voie disponible.

### 3. Migration

`npm run db:migrate` applique `010_mission_media.sql`. Elle est **additive** :
une colonne `media` nullable, sa contrainte de forme, et un déclencheur qui
n'intervient qu'au passage d'une mission vers « publiée ». Les missions déjà
publiées ne sont pas touchées et restent pilotables.

### 4. Vérification après déploiement

```
POST /api/v1/auth/login        → 200   (l'API reste joignable)
GET  /api/v1/company/media/unsplash?query=restaurant  → 200 en tant qu'entreprise
POST /api/v1/company/media     → 201 avec une image JPEG
POST /api/v1/missions/:id/publish sans photo → 409 MISSION_MEDIA_REQUIRED
```

## Documents contractuels — prérequis

Ces opérations restent manuelles et n'ont pas été exécutées pendant le
développement :

1. appliquer la migration additive `011_contracts.sql` avant le nouveau code ;
2. créer dans Supabase un bucket **privé** `contract-documents`, sans policy de
   lecture publique ni URL permanente ;
3. configurer côté Render uniquement `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`,
   `BREVO_SENDER_NAME` et `FRONTEND_URL` ; les trois variables Brevo doivent être
   toutes absentes ou toutes présentes et ne doivent jamais être préfixées
   `VITE_` ;
4. valider l'expéditeur chez Brevo. Le backend appelle uniquement
   `POST https://api.brevo.com/v3/smtp/email`, jamais SMTP.

Le boot journalise seulement l'activation des capacités. Les logs d'échec ne
contiennent ni clé, ni destinataire, ni contenu. Tout secret communiqué hors
du coffre doit être révoqué puis remplacé avant configuration.
