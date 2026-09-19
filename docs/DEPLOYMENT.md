# Git et déploiement · InteriMatch

Ce document décrit l'organisation du dépôt, les branches, les variables d'environnement et la configuration de déploiement d'InteriMatch.

---

## 1. Organisation du dépôt et branches

* **Dépôt distant :** `https://github.com/Flav-Walk/INTERIMATCH.git`
* **Branche frontend :** `frontend` (worktree `InteriMatch-frontend`)
* **Branche backend :** `backend` (worktree `InteriMatch-backend`)
* **Branche documentation / transverse :** `main`

Toutes les modifications du frontend sont intégrées sur la branche `frontend` avant synchronisation. Les opérations de commit et de push sont réservées à l'administrateur du dépôt.

---

## 2. Déploiement Frontend (Vercel)

* **Hébergeur :** Vercel
* **URL de production :** `https://interimatch-five.vercel.app`
* **Racine du projet :** `apps/frontend`
* **Commande de build :** `npm run build`
* **Répertoire de sortie :** `dist`
* **Version Node.js :** Node 24

### Configuration des réécritures (`apps/frontend/vercel.json`)
Pour permettre le bon fonctionnement du routage côté client (React Router SPA) tout en servant statiquement les fichiers SEO essentiels et les bundles compilés :

```json
{
  "rewrites": [
    {
      "source": "/((?!assets/|robots\\.txt|sitemap\\.xml).*)",
      "destination": "/index.html"
    }
  ]
}
```

* Les requêtes vers `/robots.txt` et `/sitemap.xml` sont servies directement depuis le dossier `public/` sans être interceptées par la SPA.
* Les assets statiques (`/assets/*`) sont servis directement avec leurs en-têtes de cache optimaux.
* Toutes les autres routes (ex. `/`, `/worker`, `/company`, `/mentions-legales`, etc.) sont réécrites vers `/index.html` pour prise en charge par le routeur React.

---

## 3. Variables d'environnement Frontend

Le fichier `.env.local` (inspiré de `.env.example`) configure le client dans chaque environnement :

| Variable | Description | Exemple en production |
| --- | --- | --- |
| `VITE_API_URL` | URL de base de l'API backend (inclut `/api/v1`) | `https://interimatch.onrender.com/api/v1` |
| `VITE_SUPABASE_URL` | URL du projet Supabase pour l'authentification | `https://xyzcompany.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé anonyme publiable (anon key) | `eyJhbGciOi...` |

> [!WARNING]
> **Sécurité des clés :** Seules les variables préfixées par `VITE_` sont injectées dans le bundle navigateur. **Aucune clé de service secrète** (`service_role`, clés d'API tierces privées) ne doit figurer dans la configuration frontend.

---

## 4. Déploiement Backend (Render - Référence)

* **Hébergeur :** Render
* **URL prévue :** `https://interimatch.onrender.com`
* **Healthcheck :** `GET /api/v1/health`
* **Racine du projet :** `apps/backend`
* **Commande de démarrage :** `npm start`
