# INTERIMATCH --- N8N HANDOFF TEMPLATE

## Document de passation à maintenir à partir du code réel

> Ce document est volontairement un gabarit. Le développeur principal
> doit le compléter pendant le développement. Ne jamais présenter comme
> implémentée une route, un payload ou une automatisation qui n'existe
> pas encore.

## 0. État d'avancement — mis à jour au Lot 2

Le document vivant, rempli à partir du code réel, est **`docs/N8N_HANDOFF.md`**.
Le gabarit ci-dessous reste la structure cible à compléter workflow par workflow.

| Élément | État au Lot 1 |
| --- | --- |
| Enveloppe d'événement versionnée | **Disponible et testée** — `apps/backend/src/events/business-event.ts` |
| Liste des `event_type` | **Figée** — 10 types validés par le schéma |
| Émission réelle d'un événement | **Aucune** |
| Contenu de `data` par événement | **Non figé** |
| Tables de comptes migrées | **Disponibles** — migrations 001 et 002 appliquées et vérifiées |
| Identifiants métier des comptes | **Disponibles** — `profiles.id` |
| Rôle fiable par compte | **Disponible** — `profiles.role`, attribué par le serveur, non falsifiable |
| Destinataires entreprise | **Disponibles** — table `company_accounts` |
| Vocabulaire des statuts ATS | **Figé et servi** — `GET /api/v1/reference` ; aucune transition implémentée |
| Tables missions / propositions / attributions | **Inexistantes** |
| Moteur de matching | **Inexistant** — poids et seuils figés, sans calcul |
| Outbox transactionnelle | **Inexistante** |
| Dispatcher vers n8n | **Inexistant** |
| Webhook entrant n8n → backend | **Inexistant** |
| Authentification machine-à-machine | **Inexistante** |
| Signature HMAC, anti-rejeu, retry | **Inexistants** |
| EmailService / Brevo | **Inexistant** — aucun email envoyé à ce jour |
| Variables d'environnement | **Noms figés**, aucune utilisée par du code |
| Workflow A (proposition) | **À implémenter** |
| Workflow B (acceptation) | **À implémenter** |

Prérequis backend avant toute construction de workflow : missions, propositions
et attributions en base ; matching déterministe ; outbox écrite dans la même
transaction que le changement métier ; dispatcher signé avec retry borné ;
authentification machine-à-machine ; contenu de `data` figé par `event_type`.
Le détail est en §7 de `docs/N8N_HANDOFF.md`.

## 1. Architecture

-   Frontend : React + TypeScript
-   Backend : Node.js + TypeScript
-   Base métier : Supabase/PostgreSQL
-   Base complémentaire : MongoDB
-   Emails : Brevo
-   Automatisation : n8n
-   Backend production prévu : `https://interimatch.onrender.com`

Principe : **frontend → backend → événement métier → n8n**.

Le frontend ne connaît pas l'URL privée du webhook n8n.

## 2. Événements prévus

-   `mission.created`
-   `mission.updated`
-   `mission.published`
-   `matching.completed`
-   `candidate.matched`
-   `candidate.accepted`
-   `candidate.refused`
-   `mission.filled`
-   `mission.unfilled`
-   `mission.completed`

## 3. Enveloppe standard

``` json
{
  "event_id": "uuid",
  "event_type": "matching.completed",
  "occurred_at": "ISO-8601",
  "schema_version": "1.0",
  "idempotency_key": "string",
  "data": {}
}
```

Le contenu réel de `data` doit être documenté à partir du code final.

## 4. Workflow prioritaire A --- notification d'un match

Statut : À implémenter.

Flux cible :

`mission → matching backend → matching.completed/candidate.matched → n8n → Brevo/notification`

À documenter quand le backend existe : - fichier/fonction émettrice ; -
endpoint ; - payload exact ; - seuil de matching ; - candidats transmis
; - sous-scores ; - gestion profils hors zone ; - destinataire ; -
template Brevo ; - retry ; - idempotence.

## 5. Workflow prioritaire B --- acceptation

Statut : À implémenter.

Flux cible :

`candidate.accepted → backend → événement → n8n → notification entreprise/confirmation`

À documenter : - validation préalable ; - effet DB ; - payload ; -
entreprise ; - intérimaire ; - mission ; - Brevo ; - passage éventuel de
mission à `filled`.

## 6. Fiche obligatoire pour chaque workflow

### Nom

`<nom>`

### Statut

`À implémenter / Backend prêt / n8n prêt / Testé E2E`

### Objectif

`<objectif>`

### Déclencheur

`<event_type>`

### Émetteur backend

`<fichier + fonction>`

### Endpoint

``` text
METHOD /api/v1/...
```

### Headers

``` text
Content-Type: application/json
...
```

### Authentification / signature

`<mécanisme réel>`

### Payload exact

``` json
{}
```

### Exemple anonymisé

``` json
{}
```

### Réponse attendue

``` json
{}
```

### Erreurs possibles

-   `<code> : <cause>`

### Retry

`<politique>`

### Idempotence

`<clé + comportement duplicate>`

### Tables PostgreSQL utilisées

-   `...`

### Collections MongoDB utilisées

-   `...`

### État avant

`...`

### État après

`...`

### Brevo

-   responsable de l'envoi :
-   template :
-   destinataire :
-   variables :

### Variables d'environnement

-   `...`

### Test curl

``` bash
curl ...
```

### Scénario nominal

1.  ...
2.  ...
3.  ...

### Scénarios d'erreur

1.  ...
2.  ...

## 7. Variables prévues

``` env
N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
WEBHOOK_SIGNING_SECRET=
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=
```

## 8. Checklist avant remise au développeur n8n

-   [ ] événements réellement implémentés ;
-   [ ] payloads versionnés ;
-   [ ] exemples anonymisés vérifiés ;
-   [ ] endpoint production connu ;
-   [ ] secret/signature testé ;
-   [ ] idempotence testée ;
-   [ ] retry documenté ;
-   [ ] erreurs documentées ;
-   [ ] Brevo testé ;
-   [ ] propriétaire de chaque email défini ;
-   [ ] commandes curl fonctionnelles ;
-   [ ] workflow Match documenté ;
-   [ ] workflow Acceptation documenté ;
-   [ ] variables Render documentées ;
-   [ ] aucun secret présent dans ce fichier ;
-   [ ] exports JSON n8n ajoutés après construction des workflows.
