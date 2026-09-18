# Passation n8n — événements métier InteriMatch

## État opérationnel

Le backend envoie les événements métier vers l’unique webhook configuré par
`N8N_WEBHOOK_URL`, signé avec `N8N_WEBHOOK_SECRET`. Ces deux variables restent
optionnelles mais doivent être définies ensemble. Aucune valeur de production
n’est documentée ni versionnée ici.

La recette réelle T1 à T8 des événements worker, de la signature, de la
déduplication et des refus de contrat a été validée le 17/09/2026. Les quatre
événements missions/candidatures ci-dessous utilisent exactement le même
dispatcher et le même contrat ; ils doivent faire l’objet de leur propre recette
sur l’environnement déployé après déploiement du backend.

## Architecture réellement utilisée

Une action HTTP appelle le service métier, qui valide les règles puis termine sa
transaction PostgreSQL. Après le commit, le service remet l’événement au
`AsyncBusinessEventPublisher`. Celui-ci construit une seule enveloppe logique et
la livre au webhook n8n hors du chemin HTTP.

Chaque enveloppe contient exactement :

```json
{
  "event_id": "<uuid-v4>",
  "event_type": "<type autorisé>",
  "occurred_at": "<date ISO-8601 UTC>",
  "schema_version": "1.0",
  "idempotency_key": "<clé non vide>",
  "data": {}
}
```

Le corps JSON exact est signé en HMAC-SHA256 avec le timestamp :
`HMAC(secret, timestamp + "." + raw_body)`. Les headers envoyés sont :

- `content-type: application/json` ;
- `x-interimatch-timestamp` ;
- `x-interimatch-signature: sha256=<signature>` ;
- `x-correlation-id: <event_id>`.

Un timeout de 10 secondes s’applique à chaque tentative. Les erreurs réseau et
les réponses 5xx sont réessayées après 1 puis 5 secondes. Toutes les tentatives
réutilisent strictement le même corps, le même `event_id` et la même
`idempotency_key` ; seul le timestamp et donc la signature de transport sont
recalculés. Les réponses `200 accepted` et `200 duplicate` sont des succès. Les
réponses 400 (`invalid_payload`) et 401 (`invalid_signature`) sont permanentes et
ne sont pas réessayées.

Les logs de livraison ne contiennent que `event_id`, `event_type`, `attempt`,
`http_status`, `result` ou une catégorie/code d’erreur technique sûr. Le secret,
la signature, les headers et le corps métier ne sont jamais journalisés.

## Types officiellement acceptés

Le contrat `schema_version = "1.0"` accepte uniquement :

- `worker.profile.updated` ;
- `worker.onboarding.completed` ;
- `mission.published` ;
- `application.created` ;
- `application.accepted` ;
- `application.rejected`.

Les anciens noms prospectifs ne font pas partie du contrat. Notamment,
`mission.created`, `candidate.created`, `candidate.accepted`,
`candidate.refused` et `candidate.rejected` doivent recevoir
`400 invalid_payload` côté webhook.

## Événements et conditions d’émission

### `worker.profile.updated`

- Moment : après le commit d’une modification effective du profil worker.
- `data` : `{ "worker_id": "<uuid>" }`.
- Ne part pas : écriture sans changement, validation refusée ou rollback.

### `worker.onboarding.completed`

- Moment : après le commit de la transition réelle de l’onboarding de `false` à
  `true`.
- `data` : `{ "worker_id": "<uuid>" }`.
- Ne part pas : profil encore incomplet, profil déjà complet, modification
  ultérieure ou rollback.

### `mission.published`

- Moment : après le commit de la transition réelle `draft → open`, effectuée
  par `MissionService.publish` via `POST /api/v1/missions/:id/publish`.
- `data` : `{ "mission_id": "<uuid>" }`.
- Ne part pas : création du brouillon, modification d’une mission ouverte,
  seconde publication, mission déjà commencée, mission absente/non détenue,
  validation refusée ou rollback.
- La création directe en statut publié n’existe pas : le statut est décidé par
  le serveur et toute mission est créée en brouillon.

### `application.created`

- Moment : après le commit de l’INSERT d’une nouvelle candidature validée par
  `ApplicationService.create`, via `POST /api/v1/workers/me/applications`.
- `data` : `{ "application_id": "<uuid>" }`.
- Ne part pas : doublon, mission inexistante, brouillon, mission expirée,
  mission pleine, séparation réel/démo, validation refusée ou rollback.

### `application.accepted`

- Moment : après le commit de la transition réelle `pending → accepted`,
  effectuée par `ApplicationService.decide`.
- `data` : `{ "application_id": "<uuid>" }`.
- Ne part pas : candidature déjà décidée, mission pleine, intérimaire déjà
  engagé sur un créneau chevauchant, candidature/mission absente ou non détenue,
  transition invalide ou rollback.

### `application.rejected`

- Moment : après le commit de la transition réelle `pending → rejected`,
  effectuée par `ApplicationService.decide`.
- `data` : `{ "application_id": "<uuid>" }`.
- Ne part pas : candidature déjà décidée, candidature/mission absente ou non
  détenue, transition invalide ou rollback.

Les payloads application n’embarquent pas `mission_id` : `application_id`
identifie sans ambiguïté la ressource persistée et évite de dupliquer une donnée
déjà disponible en base. Aucun email, téléphone, nom, adresse, token, profil ou
détail de matching n’est envoyé.

## AUTOMATISATIONS MAINTENANT DISPONIBLES

- `mission.published` → préparer la notification des intérimaires compatibles ;
- `application.created` → prévenir l’entreprise d’une nouvelle candidature ;
- `application.accepted` → informer l’intérimaire qu’il est retenu ;
- `application.rejected` → informer l’intérimaire qu’il n’est pas retenu.

Jimmy peut déclencher ces événements depuis les vraies actions de l’application.
Le workflow n8n doit dédupliquer durablement sur `event_id` (ou
`idempotency_key`) avant tout effet externe.

## Limite de fiabilité à connaître

Il n’existe pas encore d’outbox transactionnelle. L’ordre actuel exclut le cas
« n8n reçoit un événement alors que la transaction métier rollbacke », car la
publication commence après le commit. En revanche, un arrêt du processus entre
le commit et l’appel webhook, ou l’épuisement des retries, peut laisser une
opération métier validée sans événement livré. Les échecs sont journalisés mais
ne sont pas rejoués après redémarrage. Une outbox persistante est la dette à
traiter avant d’exiger une garantie de livraison forte en production.
