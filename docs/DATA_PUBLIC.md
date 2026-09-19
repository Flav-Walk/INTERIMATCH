# Données publiques · France Travail

Ce document décrit l'architecture, le traitement et l'exploitation des données publiques issues de France Travail au sein de la plateforme InteriMatch (intégré au Lot 7 et consolidé au Lot 8).

---

## 1. Principe d'isolation des données

Les offres d'emploi publiques provenant de France Travail sont **strictement isolées** des missions internes déposées par les établissements partenaires d'InteriMatch :

* **Table séparée en base de données :** Les offres sont stockées dans une table dédiée `public_job_offers`, distincte des tables `missions` et `applications`.
* **Cloisonnement conceptuel :** Une offre France Travail n'est jamais assimilée à une mission InteriMatch :
  * Elle ne participe à aucun algorithme de matching automatique interne.
  * Aucun score d'affinité, badge de compatibilité ni explication de score n'est calculé pour une offre publique.
  * Il est impossible pour un intérimaire de postuler à une offre France Travail via le moteur de candidature InteriMatch (aucun bouton « Postuler », « Accepter » ou « Refuser » dans l'interface interne).
* **Redirection externe :** Chaque offre publique présente un lien direct et sécurisé (`target="_blank"`, `rel="noopener noreferrer"`) vers sa source externe sur le portail `candidat.francetravail.fr` pour permettre à l'utilisateur de postuler selon le canal officiel.

---

## 2. Ingestion, normalisation et reproductibilité

### Import reproductible depuis fixture
* Les données sources sont ingérées de manière reproductible et idempotente au moyen d'un script CLI d'importation côté backend (`apps/backend/src/scripts/import-france-travail.ts`).
* L'importation s'appuie sur un jeu de données représentatif du secteur de l'hôtellerie-restauration (codes ROME G14, G16, G18).
* Le traitement garantit l'idempotence grâce à une clé d'unicité composite (`source = 'france_travail'` et `external_id`).

### Normalisation des attributs
Lors de l'ingestion, chaque offre brute subit une passe de validation et de normalisation :
* **Codes et libellés de référence :** Extraction et normalisation des codes ROME (`rome_code`, `rome_label`), intitulés de postes et qualifications.
* **Types de contrat et durée :** Normalisation des libellés de contrat (ex. `MIS` pour mission d'intérim, `CDD`, `CDI`) et durées d'expérience.
* **Localisation et géolocalisation :** Nettoyage des libellés de commune (ex. « 69 - LYON »), codes postaux, et stockage des coordonnées géographiques (`latitude`, `longitude`) lorsqu'elles sont fournies.
* **Salaires et temps de travail :** Conservation des mentions brutes textuelles normalisées (ex. « Horaire de 12.31 Euros sur 12 mois »).
* **Compétences et qualités professionnelles :** Extraction sous forme de listes structurées d'objets avec indication du caractère requis ou souhaité.
* **Résilience aux données partielles ou hostiles :** Le modèle gère gracieusement l'absence d'entreprise (`company_name: null`), de salaire ou de coordonnées. Tout contenu textuel ou HTML hostile est rendu sous forme de texte brut sans interprétation balisée.

---

## 3. Exposition API et routes worker

L'accès aux offres publiques est réservé aux intérimaires authentifiés via des endpoints dédiés côté backend :

* `GET /api/v1/public-job-offers` :
  * Recherche paginée bornée (12 résultats par page) pour limiter l'empreinte réseau et respecter les principes d'écoconception (RGESN).
  * Filtre textuel `search` sur l'intitulé, la description et l'établissement.
  * Filtre par code postal / localisation.
* `GET /api/v1/public-job-offers/:id` :
  * Récupération de la fiche détaillée d'une offre publique par son identifiant ou identifiant externe.
  * Renvoi d'une erreur 404 standard si l'offre n'existe pas.

---

## 4. Exploitation dans l'interface utilisateur (Frontend)

Dans l'espace intérimaire (`apps/frontend/src/pages/WorkerPublicOffers.tsx` et `WorkerPublicOfferDetail.tsx`) :

* **Entrée dédiée dans la navigation :** Onglet « Offres France Travail » accessible dans l'en-tête de l'espace intérimaire.
* **Signalement visuel et sémantique clair :**
  * Bannière informative rappelant que ces offres proviennent d'une source publique externe et ne font l'objet d'aucun matching automatique.
  * Badge visuel distinctif « France Travail » sur chaque carte de mission publique (`PublicOfferCard`).
* **Fiche détaillée :**
  * Affichage des compétences requises et souhaitées, des qualités professionnelles, du salaire et des horaires lorsqu'ils sont renseignés.
  * Bouton d'action principal « Postuler sur France Travail » ouvrant la page source externe dans un nouvel onglet avec signalement d'accessibilité `(nouvelle fenêtre)`.

---

## 5. Statut du provider live France Travail

* **État actuel :** Le connecteur live temps réel à l'API France Travail (OAuth client credentials / API Offres d'emploi v2 de France Travail) **n'est pas encore branché en production**.
* **Mode opératoire réel :** La plateforme opère actuellement à partir de la table `public_job_offers` alimentée de façon reproductible par lot (batch / fixture).
* Aucune dépendance réseau externe synchrone n'est requise lors des requêtes utilisateurs sur le frontend, assurant une haute disponibilité, une immunité contre les pannes tierces et le respect des quotas d'appels API.
