# Passation n8n — événements métier InteriMatch

## Transport commun

Les six événements utilisent le même `AsyncBusinessEventPublisher`. Ils sont
construits après réussite de la transaction métier, puis livrés au webhook
configuré par `N8N_WEBHOOK_URL`. Aucune valeur de configuration ou de production
n’est versionnée ici.

```json
{
  "event_id": "<uuid-v4>",
  "event_type": "<type officiel>",
  "occurred_at": "<date ISO-8601 UTC>",
  "schema_version": "1.0",
  "idempotency_key": "<clé non vide>",
  "data": {}
}
```

Le corps JSON exact est signé en HMAC-SHA256 avec
`HMAC(secret, timestamp + "." + raw_body)`. Les headers sont
`content-type`, `x-interimatch-timestamp`, `x-interimatch-signature` et
`x-correlation-id`. Le timeout est de 10 secondes. Les erreurs réseau et 5xx
sont réessayées après 1 puis 5 secondes avec le même corps, le même `event_id`
et la même `idempotency_key`. `200 accepted` et `200 duplicate` sont des succès ;
400 et 401 sont permanents.

Le contrat accepte uniquement :

- `worker.profile.updated` ;
- `worker.onboarding.completed` ;
- `mission.published` ;
- `mission.cancelled` ;
- `application.created` ;
- `application.accepted` ;
- `application.rejected`.

`mission.created` et tous les noms `candidate.*` restent invalides. Les schémas
de `data` sont stricts : un champ d’authentification ou un champ inconnu rend
l’événement invalide avant livraison.

## Contrats détaillés

### `worker.profile.updated`

Déclencheur : après le commit d’une modification effective du profil. Une
écriture identique, un refus métier ou un rollback n’émet rien. Cet événement
reste volontairement léger et ne doit pas déclencher un email à chaque sauvegarde.

Payload exact :

```json
{
  "worker_id": "20000000-0000-4000-8000-000000000002"
}
```

`worker_id` est obligatoire et non nullable. Automatisations possibles :
invalidation d’un cache, synchronisation ou audit technique du profil.

### `worker.onboarding.completed`

Déclencheur : après le commit de l’unique transition réelle de l’onboarding de
`false` vers `true`. Une modification ultérieure ne le réémet pas.

Payload exact :

```json
{
  "worker_id": "20000000-0000-4000-8000-000000000002",
  "worker": {
    "id": "20000000-0000-4000-8000-000000000002",
    "first_name": "Camille",
    "last_name": "Martin",
    "email": "camille.martin@example.test",
    "main_job": "serveur",
    "city": "Lyon"
  }
}
```

Obligatoires et non nullables : `worker_id`, `worker.id`, `first_name`,
`last_name`, `email`. `worker.main_job` et `worker.city` sont présents mais
peuvent valoir `null`. Automatisations : email de bienvenue, confirmation que le
profil est complet, segmentation par métier ou ville.

### `mission.published`

Déclencheur : après le commit et la relecture transactionnelle de `draft → open`
dans `MissionService.publish`. La création d’un brouillon, une modification
d’une mission ouverte, une seconde publication ou une publication refusée
n’émettent rien.

Payload exact :

```json
{
  "mission_id": "30000000-0000-4000-8000-000000000003",
  "mission": {
    "id": "30000000-0000-4000-8000-000000000003",
    "title": "Service du soir",
    "description": "Renfort pour le service en salle.",
    "status": "open",
    "starts_at": "2027-01-02T17:00:00.000Z",
    "ends_at": "2027-01-02T23:00:00.000Z",
    "address": "10 rue de la République",
    "city": "Lyon",
    "postal_code": "69002",
    "job": "serveur",
    "headcount": 2,
    "pay_amount": "15.50",
    "pay_unit": "hour",
    "published_at": "2026-09-18T07:30:00.000Z",
    "skills": [
      {
        "id": "50000000-0000-4000-8000-000000000005",
        "name": "Service en salle",
        "required": true
      }
    ]
  },
  "company": {
    "id": "40000000-0000-4000-8000-000000000004",
    "email": "contact@example.test",
    "legal_name": "Bistrot Exemple SAS",
    "establishment_name": "Bistrot Exemple",
    "sector": "restaurant",
    "phone": "+33400000000"
  }
}
```

Tous les champs de `mission` sont présents. `pay_amount` et `pay_unit` peuvent
être `null` ensemble. `published_at` est nullable dans le contrat commun des
missions, mais est renseigné pour cet événement. `skills` peut être vide. Dans
`company`, `id` et `email` sont obligatoires ; `legal_name`,
`establishment_name`, `sector` et `phone` peuvent être `null` si l’établissement
n’a pas encore été renseigné. Automatisations : notification des travailleurs
compatibles et email complet présentant la mission.

### `mission.cancelled`

Déclencheur : après le commit de `open → cancelled` dans
`MissionService.cancel`. Une annulation refusée n’émet rien — ni sur un
brouillon, ni sur une mission déjà annulée, ni sur une mission déjà
commencée ou terminée, toutes refusées en 409.

Payload : **strictement la même structure que `mission.published`** — mêmes
clés, mêmes types, mêmes nullabilités. Ce qui a déjà été construit pour
lire l’un lit l’autre sans adaptation. Une seule différence de valeur :
`mission.status` vaut `"cancelled"`, la mission étant relue APRÈS la décision,
dans la transaction qui l’a écrite.

Ce que le payload ne contient volontairement pas : la liste des candidatures.
Le backend ne décide pas qui prévenir. Les figer ici les daterait à l’instant
de l’émission, alors que `mission_id` permet de les interroger au moment où
l’automatisation en a besoin.

À savoir pour construire la notification : **aucune candidature n’est modifiée
par l’annulation**. Les personnes acceptées restent `accepted`, celles en
attente restent `pending` — l’historique n’est pas réécrit. Ce sont donc bien
les candidats `accepted` et `pending` de cette mission qu’il faut avertir, et
leur statut ne sert pas à distinguer qui a été prévenu.

Automatisations attendues : avis d’annulation aux intérimaires concernés. Leur
créneau est libéré immédiatement côté produit — ils peuvent être acceptés sur
une autre mission au même horaire dès cet instant.

### Structure commune des événements candidature

Les trois événements candidature utilisent exactement cette structure. Seul le
statut varie : `pending`, `accepted` ou `rejected`.

```json
{
  "application_id": "10000000-0000-4000-8000-000000000001",
  "application": {
    "id": "10000000-0000-4000-8000-000000000001",
    "status": "pending",
    "created_at": "2026-09-18T07:30:00.000Z",
    "updated_at": "2026-09-18T07:30:00.000Z"
  },
  "worker": {
    "id": "20000000-0000-4000-8000-000000000002",
    "first_name": "Camille",
    "last_name": "Martin",
    "email": "camille.martin@example.test",
    "main_job": "serveur",
    "city": "Lyon"
  },
  "mission": {
    "id": "30000000-0000-4000-8000-000000000003",
    "title": "Service du soir",
    "description": "Renfort pour le service en salle.",
    "status": "open",
    "starts_at": "2027-01-02T17:00:00.000Z",
    "ends_at": "2027-01-02T23:00:00.000Z",
    "address": "10 rue de la République",
    "city": "Lyon",
    "postal_code": "69002",
    "job": "serveur",
    "headcount": 2,
    "pay_amount": "15.50",
    "pay_unit": "hour",
    "published_at": "2026-09-18T07:00:00.000Z",
    "skills": []
  },
  "company": {
    "id": "40000000-0000-4000-8000-000000000004",
    "email": "contact@example.test",
    "legal_name": "Bistrot Exemple SAS",
    "establishment_name": "Bistrot Exemple",
    "sector": "restaurant",
    "phone": "+33400000000"
  }
}
```

Tous les champs `application` sont obligatoires et non nullables. Les règles de
nullabilité de `worker`, `mission` et `company` sont identiques à celles décrites
plus haut. `worker.main_job` et `worker.city` peuvent être `null`.

#### `application.created`

Déclencheur : après commit de la création effective d’une candidature validée.
`application.status` vaut exactement `pending`. Un doublon, une mission absente,
expirée, pleine, non publiée ou située dans l’autre univers démo/réel n’émet rien.

Exemple : le JSON commun ci-dessus. Automatisation : envoyer immédiatement à
`company.email` une nouvelle candidature avec l’identité du worker et le résumé
complet de la mission.

#### `application.accepted`

Déclencheur : après commit de `pending → accepted`.
`application.status` vaut exactement `accepted` et `application.updated_at` est
l’horodatage réel de la décision. Une candidature déjà décidée, une capacité
atteinte, un conflit de créneau ou un rollback n’émet rien.

Exemple : même JSON que ci-dessus avec :

```json
{
  "application": {
    "id": "10000000-0000-4000-8000-000000000001",
    "status": "accepted",
    "created_at": "2026-09-18T07:30:00.000Z",
    "updated_at": "2026-09-18T08:15:00.000Z"
  }
}
```

Cette section remplace uniquement l’objet `application`; les objets `worker`,
`mission` et `company` sont tous présents comme dans l’exemple commun.
Automatisation : envoyer à `worker.email` un email d’acceptation comprenant le
nom de l’établissement, les dates, l’adresse et la rémunération.

#### `application.rejected`

Déclencheur : après commit de `pending → rejected`.
`application.status` vaut exactement `rejected`. Une candidature déjà décidée,
une transition invalide ou un rollback n’émet rien.

Exemple : même JSON commun avec :

```json
{
  "application": {
    "id": "10000000-0000-4000-8000-000000000001",
    "status": "rejected",
    "created_at": "2026-09-18T07:30:00.000Z",
    "updated_at": "2026-09-18T08:20:00.000Z"
  }
}
```

Automatisation : envoyer à `worker.email` un email de refus utilisant le titre
de mission et le nom d’établissement. Aucune raison de refus n’est disponible.

## Variables disponibles pour Jimmy

| Variable n8n                            | Type            | Nullable                        | Usage                                   |
| --------------------------------------- | --------------- | ------------------------------- | --------------------------------------- |
| `$json.event_id`                        | UUID            | non                             | Déduplication et corrélation            |
| `$json.event_type`                      | chaîne          | non                             | Routage du workflow                     |
| `$json.occurred_at`                     | date ISO        | non                             | Date de création de l’événement         |
| `$json.schema_version`                  | `"1.0"`         | non                             | Version du contrat                      |
| `$json.idempotency_key`                 | chaîne          | non                             | Déduplication métier                    |
| `$json.data.worker_id`                  | UUID            | non pour événements worker      | Compatibilité et identification directe |
| `$json.data.application_id`             | UUID            | non pour événements application | Identification directe                  |
| `$json.data.worker.id`                  | UUID            | non                             | Identité worker                         |
| `$json.data.worker.first_name`          | chaîne          | non                             | Personnalisation Brevo                  |
| `$json.data.worker.last_name`           | chaîne          | non                             | Personnalisation Brevo                  |
| `$json.data.worker.email`               | email           | non                             | Destinataire worker                     |
| `$json.data.worker.main_job`            | chaîne          | oui                             | Métier principal                        |
| `$json.data.worker.city`                | chaîne          | oui                             | Ville worker                            |
| `$json.data.application.id`             | UUID            | non                             | Candidature                             |
| `$json.data.application.status`         | statut          | non                             | `pending`, `accepted` ou `rejected`     |
| `$json.data.application.created_at`     | date ISO        | non                             | Date de candidature                     |
| `$json.data.application.updated_at`     | date ISO        | non                             | Dernière mise à jour/décision           |
| `$json.data.mission_id`                 | UUID            | non pour `mission.published`    | Compatibilité et identification directe |
| `$json.data.mission.id`                 | UUID            | non                             | Mission                                 |
| `$json.data.mission.title`              | chaîne          | non                             | Objet et contenu email                  |
| `$json.data.mission.description`        | chaîne          | non                             | Description, éventuellement vide        |
| `$json.data.mission.status`             | statut          | non                             | État réel de la mission                 |
| `$json.data.mission.starts_at`          | date ISO        | non                             | Date et heure de début                  |
| `$json.data.mission.ends_at`            | date ISO        | non                             | Date et heure de fin                    |
| `$json.data.mission.address`            | chaîne          | non                             | Lieu, éventuellement vide               |
| `$json.data.mission.city`               | chaîne          | non                             | Ville de mission                        |
| `$json.data.mission.postal_code`        | chaîne          | non                             | Code postal de mission                  |
| `$json.data.mission.job`                | chaîne          | non                             | Métier/poste                            |
| `$json.data.mission.headcount`          | entier          | non                             | Nombre de postes                        |
| `$json.data.mission.pay_amount`         | chaîne décimale | oui                             | Montant de rémunération                 |
| `$json.data.mission.pay_unit`           | chaîne          | oui                             | `hour`, `day` ou `mission`              |
| `$json.data.mission.published_at`       | date ISO        | oui                             | Date de publication                     |
| `$json.data.mission.skills`             | tableau         | non                             | Compétences, tableau possiblement vide  |
| `$json.data.mission.skills[].id`        | UUID            | non                             | Compétence                              |
| `$json.data.mission.skills[].name`      | chaîne          | non                             | Libellé Brevo                           |
| `$json.data.mission.skills[].required`  | booléen         | non                             | Obligatoire ou souhaitée                |
| `$json.data.company.id`                 | UUID            | non                             | Entreprise propriétaire                 |
| `$json.data.company.email`              | email           | non                             | Contact/destinataire entreprise         |
| `$json.data.company.legal_name`         | chaîne          | oui                             | Raison sociale                          |
| `$json.data.company.establishment_name` | chaîne          | oui                             | Nom affichable                          |
| `$json.data.company.sector`             | chaîne          | oui                             | Secteur                                 |
| `$json.data.company.phone`              | chaîne          | oui                             | Contact entreprise                      |

Les heures ne disposent pas d’un champ séparé : elles sont incluses dans
`starts_at` et `ends_at`. n8n doit formater ces dates dans le fuseau voulu avant
insertion dans Brevo.

## Données volontairement absentes

Les payloads ne contiennent jamais mot de passe/hash, access token, refresh
token, session, JWT, cookie, secret n8n, clé API/Brevo, signature HMAC ni donnée
interne d’authentification. Il n’existe pas non plus de raison de refus,
`decision_at` distinct, horaires textuels séparés ou nom de contact entreprise
distinct du profil/établissement.

## Limite de fiabilité

Il n’existe pas encore d’outbox transactionnelle. L’émission post-commit empêche
qu’un rollback soit notifié, mais un arrêt du processus entre commit et livraison
peut perdre un événement. Les retries ne survivent pas au redémarrage. Une
outbox persistante reste nécessaire pour une garantie de livraison forte.
