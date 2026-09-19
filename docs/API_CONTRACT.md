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
