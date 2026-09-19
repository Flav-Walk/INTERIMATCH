# Données publiques — Intégration France Travail (Lot SL2e)

## 1. Source choisie et justification
- **Source retenue pour le POC** : deux exports JSON au format des offres France Travail. Aucune connexion live à l'API France Travail ni vérification indépendante de licence n'est revendiquée par ce lot.
- **Rôle fonctionnel** : Enrichir le vivier d'opportunités consultables par les intérimaires en complément des missions exclusives de la plateforme, sans polluer le modèle transactionnel propre à InteriMatch.
- **Séparation stricte** : Une offre externe France Travail n'est jamais assimilée à une mission InteriMatch (pas de matching automatique trompeur, pas d'attribution directe, pas de cycle de vie draft/open/filled/completed InteriMatch).
- **Provenance & date d'extraction** :
  - Fixtures de référence versionnées : `apps/backend/src/public-data/fixtures/offres_france_travail.json` (1 offre) et `offres_france_travail_10.json` (10 offres).
  - Dates d'extraction source : 18 septembre 2026.
  - Localisation cible : Métropole de Lyon (code commune 69123 / arrondissements 69002, 69003, 69005, 69006, 69007, 69120, 69280).

## 2. Pipeline de traitement des données
Le pipeline suit la chaîne imposée par le cahier des charges :
**Récupération → Validation → Nettoyage → Normalisation → Stockage idempotent → Exploitation UI & API**.

```
[ Flux JSON France Travail ]
             │
             ▼
[ extractRawOffers ] (recherches[].offres[], resultats[], offres[], tableau ou offre directe ; enveloppe ambiguë rejetée)
             │
             ▼
[ normalizeFranceTravailOffer ]
  ├── Validation présence ID externe et Intitulé
  ├── Trim des chaînes & conversion des chaînes vides en null
  ├── Tolérance objets vides (entreprise, salaire, contact)
  ├── Gestion des coordonnées GPS manquantes
  ├── Normalisation des compétences ({ name, required: boolean })
  ├── Normalisation des qualités professionnelles
  ├── Assainissement de l'URL source (filtrage protocoles dangereux http/https)
  └── Calcul de la signature sha256 (raw_checksum)
             │
             ▼
[ PublicJobOfferService.importFromPayload ]
  ├── Dédoublonnage au sein du même lot (version source la plus récente)
  ├── UPSERT atomique par (source='france_travail', external_id)
  ├── Comparaison par raw_checksum :
  │     ├── Nouveau : INSERT -> compteur created
  │     ├── Identique : AUCUNE ÉCRITURE -> compteur unchanged
  │     └── Modifié : UPDATE -> compteur updated
  └── Production des compteurs de traitement (received, accepted, rejected, created, updated, unchanged, duplicates)
```

## 3. Modèle de données & Schéma PostgreSQL
Table dédiée `public_job_offers` (migration additive `009_public_job_offers.sql`) :

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` | Identifiant interne primaire InteriMatch |
| `source` | `text` | Source de données (`'france_travail'`) |
| `external_id` | `text` | Identifiant source France Travail (ex: `'5968295'`, `'213HXKM'`) |
| `title` | `text` | Intitulé propre de l'offre (jamais l'intitulé de recherche) |
| `description` | `text` | Description du poste (nettoyée) |
| `rome_code` | `text` | Code ROME métier (ex: `'G1802'`, `'G1803'`, `'G1703'`) |
| `rome_label` | `text` | Libellé normalisé du code ROME |
| `company_name` | `text` (nullable) | Nom de l'établissement ou de l'agence si renseigné |
| `contract_type` | `text` | Type de contrat (ex: `'MIS'`) |
| `contract_label` | `text` | Libellé lisible (ex: `'Intérim - 1 Mois'`) |
| `experience_label`| `text` (nullable) | Expérience requise (ex: `'Débutant accepté'`, `'3 Mois'`) |
| `postal_code` | `text` (nullable) | Code postal à 5 chiffres si présent |
| `city` | `text` | Ville ou libellé de commune |
| `latitude` | `double precision` | Coordonnée géographique (nullable) |
| `longitude` | `double precision` | Coordonnée géographique (nullable) |
| `salary_label` | `text` (nullable) | Rémunération indicative si renseignée |
| `working_time` | `text` (nullable) | Durée hebdomadaire convertie si présente |
| `positions` | `integer` | Nombre de postes à pourvoir (défaut 1) |
| `skills` | `jsonb` | Tableau des compétences `[{ name, required }]` |
| `professional_qualities` | `jsonb` | Tableau des qualités `[{ label, description }]` |
| `source_url` | `text` (nullable) | Lien sécurisé vers l'offre originale France Travail |
| `created_at_source` | `timestamptz` | Date de publication originale |
| `updated_at_source` | `timestamptz` | Date d'actualisation source |
| `imported_at` | `timestamptz` | Horodatage de l'import InteriMatch |
| `raw_checksum` | `text` | Empreinte SHA256 des données utiles |

Contrainte d'unicité stricte :
`CONSTRAINT public_job_offers_source_external_id_key UNIQUE (source, external_id)`

Sécurité de la table :
Row Level Security (RLS) activée, droits révoqués pour `PUBLIC`, `anon` et `authenticated`. Accès exclusif via le backend applicatif.

Le migrateur et le backend PostgreSQL utilisent tous deux le rôle porté par la
même `DATABASE_URL`. La table appartient donc à ce rôle, qui peut y accéder malgré
la RLS ; les rôles Supabase `anon` et `authenticated` ne le peuvent pas. Si un
rôle runtime distinct du propriétaire est introduit, une policy et des grants
explicites devront être ajoutés avant le déploiement.

## 4. Règles de normalisation et cas réels couverts
1. **Entreprise vide** : Si `entreprise: {}` ou `nom` absent, la valeur est stockée à `null` et l'UI affiche « Établissement non communiqué ».
2. **Salaire vide** : Si `salaire: {}` ou non précisé, stocké à `null`.
3. **Compétences et qualités absentes** : Initialisées à des tableaux vides `[]`.
4. **Coordonnées GPS absentes** : Tolérées et stockées à `null`.
5. **Intitulé de recherche vs Intitulé de poste** : Une recherche « Réceptionniste » ayant remonté un poste « Réceptionnaire automobile H/F » conserve scrupuleusement l'intitulé et le code ROME réels du poste.
6. **URLs externes sécurisées** : Seuls les protocoles `http:` et `https:` sont conservés. Tout protocole suspect (ex: `javascript:`) est rejeté.
7. **Aucune donnée personnelle inutile** : Aucun contact individuel ni donnée personnelle sensible n'est persisté.

## 5. Dédoublonnage et Idempotence
- **Dédoublonnage au sein du lot** : Si un même `external_id` se répète, la version portant la `dateActualisation` la plus récente est traitée. À date égale ou absente, la dernière occurrence gagne. Les IDs sont trimés mais restent sensibles à la casse.
- **Idempotence inter-imports** :
  - Import #1 : Toutes les offres valides sont insérées (`created: N`).
  - Import #2 (identique) : Détection par `raw_checksum`, aucune modification en base (`unchanged: N`).
  - Import #3 (avec modification d'un champ ou date) : Mise à jour de l'offre existante et actualisation de `imported_at` (`updated: 1`).

Les lignes invalides sont rejetées individuellement : les lignes valides du même
lot sont importées. Il n'existe pas de transaction globale du fichier. Une erreur
DB interrompt l'import ; les offres atomiquement écrites avant cette erreur restent
présentes et aucun résumé de succès n'est alors retourné.

## 6. Outil CLI reproductible
Commande disponible dans `apps/backend/package.json` :

```bash
npm run data:france-travail -- <chemin_du_fichier.json>
```

Exemple d'exécution :
```
France Travail import
---------------------
Received: 10
Accepted: 10
Rejected: 0
Created: 9
Updated: 0
Unchanged: 1
Duplicates: 0
```

En cas de fichier manquant, JSON invalide ou enveloppe métier invalide, un message
clair est affiché et le processus retourne un code non nul avant toute connexion DB.

## 7. API InteriMatch
Endpoints disponibles sous `/api/v1` :
- `GET /api/v1/public-job-offers` :
  - authentification requise, rôle `worker` uniquement ;
  - Paramètres de requête supportés :
    - `search` : recherche textuelle sur titre, description, entreprise, ROME.
    - `rome` : filtrage exact par code ROME (ex: `G1803`).
    - `location` : filtrage par code postal ou commune (ex: `69002`, `Lyon`).
    - `contract_type` : filtrage par type de contrat.
    - `page` : numéro de page (défaut 1).
    - `limit` : taille de page (défaut 20, max 100).
  - Réponse paginée : `{ offers: PublicJobOfferDto[], total, page, limit, total_pages }`.
  - `%`, `_` et `\` dans `search`/`location` sont recherchés littéralement.
- `GET /api/v1/public-job-offers/:id` :
  - authentification requise, rôle `worker` uniquement ;
  - Recherche par UUID interne ou identifiant externe France Travail.
  - Si la chaîne est un UUID, l'UUID interne a priorité ; à défaut, l'identifiant externe est recherché.
  - Renvoie le DTO de l'offre ou une erreur 404 standard InteriMatch.

## 8. Exploitation Frontend
- **Emplacement** : Section dédiée **Offres France Travail** dans l'espace intérimaire (`/worker/public-offers` et `/worker/public-offers/:id`).
- **Lien dans la navigation** : Onglet avec icône Globe dans l'en-tête de l'espace intérimaire.
- **Passerelle de découvrabilité** : Encart informatif dans la page des missions intérimaire orientant vers le catalogue public.
- **Distinction visuelle et fonctionnelle stricte** :
  - Badge bleu spécifique `France Travail`.
  - Bandeau d'avertissement précisant la provenance externe et l'absence de matching automatique InteriMatch.
  - Absence totale d'actions réservées aux missions InteriMatch : **AUCUN** bouton « Accepter la mission », « Refuser », « Candidater », aucun score de matching.
  - Bouton externe sécurisé « Postuler sur France Travail » ouvrant l'offre originale dans un nouvel onglet (`target="_blank" rel="noopener noreferrer"`).
- **Gestion des états** : Squelettes de chargement, état vide explicite avec bouton de réinitialisation des filtres, gestion des erreurs, support des données partielles, responsive desktop/mobile sans débordement horizontal.

## 9. Validation et Tests
- **Tests unitaires normaliseur** (`apps/backend/src/public-data/normalizer.test.ts`) : structures, champs hostiles, checksum canonique et fixtures versionnées.
- **Tests d'intégration service et API** (`apps/backend/src/public-data/public-data.test.ts`) : idempotence, concurrence, dédoublonnage, autorisation, filtres, pagination et routes HTTP sur PGlite en mémoire.
- **Tests service frontend** (`apps/frontend/src/services/publicOffers.test.ts`) : appels, encodage et validation défensive des URLs externes.
- **Tests E2E Playwright UI** (`apps/frontend/e2e/public-data.spec.ts`) : parcours validés sur Desktop et Mobile avec interception des routes d'offres publiques ; ils ne constituent pas un E2E full-stack frontend/backend/PostgreSQL.

## 10. Limite du provider live

`ApiFranceTravailProvider` est volontairement un squelette non branché. Il ne
contient ni secret ni endpoint inventé et lève toujours une erreur explicite,
même si des credentials sont fournis. Le pipeline réellement exploitable dans ce
lot est l'import de fixture JSON via la CLI ; aucune récupération live ne doit être
annoncée comme opérationnelle.
