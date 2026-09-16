# Passation n8n — état au Lot 1

Basé sur `N8N_HANDOFF_TEMPLATE.md`.

> **Statut des workflows : À implémenter. Aucun événement métier n'est émis par le backend à ce jour.** Ne construire aucun workflow sur la base d'une route supposée. Tout ce qui est marqué « disponible » ci-dessous a été exécuté et vérifié ; tout le reste est explicitement marqué « indisponible ».

## 1. Architecture cible

`Frontend → backend → transaction métier + outbox → dispatcher → n8n → Brevo`.

PostgreSQL fait autorité ; MongoDB contiendra les traces complémentaires (non utilisé au Lot 1). API de production prévue : `https://interimatch.onrender.com`, **non déployée et non vérifiée**. Le frontend ne connaît pas l'URL du webhook n8n et ne doit jamais la connaître.

## 2. Ce qui est réellement disponible aujourd'hui

### Authentification et comptes — disponible

Le contrat complet est dans [API_CONTRACT.md](API_CONTRACT.md). Résumé utile au développeur n8n :

| Méthode | Route | Auth | Rôle |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | aucune | — |
| POST | `/api/v1/auth/register` | Origin | — |
| POST | `/api/v1/auth/login` | Origin | — |
| POST | `/api/v1/auth/google` | Origin | — |
| POST | `/api/v1/auth/refresh` | cookie `im_refresh` | — |
| POST | `/api/v1/auth/logout` | cookie + bearer | — |
| GET | `/api/v1/me` | bearer | tout rôle |
| PUT | `/api/v1/me/role` | bearer | rôle non encore choisi |
| GET | `/api/v1/skills` | bearer | tout rôle |
| GET | `/api/v1/workers/me` | bearer | `worker` |
| GET | `/api/v1/companies/me` | bearer | `company` |
| PUT | `/api/v1/onboarding/worker` | bearer | `worker` |
| PUT | `/api/v1/onboarding/company` | bearer | `company` |

**Ces routes ne sont pas conçues pour n8n.** Elles exigent un en-tête `Origin` égal à `FRONTEND_URL` ou un bearer de session navigateur. Aucune authentification machine-à-machine n'existe encore : le point d'entrée pour n8n reste à créer (voir §7).

### Tables migrées — disponible

`migrations/001_accounts.sql`, appliquée et vérifiée sur le projet Supabase.

| Table | Rôle | Colonnes utiles à n8n |
| --- | --- | --- |
| `profiles` | Identité applicative, source des IDs métier | `id` (uuid, **l'identifiant métier à utiliser partout**), `email`, `role`, `first_name`, `last_name`, `onboarding_completed`, `active`, `demo`, `created_at`, `updated_at` |
| `credentials` | Hash Argon2id de l'auth classique | `profile_id` — **ne jamais lire ni transmettre** |
| `sessions` | Sessions opaques | hashes uniquement — **ne jamais lire ni transmettre** |
| `worker_profiles` | Profil intérimaire | `profile_id`, `city`, `postal_code`, `latitude`, `longitude`, `mobility_radius_km`, `main_job` |
| `company_profiles` | Profil entreprise | `profile_id`, `legal_name`, `establishment_name`, `sector`, `address`, `city`, `postal_code`, `latitude`, `longitude`, `phone`, `description` |
| `skills` | Catalogue, 8 entrées | `id`, `name` |
| `worker_skills` | Liaison | `profile_id`, `skill_id` |
| `experiences` | Expériences | `id`, `profile_id`, `job_title`, `employer`, `years` |
| `availabilities` | Créneaux, intervalles `[début, fin)` en UTC | `id`, `profile_id`, `starts_at`, `ends_at` |
| `schema_migrations` | Suivi des migrations | `name`, `checksum`, `applied_at` |

RLS est activée et `anon`/`authenticated` sont révoqués sur toutes ces tables : **n8n ne doit pas y accéder via PostgREST ni par la clé publiable.** Toute lecture passera par un endpoint backend dédié.

Identifiants métier : `profiles.id` est l'identifiant stable d'un intérimaire comme d'une entreprise. `worker_profiles.profile_id` et `company_profiles.profile_id` pointent la même valeur. Les identifiants de mission, proposition et attribution n'existent pas encore.

### Enveloppe d'événement — disponible, mais sans émetteur

`apps/backend/src/events/business-event.ts` exporte `businessEventSchema` et `BusinessEvent`, et les tests `business-event.test.ts` verrouillent le contrat.

```json
{
  "event_id": "uuid",
  "event_type": "candidate.matched",
  "occurred_at": "2027-01-02T12:00:00Z",
  "schema_version": "1.0",
  "idempotency_key": "string non vide",
  "data": {}
}
```

Validation stricte : `event_id` UUID, `occurred_at` ISO-8601, `schema_version` obligatoirement `"1.0"`, `idempotency_key` non vide, `data` objet, et **aucun champ supplémentaire accepté**. Un `event_type` hors liste est refusé.

`event_type` autorisés : `mission.created`, `mission.updated`, `mission.published`, `matching.completed`, `candidate.matched`, `candidate.accepted`, `candidate.refused`, `mission.filled`, `mission.unfilled`, `mission.completed`.

**Aucun de ces événements n'est produit à ce jour.** Le contenu de `data` n'est pas figé. Une tentative de livraison rejouée devra conserver le même `event_id` et la même `idempotency_key`.

### Variables d'environnement — noms figés, valeurs à fournir

`N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `WEBHOOK_SIGNING_SECRET`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`. Déclarées et validées par la configuration backend, **aucune n'est utilisée par du code**. Le secret d'accès et le secret de signature restent deux rôles distincts.

## 3. Workflow A — proposition compatible

Statut : **À implémenter.** Objectif : informer l'intérimaire après publication d'une mission, calcul du matching et enregistrement d'une proposition valide. Déclencheur candidat : `candidate.matched`, à figer avec le code.

Ne pas notifier un brouillon, et ne pas renvoyer depuis `matching.completed` pour la même proposition. Seuils et traitement hors zone : D04 de [DECISIONS.md](DECISIONS.md). Propriétaire de l'email : n8n.

## 4. Workflow B — acceptation

Statut : **À implémenter.** Objectif : informer l'entreprise après enregistrement atomique d'une acceptation. Déclencheur candidat : `candidate.accepted`. Une acceptation **n'est pas** une attribution (D03). Propriétaire de l'email : n8n.

## 5. Fiche opérationnelle — éléments encore indisponibles

Pour A comme pour B, restent **indisponibles** : fichier et fonction émettrice, endpoint et méthode, en-têtes, authentification et signature exactes, payload `data`, exemple anonymisé, réponse, codes d'erreur, politique de retry, déduplication réelle, transitions d'état implémentées, template Brevo, curl exécutable et scénarios automatisés. Reprendre la fiche complète du gabarit quand chaque événement existera. Ne pas combler ces manques par des exemples inventés.

## 6. Fiabilité à mettre en œuvre

Outbox transactionnelle ; signature HMAC du corps brut avec timestamp ; contrôle anti-rejeu ; idempotence persistante côté consommateur ; reprise bornée avec backoff et échec final visible. Schéma des en-têtes et délais à figer et tester au Lot 6.

Ne pas annoncer une garantie « exactement une fois » : traiter explicitement le cas d'un envoi Brevo réussi suivi d'une perte d'accusé de réception.

## 7. Ce que le backend doit livrer avant la construction des workflows

1. Tables `missions`, `propositions` et `attributions`, avec leurs identifiants métier et leurs statuts.
2. Moteur de matching déterministe produisant des sous-scores explicables (D04).
3. Table d'outbox écrite **dans la même transaction** que le changement métier.
4. Dispatcher lisant l'outbox et appelant `N8N_WEBHOOK_URL`, avec signature HMAC et retry borné.
5. Authentification machine-à-machine pour les appels entrants de n8n vers le backend, distincte des sessions navigateur.
6. Contenu de `data` figé par `event_type`, versionné et testé.

Tant que les points 1 à 4 n'existent pas, aucun workflow ne peut être branché sur autre chose qu'un exemple fictif.

## 8. Propriété des emails

| Type | Propriétaire prévu |
| --- | --- |
| Auth classique : vérification, récupération | Backend / EmailService Brevo — **non implémenté** |
| Proposition de mission compatible | n8n |
| Acceptation reçue | n8n |
| Attribution confirmée | n8n |
| Mission non pourvue, si implémentée | n8n |

Aucun secours backend pour les emails métier sans décision explicite transférant leur propriété. Les notifications en application appartiennent au backend. Aucun email n'a été envoyé pendant le développement du Lot 1.

## 9. Avant remise opérationnelle

- [ ] Émetteurs, payloads versionnés et exemples vérifiés.
- [ ] Deux workflows réels réalisés par le développeur n8n.
- [ ] Signature, rejeu, doublons et retry testés.
- [ ] Propriété des emails et templates Brevo vérifiés.
- [ ] Endpoints, réponses, erreurs et curl issus du code.
- [ ] Tests E2E des deux parcours, exports et captures livrés.
- [ ] Aucun secret ni donnée personnelle réelle dans la passation.

Acquis au Lot 1 : enveloppe versionnée et testée, identifiants métier des comptes, tables de comptes migrées et vérifiées, noms de variables figés, contrat d'API des comptes documenté depuis le code.
