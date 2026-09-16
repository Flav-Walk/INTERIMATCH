# Passation n8n — préparation documentaire

Basé sur `N8N_HANDOFF_TEMPLATE.md`. **Statut : À implémenter. Socle backend créé ; aucun workflow prêt.** Ne pas construire d’intégration sur la base de routes supposées.

## 1. Architecture cible

Frontend → backend → transaction métier + outbox → dispatcher → n8n → Brevo. PostgreSQL fait autorité ; MongoDB contient les traces complémentaires. API de production prévue : `https://interimatch.onrender.com`, non vérifiée/déployée dans ce Lot 0.

## 2. Événements prévus, aucun émetteur réel

`mission.created`, `mission.updated`, `mission.published`, `matching.completed`, `candidate.matched`, `candidate.accepted`, `candidate.refused`, `mission.filled`, `mission.unfilled`, `mission.completed`.

## 3. Enveloppe validée dans le code, données métier non figées

Champs validés par le schéma : `event_id` UUID, `event_type`, `occurred_at` ISO-8601 UTC, `schema_version` « 1.0 », `idempotency_key`, `data`. Aucun payload métier réel de `data` disponible. Les futures tentatives de livraison devront conserver le même event_id et la même clé d’idempotence.

## 4. Workflow A — proposition compatible

Objectif : informer l’intérimaire après publication, calcul et enregistrement d’une proposition valide. Déclenchement candidat : `candidate.matched`, à figer avec le code. Ne pas notifier un brouillon ni envoyer à nouveau depuis `matching.completed` pour la même proposition. Seuils et hors-zone décrits dans DECISIONS.md. Propriétaire prévu de l’email : n8n.

## 5. Workflow B — acceptation

Objectif : informer l’entreprise après enregistrement atomique d’une acceptation. Déclenchement candidat : `candidate.accepted`. Cette acceptation ne signifie pas attribution définitive. Propriétaire prévu de l’email : n8n.

## 6. Fiches opérationnelles à compléter depuis le code

Pour A et B, tous les éléments suivants sont **indisponibles** : fichier/fonction émettrice, endpoint/méthode, headers, authentification/signature exacte, payload, exemple anonymisé, réponse, codes d’erreur, politique de retry, déduplication réelle, tables/collections migrées, transitions implémentées, template Brevo, curl exécutable et scénarios automatisés. Reprendre la fiche complète du gabarit lorsque chaque événement existe ; ne pas remplacer ces manques par des exemples inventés.

## 7. Fiabilité à mettre en œuvre

Outbox transactionnelle ; signature HMAC du corps brut et timestamp ; contrôle anti-rejeu ; idempotence persistante du consommateur ; reprise bornée avec backoff et échec final visible. Schéma des headers et délais à figer/tester au Lot 6. Une garantie « exactement une fois » ne doit pas être annoncée : traiter explicitement le cas d’un envoi Brevo réussi suivi d’une perte d’accusé de réception.

Variables prévues : `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `WEBHOOK_SIGNING_SECRET`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`. Aucune valeur requise maintenant. Définir des rôles distincts pour le secret d’accès et celui de signature avant implémentation.

## 8. Propriété des emails

| Type | Propriétaire prévu |
| --- | --- |
| Auth classique : vérification/récupération | Backend / EmailService Brevo |
| Proposition de mission compatible | n8n |
| Acceptation reçue | n8n |
| Attribution confirmée | n8n |
| Mission non pourvue, si implémentée | n8n |

Aucun secours backend pour les emails métier sans décision explicite transférant leur propriété. Notifications en application détenues par le backend.

## 9. Avant remise opérationnelle

- [ ] Émetteurs, payloads versionnés et exemples vérifiés.
- [ ] Deux workflows réels réalisés par le développeur n8n.
- [ ] Signature, rejeu, doublons et retry testés.
- [ ] Propriété des emails et templates Brevo vérifiés.
- [ ] Endpoints, réponses, erreurs et curl issus du code.
- [ ] Tests E2E des deux parcours et exports/captures livrés.
- [ ] Aucun secret ni donnée personnelle réelle dans la passation.


## Fondation effectivement implémentée

apps/backend/src/events/business-event.ts exporte businessEventSchema et BusinessEvent : validation stricte des six champs, UUID, date ISO UTC, version 1.0, event_type dans la liste, clé non vide, data objet générique. Aucun événement émis, aucune route n8n, signature/retry/outbox encore absents. Le healthcheck ne déclenche rien. Aucun payload métier exact ni service Brevo disponible.
