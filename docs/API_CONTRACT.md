# API réelle — Lot 0

## GET /api/v1/health

Public, dans apps/backend/src/routes/health.ts, monté par app.ts. Contrôle de vie HTTP indépendant des bases et services externes.

Réponse 200 :

```json
{"status":"ok","service":"interimatch-api","version":"0.0.0"}
```

Après npm run dev : `curl.exe -i http://localhost:3000/api/v1/health`.

## Erreurs globales

```json
{"error":{"code":"NOT_FOUND","message":"Route introuvable.","request_id":"UUID généré par le serveur"}}
```

404 NOT_FOUND ; 400 INVALID_REQUEST pour JSON invalide ; 413 PAYLOAD_TOO_LARGE au-delà de 100 Ko ; 429 RATE_LIMITED après 100 requêtes/minute/IP ; 500 INTERNAL_ERROR sans stack. Header X-Request-Id. Limiteur en mémoire non distribué. CORS ne remplace pas l’autorisation ; préflight OPTIONS possible avec réponse 204.

## GET /api/v1/public-job-offers

Consultation des offres d'emploi publiques issues de France Travail (Lot SL2e).

Authentification Bearer requise. Endpoint réservé au rôle `worker` ; une requête
anonyme reçoit 401 et un autre rôle reçoit 403.

Paramètres de requête :
- `search` (optionnel) : recherche textuelle sur titre, description, entreprise, ROME.
- `rome` (optionnel) : code ROME (ex. `G1803`).
- `location` (optionnel) : code postal ou commune (ex. `69002`, `Lyon`).
- `contract_type` (optionnel) : type de contrat (ex. `MIS`).
- `page` (optionnel, défaut 1) : numéro de page.
- `limit` (optionnel, défaut 20, max 100) : taille de page.

Les caractères `%`, `_` et `\` de `search` et `location` sont traités comme du
texte littéral, pas comme des jokers SQL. Pour zéro résultat, `total_pages` vaut 0.

Réponse 200 :
```json
{
  "offers": [
    {
      "id": "uuid",
      "source": "france_travail",
      "external_id": "213HXKM",
      "title": "Serveur / Serveuse (H/F)",
      "description": "...",
      "rome_code": "G1803",
      "rome_label": "Serveur / Serveuse en restauration",
      "company_name": "RAS 420",
      "contract_type": "MIS",
      "contract_label": "Intérim - 6 Mois",
      "experience_label": "3 Mois",
      "postal_code": "69002",
      "city": "69 - LYON",
      "latitude": 45.753267,
      "longitude": 4.826881,
      "salary_label": "Horaire de 12.31 Euros sur 12 mois",
      "working_time": "Temps plein",
      "positions": 1,
      "skills": [{"name": "Prendre une commande client", "required": true}],
      "professional_qualities": [{"label": "Avoir l'esprit d'équipe"}],
      "source_url": "https://candidat.francetravail.fr/offres/recherche/detail/213HXKM",
      "created_at_source": "2026-09-03T10:18:09.236Z",
      "updated_at_source": "2026-09-03T10:24:24.192Z",
      "imported_at": "2026-09-18T17:11:45.000Z"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20,
  "total_pages": 1
}
```

## GET /api/v1/public-job-offers/:id

Détail d'une offre publique par son UUID ou son identifiant externe France Travail.
Authentification Bearer requise, rôle `worker`. Pour une valeur syntaxiquement
UUID, l'identifiant interne est prioritaire ; l'identifiant externe sert de repli.

Réponse 200 : Objet DTO de l'offre (comme ci-dessus).
Réponse 404 :
```json
{"error":{"code":"NOT_FOUND","message":"Offre publique introuvable.","request_id":"..."}}
```

## Photo d'une mission (lot Média)

Une mission InteriMatch porte une photo choisie par l'établissement. Elle est
**obligatoire pour publier** ; un brouillon peut exister sans elle.

### `POST /api/v1/company/media`

Entreprise authentifiée. Corps = les octets de l'image, avec son type réel en
`Content-Type` (`image/jpeg`, `image/png`, `image/webp`). Aucun `multipart` :
un seul fichier est transporté, le corps EST ce fichier.

| Réponse | Cas |
| --- | --- |
| `201` `{ provider, url, storage_path }` | Déposé |
| `400 EMPTY_FILE` | Fichier vide |
| `413 FILE_TOO_LARGE` | Au-delà de 5 Mio |
| `415 UNSUPPORTED_MEDIA_TYPE` | Le contenu n'est pas une image — décidé sur les **octets**, pas sur l'en-tête |

`storage_path` vaut `missions/<company_id>/<uuid>.<ext>`. Ce préfixe est ce qui
rend la propriété vérifiable : une entreprise ne peut associer à sa mission
qu'un fichier déposé sous le sien (`403 MEDIA_FORBIDDEN` sinon).

### `GET /api/v1/company/media/unsplash?query=&page=`

Entreprise authentifiée. Relais vers l'API Unsplash, dont la clé d'accès reste
**côté serveur** : le quota qu'elle porte est celui de l'application entière.

`503 UNSPLASH_NOT_CONFIGURED` · `UNSPLASH_UNAVAILABLE` · `UNSPLASH_RATE_LIMITED`
selon le cas. Dans les trois, l'import depuis l'ordinateur reste disponible, et
le message le dit.

### Champ `media` d'une mission

Le client **désigne** une photo, il ne la décrit pas :

```jsonc
{ "provider": "upload",   "storage_path": "missions/<id>/<uuid>.jpg" }
{ "provider": "unsplash", "external_id": "<id photo>" }
```

Le serveur redérive l'URL d'un import, et va chercher la photo Unsplash chez
Unsplash — l'adresse d'une image ne vient donc jamais de la requête. Il déclenche
alors `links.download_location`, comme l'exigent les conditions d'utilisation
d'Unsplash, et n'en conserve pas le lien.

La mission servie porte le média complet : `url`, et pour Unsplash `thumb_url`,
`author_name`, `author_url` (avec `utm_source`/`utm_medium`) — l'attribution due
au photographe voyage avec la photo.

`media` absent d'un `PATCH` signifie « inchangé » ; `null` retire la photo.

### `POST /api/v1/missions/:id/publish`

`409 MISSION_MEDIA_REQUIRED` — « Ajoutez une photo pour publier cette mission. »
La même règle est tenue en base par un déclencheur (migration 010), qui ne juge
que la **transition** vers « publiée » : les missions publiées avant cette
évolution restent modifiables et annulables sans photo.

### Offres France Travail

Elles n'ont **aucune image**, d'aucune origine. Aucun visuel local, aucune photo
Unsplash, aucun média prétendument fourni par la source.

## Documents contractuels de mission

Toutes ces routes sont sous `/api/v1`, exigent un bearer InteriMatch et ne
renvoient jamais de chemin ou d'URL Supabase. Un UUID appartenant à une autre
partie répond `404 DOCUMENT_NOT_FOUND`, sans confirmer son existence.

| Méthode et route | Rôle | Corps | Réponse 200 |
| --- | --- | --- | --- |
| `GET /workers/me/documents` | worker | aucun | `{ documents: ContractListItem[] }` |
| `GET /company/me/documents` | company | aucun | `{ documents: ContractListItem[] }` |
| `GET /documents/:id` | worker ou company partie au document | aucun | détail, snapshot figé, traces et `download_available` |
| `POST /documents/:id/sign` | partie dont c'est le tour | `{ "accepted": true }` strict | détail après transition |
| `GET /documents/:id/download` | partie au document | aucun | PDF en attachment |

La liste expose les identifiants métier, type, statut, dates et résumés des
parties. Le détail ajoute le snapshot et les traces de validation. Chemins de
stockage, empreintes et erreurs internes ne sont jamais exposés.

Erreurs : `400 VALIDATION_ERROR`, `401 AUTH_REQUIRED`, `403 FORBIDDEN` pour un
rôle non admis, `404 DOCUMENT_NOT_FOUND`, `409 CONTRACT_CANCELLED`,
`409 CONTRACT_NOT_READY`, `409 WORKER_SIGNATURE_REQUIRED` et
`409 DOCUMENT_NOT_READY`. Une double validation est idempotente.
