# INTERIMATCH --- CAHIER DES CHARGES

> Mise à jour de consigne : opérations Git locales nécessaires autorisées,
> sans commit, push, PR ni publication. Cette consigne remplace la restriction
> antérieure du §24. Remote officiel : https://github.com/Flav-Walk/INTERIMATCH.git.
> `image.png` est la référence Intérimaire et la direction artistique commune ;
> l’Entreprise en est une adaptation métier distincte.

## Source de vérité fonctionnelle et technique

**Projet :** D-WEB-901 --- POC 11 jours\
**Secteur :** Hôtellerie / Restauration\
**Priorité :** espaces Intérimaire et Entreprise\
**Statut :** document de référence à placer à la racine du dépôt

------------------------------------------------------------------------

## 1. Vision et objectif

Interimatch est une plateforme web de mise en relation entre entreprises
de l'hôtellerie-restauration et intérimaires.

Proposition de valeur :

> Mettre automatiquement en relation les entreprises avec des
> intérimaires disponibles et compatibles afin de réduire le délai entre
> la création d'une mission et sa prise en charge.

Flux métier prioritaire :

`MISSION → ÉLIGIBILITÉ → MATCHING/SCORING → PROPOSITION/NOTIFICATION → ACCEPTATION OU REFUS → ATTRIBUTION → MISSION POURVUE → MISSION TERMINÉE`

Le POC doit être réellement démontrable de bout en bout. Les
fonctionnalités secondaires ne doivent pas compromettre ce flux.

------------------------------------------------------------------------

## 2. Sources et ordre de priorité

Pour le développement, utiliser dans cet ordre :

1.  le sujet officiel EPITECH présent à la racine ;
2.  le présent `CAHIER_DES_CHARGES.md` ;
3.  la note de cadrage / PowerPoint de l'équipe ;
4.  `image.png` pour la direction UI/UX ;
5.  les décisions techniques documentées pendant le développement.

En cas de contradiction avec une exigence obligatoire EPITECH,
l'exigence EPITECH prime et la décision doit être documentée.

------------------------------------------------------------------------

## 3. Retours du follow-up à corriger

Le projet a reçu un **Go** avec quatre réserves :

1.  dysfonctionnement du mécanisme de matching/scoring ;
2.  périmètre fonctionnel insuffisamment détaillé ;
3.  automatisation n8n côté candidats à réexaminer ;
4.  roadmap à corriger.

Ces quatre points sont traités explicitement dans ce document.

------------------------------------------------------------------------

## 4. Utilisateurs

### 4.1 Intérimaire --- priorité P0

L'intérimaire doit pouvoir : - créer/se connecter à son compte ; -
utiliser Google OAuth via Supabase ; - compléter son onboarding ; -
gérer son profil ; - renseigner ses métiers et compétences ; -
renseigner son expérience ; - renseigner ses disponibilités ; -
renseigner sa localisation et son rayon de mobilité ; - consulter les
missions proposées/compatibles ; - comprendre pourquoi une mission
correspond à son profil ; - accepter ou refuser une proposition ; -
suivre ses missions/candidatures ; - consulter ses notifications ; -
gérer ses paramètres essentiels.

### 4.2 Entreprise --- priorité P0

L'entreprise doit pouvoir : - créer/se connecter à son compte ; -
utiliser Google OAuth via Supabase ; - compléter son onboarding ; -
gérer le profil de l'établissement ; - créer une mission ; - modifier
une mission ; - publier/ouvrir une mission ; - annuler une mission
lorsque permis ; - consulter ses missions ; - consulter les intérimaires
compatibles ; - comprendre le score de chaque candidat ; - afficher
volontairement les profils hors zone ; - suivre acceptations/refus ; -
attribuer une mission ; - suivre l'état des missions ; - consulter
notifications et planning.

### 4.3 Admin --- P1/P2

L'architecture doit prévoir le rôle `admin`, mais son interface n'est
pas prioritaire.

Fonctions futures possibles : - gestion utilisateurs ; - modération ; -
supervision missions ; - audit ; - statistiques ; - gestion
référentiels.

------------------------------------------------------------------------

## 5. UI/UX

`image.png` est la référence visuelle présente à la racine.

Elle doit servir de direction artistique et non de spécification
fonctionnelle exhaustive.

Le développement doit identifier explicitement à quel espace correspond
la maquette à partir des indications projet, puis décliner le même
design system pour l'autre espace.

Principes : - univers hôtellerie/restauration ; - fond clair ; - vert
profond ; - accent orange ; - hiérarchie forte ; - cartes lisibles ; -
interface chaleureuse et professionnelle ; - navigation simple ; - états
loading / empty / error / success ; - responsive desktop, tablette et
mobile ; - pas de dashboard générique de type « interface IA ».

Les espaces Entreprise et Intérimaire partagent le design system, mais
leurs dashboards et informations doivent être adaptés à leur métier.

------------------------------------------------------------------------

## 6. Authentification et rôles

Fournisseur principal : **Supabase Auth**.

Connexion souhaitée en priorité : - Google OAuth via Supabase.

Le sujet officiel doit être vérifié avant implémentation définitive.
S'il exige une authentification classique email/mot de passe
comprise/implémentée par l'équipe, celle-ci doit également être
conservée.

Après première authentification : 1. déterminer si le compte possède
déjà un rôle ; 2. sinon demander `interimaire` ou `entreprise` ; 3.
lancer l'onboarding correspondant ; 4. créer le profil métier ; 5.
rediriger vers le dashboard adapté.

Toute autorisation métier doit être vérifiée côté backend.

Rôles : - `interimaire` - `entreprise` - `admin`

Aucun secret Supabase serveur ne doit être exposé au frontend.

------------------------------------------------------------------------

## 7. Espace Intérimaire

### 7.1 Dashboard

Afficher au minimum : - état de complétion du profil ; - prochaines
disponibilités ; - propositions/missions compatibles ; - propositions en
attente ; - missions acceptées ; - prochaines missions ; - notifications
; - accès rapide au profil et disponibilités.

### 7.2 Profil

Données minimales : - prénom ; - nom ; - email ; - téléphone si retenu
; - photo optionnelle ; - localisation de référence ; - coordonnées
géographiques si utilisées ; - rayon de mobilité ; - métiers ; -
compétences ; - expériences ; - niveau/années d'expérience lorsque
pertinent ; - diplômes/certifications utiles ; - profil actif/inactif.

### 7.3 Disponibilités

Représenter au minimum : - date ; - heure de début ; - heure de fin ; -
état disponible/indisponible.

Les disponibilités récurrentes sont un bonus si le P0 est déjà stable.

### 7.4 Missions proposées

Afficher : - entreprise ; - poste ; - description courte ; - date ; -
horaires ; - localisation ; - distance ; - rémunération ; - compétences
; - score/compatibilité ; - explication synthétique ; - accepter/refuser
lorsque la proposition existe.

------------------------------------------------------------------------

## 8. Espace Entreprise

### 8.1 Dashboard

Afficher au minimum : - CTA création de mission ; - missions
brouillon/ouvertes/pourvues/terminées ; - candidatures/réponses récentes
; - candidats compatibles récents ; - planning ; - alertes/notifications
; - indicateurs simples utiles.

### 8.2 Profil entreprise

Données : - raison sociale ; - nom commercial/établissement ; - SIRET si
retenu ; - adresse ; - ville ; - code postal ; - coordonnées
géographiques utiles au matching ; - secteur ; - contact ; - email ; -
téléphone optionnel ; - logo optionnel ; - description.

### 8.3 Mission

Données minimales : - UUID ; - entreprise ; - titre/poste ; -
description ; - date ; - heure début ; - heure fin ; - adresse ; - ville
; - latitude/longitude ou donnée géographique exploitable ; -
rémunération ; - unité de rémunération ; - nombre d'intérimaires
recherchés ; - compétences obligatoires ; - compétences souhaitées si
utile ; - expérience attendue ; - critères complémentaires ; - statut
; - created_at ; - updated_at.

Statuts P0 : - `draft` - `open` - `filled` - `completed` - `cancelled`

### 8.4 Liste de candidats

Afficher : - identité métier utile ; - compétences correspondantes ; -
disponibilité ; - distance ; - expérience ; - score total ; -
sous-scores ; - explication ; - état de proposition.

Filtres : - meilleur score ; - `70+` ; - `60–69` ; - `50–59` ; - hors
zone ; - en attente ; - accepté ; - refusé.

------------------------------------------------------------------------

## 9. Matching/scoring corrigé

### 9.1 Principes

Le POC utilise un moteur : - déterministe ; - explicable ; - testable
; - configurable ; - sans IA complexe nécessaire.

Un score ne doit jamais masquer une incompatibilité bloquante.

### 9.2 Éligibilité

Avant scoring : - mission `open` ; - profil `active` ; - disponibilité
compatible ; - absence de conflit temporel bloquant.

La localisation est un critère important mais ne doit pas rendre les
profils invisibles. Un candidat peut être `outside_zone=true` et rester
consultable par l'entreprise.

### 9.3 Score initial configurable

  Critère                       Maximum initial
  --------------------------- -----------------
  Compétences                                45
  Localisation                               25
  Expérience                                 20
  Adéquation complémentaire                  10
  **Total**                             **100**

Ces poids sont une configuration POC, pas une vérité métier. Ils doivent
être centralisés et modifiables.

### 9.4 Résultat

Exemple de contrat :

``` json
{
  "candidate_id": "uuid",
  "eligible": true,
  "outside_zone": false,
  "score": 84,
  "band": "70+",
  "breakdown": {
    "skills": 40,
    "location": 20,
    "experience": 16,
    "availability": 8
  },
  "reasons": [
    "4/5 compétences requises",
    "8 km du lieu",
    "expérience compatible"
  ]
}
```

### 9.5 Paliers

Ordre : 1. score `>=70` ; 2. si aucun résultat pertinent : `60–69` ; 3.
puis `50–59` ; 4. `<50` : pas de notification automatique par défaut.

Le palier utilisé doit être connu du système et transmissible à n8n.

### 9.6 Tests minimum

Tester : - candidat parfait ; - candidat indisponible ; - candidat hors
zone ; - compétences partielles ; - expérience insuffisante ; - aucun
profil \>=70 ; - fallback 60--69 ; - fallback 50--59 ; - égalité de
scores ; - mission fermée ; - profil inactif ; - données manquantes
gérées proprement.

------------------------------------------------------------------------

## 10. Acceptation/refus/attribution

États de proposition : - `pending` - `accepted` - `refused` -
`expired` - `cancelled`

Acceptation : 1. vérifier que la proposition est valide ; 2. éviter la
double acceptation ; 3. enregistrer atomiquement ; 4. émettre
l'événement métier ; 5. informer l'entreprise ; 6. si tous les postes
sont attribués, passer la mission à `filled`.

Refus : - enregistrer ; - émettre l'événement ; - poursuivre le
processus avec les autres candidats lorsque nécessaire.

------------------------------------------------------------------------

## 11. Architecture technique

### 11.1 Branches

Trois branches :

-   `main` : stable / intégration ;
-   `frontend` : frontend destiné à Vercel ;
-   `backend` : backend destiné à Render.

Les déploiements ne doivent pas utiliser `main`.

### 11.2 Frontend

-   React ;
-   TypeScript ;
-   Vite ;
-   React Router ;
-   client API ;
-   Supabase JS pour auth/session ;
-   composants réutilisables ;
-   design system ;
-   responsive ;
-   accessibilité de base.

### 11.3 Backend

-   Node.js ;
-   TypeScript ;
-   Express ;
-   REST `/api/v1` ;
-   validation ;
-   erreurs standardisées ;
-   RBAC ;
-   CORS ;
-   Helmet ;
-   rate limiting ;
-   logs structurés ;
-   services métier testables.

### 11.4 Relationnel

Supabase/PostgreSQL = source de vérité métier.

Tables/entités initiales à confirmer par migration : - profiles ; -
worker_profiles ; - company_profiles ; - skills ; - worker_skills ; -
experiences ; - availabilities ; - missions ; - mission_skills ; -
proposals/applications ; - matches ; - matching_runs ; - notifications
; - integration_events ; - documents si nécessaires.

### 11.5 Non relationnel

MongoDB pour un usage complémentaire réel : - traces détaillées de
matching ; - événements techniques ; - journalisation d'intégrations
désensibilisée.

Ne pas dupliquer toute la base PostgreSQL.

------------------------------------------------------------------------

## 12. API initiale

Préfixe : `/api/v1`.

Routes à confirmer dans `docs/API_CONTRACT.md` :

### Système

-   `GET /health`

### Utilisateur

-   `GET /me`
-   `PATCH /me`

### Intérimaire

-   `GET /workers/me`
-   `PATCH /workers/me`
-   CRUD disponibilités

### Entreprise

-   `GET /companies/me`
-   `PATCH /companies/me`

### Missions

-   `POST /missions`
-   `GET /missions`
-   `GET /missions/:id`
-   `PATCH /missions/:id`
-   annulation/suppression métier
-   `GET /missions/:id/matches`
-   `POST /missions/:id/run-matching`

### Propositions

-   `GET /proposals/me`
-   `POST /proposals/:id/accept`
-   `POST /proposals/:id/refuse`

### Notifications

-   `GET /notifications`
-   marquage comme lu

### Intégrations

-   endpoints n8n internes à figer avant intégration.

------------------------------------------------------------------------

## 13. n8n --- préparation du terrain

Les workflows seront construits plus tard par un autre développeur.

Le frontend ne doit jamais appeler directement n8n.

Le backend prépare des événements versionnés :

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

Enveloppe :

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

Prévoir : - signature/secret ; - idempotence ; - retry ; - gestion
d'erreurs ; - journalisation ; - payload minimal ; - aucune clé secrète
côté navigateur.

### Workflows prioritaires

**Workflow A --- nouveaux matchs**
`mission publiée/créée → matching → candidats compatibles → événement → n8n → notification`

**Workflow B --- acceptation**
`intérimaire accepte → événement → n8n → information entreprise / confirmation`

Autres workflows après P0 : - mission non pourvue ; -
document/confirmation ; - clôture.

Le code doit maintenir `docs/N8N_HANDOFF.md`.

------------------------------------------------------------------------

## 14. Brevo

Brevo gère les emails transactionnels.

Clé exclusivement serveur/n8n.

Prévoir une abstraction `EmailService`.

Emails possibles : - mission compatible ; - proposition ; - acceptation
reçue ; - attribution confirmée ; - mission non pourvue.

Pour chaque email, documenter si le responsable est : - backend ; ou -
n8n.

Jamais les deux simultanément.

------------------------------------------------------------------------

## 15. Données publiques

Le sujet exige une source publique réellement consommée,
nettoyée/reformatée et exploitée.

Sources candidates : - France Travail ; - INSEE/Sirene ; - DARES ; -
data.gouv.fr.

Pipeline :
`récupération → validation → nettoyage → normalisation → dédoublonnage → transformation → utilisation fonctionnelle`

Un script/CLI reproductible doit être livré.

Une réponse API brute affichée telle quelle ne satisfait pas cette
exigence.

------------------------------------------------------------------------

## 16. Tests

Minimum : - tests unitaires du matching ; - tests des services critiques
; - tests fonctionnels/intégration auth ; - création de mission ; -
matching ; - acceptation/refus ; - permissions.

Produire un rapport de coverage.

Une fonctionnalité n'est pas terminée si build/typecheck échoue.

------------------------------------------------------------------------

## 17. Sécurité

-   secrets uniquement dans environnement ;
-   validation serveur ;
-   RBAC ;
-   RLS Supabase si accès navigateur aux tables ;
-   CORS restrictif ;
-   Helmet ;
-   rate limiting ;
-   HTTPS production ;
-   stockage privé pour documents sensibles ;
-   logs sans secrets ;
-   webhooks signés ;
-   dépendances maintenues ;
-   pas de service-role côté frontend.

------------------------------------------------------------------------

## 18. RGPD / accessibilité / RGESN / SEO

### RGPD

-   minimisation ;
-   finalités documentées ;
-   conservation documentée ;
-   accès/rectification/suppression adaptés au POC ;
-   confidentialité.

### Accessibilité

-   HTML sémantique ;
-   clavier ;
-   focus visible ;
-   labels ;
-   erreurs de formulaire ;
-   contrastes ;
-   textes alternatifs.

### RGESN

Au moins deux pratiques réelles, par exemple : - images optimisées +
lazy loading ; - limitation des requêtes/payloads + pagination/cache
pertinent.

### SEO

Pages publiques : - title ; - meta description ; - H1 ; - structure Hn
; - URLs lisibles ; - sitemap/robots si pertinent.

Les dashboards privés ne doivent pas être indexés.

------------------------------------------------------------------------

## 19. Variables d'environnement

### Frontend

``` env
VITE_API_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

### Backend

``` env
NODE_ENV=
PORT=
FRONTEND_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
MONGODB_URI=
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=
N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
WEBHOOK_SIGNING_SECRET=
```

Les `.env` réels sont ignorés par Git. Les `.env.example` ne contiennent
aucune valeur secrète.

------------------------------------------------------------------------

## 20. Déploiement

### Frontend

-   Vercel ;
-   branche `frontend` ;
-   framework Vite ;
-   build `npm run build` ;
-   sortie `dist`.

### Backend

-   Render ;
-   branche `backend` ;
-   URL prévue : `https://interimatch.onrender.com`.

Une fois Vercel configuré : - définir `FRONTEND_URL` côté Render ; -
définir `VITE_API_URL` côté Vercel ; - configurer CORS ; - configurer
les redirect URLs Supabase/Google ; - smoke test production.

------------------------------------------------------------------------

## 21. Roadmap

  Lot   Contenu                                                Priorité
  ----- ------------------------------------------------------ ----------
  0     Audit, architecture, branches, documentation, socles   P0
  1     Auth, rôles, onboarding                                P0
  2     Profils entreprise/intérimaire                         P0
  3     Missions                                               P0
  4     Matching/scoring                                       P0
  5     Acceptation/refus/attribution                          P0
  6     Contrats n8n + Brevo                                   P0
  7     Données publiques                                      P0
  8     Tests/sécurité/RGPD/RGAA/RGESN/SEO                     P0
  9     Render + Vercel                                        P0
  10    Admin et bonus                                         P1/P2

Objectif critique : obtenir rapidement un flux vertical fonctionnel
`Mission → Matching → Acceptation`.

------------------------------------------------------------------------

## 22. Livrables

À prévoir selon le sujet : - cahier des charges ; - roadmap ; -
chiffrage estimé ; - frontend ; - backend ; - README ; - workflows n8n
exports/captures ; - script/notebook/CLI données publiques ; - étude de
marché ; - coverage ; - chiffrage réel post-POC ; - support de pitch.

Le temps réel doit être suivi pour comparer estimé/réel.

------------------------------------------------------------------------

## 23. Documentation vivante

Le développement doit créer/maintenir : - `README.md` -
`docs/ARCHITECTURE.md` - `docs/API_CONTRACT.md` -
`docs/N8N_HANDOFF.md` - `docs/DECISIONS.md` - `docs/DEPLOYMENT.md` -
`docs/TESTING.md` - `docs/DATA_PUBLIC.md`

Ces documents doivent refléter le code réel et ne pas inventer des
fonctionnalités.

------------------------------------------------------------------------

## 24. Règles Git

Les assistants de développement ne doivent jamais : - commit ; - push
; - merge ; - ouvrir une PR ; - ajouter `Co-Authored-By` ; - ajouter une
mention d'IA.

Flavien réalise ces opérations.

Après chaque lot, l'assistant doit fournir : - branche concernée ; -
fichiers modifiés ; - tests ; - migrations ; - variables ; - commandes
Git exactes à exécuter manuellement.

------------------------------------------------------------------------

## 25. Definition of Done POC

Le POC principal est réussi lorsqu'on peut démontrer :

1.  une entreprise se connecte ;
2.  elle complète son profil ;
3.  elle crée et publie une mission ;
4.  un intérimaire possède un profil complet et des disponibilités ;
5.  le backend détermine son éligibilité ;
6.  le moteur calcule un score explicable ;
7.  l'entreprise peut consulter les résultats, y compris hors zone ;
8.  le système prépare/émet un événement stable pour n8n ;
9.  l'intérimaire voit/reçoit la proposition ;
10. il accepte ou refuse ;
11. l'entreprise voit la réponse ;
12. l'attribution met à jour la mission sans double attribution ;
13. les parcours critiques sont testés ;
14. aucun secret n'est versionné ;
15. le projet peut être déployé sur Vercel + Render.
