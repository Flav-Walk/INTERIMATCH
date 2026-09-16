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

Aucun endpoint métier, auth ou n8n. Les routes proposées au cahier restent non implémentées.
