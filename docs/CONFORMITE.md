# Document de conformité · InteriMatch

Ce document consigne l'état factuel de conformité de la plateforme InteriMatch au terme du Lot 8 (sous-lots 8A, 8B, 8C et 8D), couvrant le RGPD, l'accessibilité numérique (RGAA 4.1 / WCAG 2.1), l'écoconception numérique (RGESN), le référencement (SEO) et la recette de consolidation.

---

## A. Protection des données personnelles (RGPD)

### 1. Ce qui est déjà documenté et mis en œuvre
* **Minimisation des données (Art. 5.1.c RGPD) :**
  * La plateforme ne collecte que les informations strictement nécessaires à la mise en relation dans le secteur de l'hôtellerie-restauration (identité, coordonnées, métiers, compétences, disponibilités, zone de mobilité).
  * Les données de contact complètes (téléphone, nom de famille entier) d'un intérimaire ne sont transmises à un établissement qu'après le dépôt effectif d'une candidature par l'intérimaire ou dans le cadre de l'examen de celle-ci.
* **Finalités déterminées et licites (Art. 5.1.b RGPD) :**
  * Gestion des comptes utilisateurs et authentification sécurisée.
  * Rapprochement algorithmique entre propositions de mission et profils disponibles.
  * Gestion et suivi des candidatures entre intérimaires et établissements.
* **Durée de conservation documentée :**
  * La politique de confidentialité documente les durées de conservation applicables aux données de compte, aux profils et aux candidatures dans le cadre du prototype.
* **Sécurité technique du traitement (Art. 32 RGPD) :**
  * Mots de passe chiffrés côté backend/Supabase Auth (hachage fort).
  * Architecture de session sécurisée : jeton d'accès volatile conservé en mémoire applicative (non stocké dans `localStorage`), cookie de rafraîchissement protégé par l'attribut `HttpOnly` (`im_refresh`), échanges HTTPS chiffrés.
  * Contrôle d'accès strict selon le rôle (`worker`, `company`, `admin`) validé systématiquement côté serveur sur chaque requête API.
* **Absence de traceurs publicitaires ou de profilage tiers :**
  * Aucun cookie publicitaire, outil d'analyse tiers ni script externe de profilage n'est déposé. Seul le cookie technique de rafraîchissement de session est utilisé.
* **Information des personnes :**
  * Présence d'une page accessible publiquement `/politique-confidentialite`.
  * Rappel des mentions d'information lors de la création de compte sur `/register`.

### 2. Informations restant à valider juridiquement (marquées `[Information à compléter]`)
* Raison sociale, forme juridique, SIRET et adresse du siège de l'éditeur final.
* Identité du responsable du traitement et du délégué à la protection des données (DPO) ou contact RGPD officiel.
* Procédure administrative formalisée pour l'exercice des droits (accès, rectification, effacement, portabilité) en dehors de l'interface du prototype.

---

## B. Accessibilité numérique (RGAA 4.1 / WCAG 2.1)

### 1. Statut réel de conformité
* **Déclaration : « Accessibilité : non conforme »**
* **Justification :** Aucun audit formel complet de conformité selon les 106 critères du RGAA 4.1 n'ayant été réalisé par un organisme ou auditeur habilité, la plateforme s'abstient de revendiquer un pourcentage de conformité ou une conformité partielle chiffrée, conformément aux recommandations de la DINUM.

### 2. Améliorations techniques et corrections réalisées (Sous-lot 8C)
* **Structure sémantique et repères (Landmarks) :**
  * Utilisation rigoureuse des balises structurelles HTML5 : `<header>`, `<nav>`, `<main>`, `<footer>`, `<aside>`, `<section>`, `<article>`.
  * Présence systématique d'attributs `aria-label` distincts sur les zones de navigation (`Navigation principale`, `Compte`, `Informations légales`, `Pagination des offres`).
  * Rétablissement d'une hiérarchie de titres ordonnée sans saut de niveau (H1 → H2 → H3) sur les pages catalogue de missions (`Missions.tsx` et `CompanyMissions.tsx`).
* **Navigation clavier et repères d'évitement :**
  * Lien d'évitement (« Aller au contenu ») en début de document ciblant `#content`, avec prise en charge de `:focus` et `:focus-visible`.
  * Cible principale `<main id="content" tabIndex={-1}>` pour recevoir le focus programmatique lors de l'activation du skip-link.
* **Indicateurs de focus visibles :**
  * Définition d'un contour de focus contrasté global (`outline: 3px solid var(--forest); outline-offset: 5px;`) sur les liens et boutons.
  * Renforcement du contour de focus sur le champ de recherche de l'en-tête (`.shell-search:focus-within`).
* **Formulaires et champs de saisie :**
  * Association systématique des libellés et champs via `htmlFor` et `id` (notamment sur `Login.tsx` et `ProfileForm.tsx`).
  * Composant partagé `Field` liant explicitement `aria-invalid` et `aria-describedby` aux aides et messages d'erreur.
  * Composant `ErrorSummary` avec prise de focus automatique et liens d'ancrage vers chaque champ invalide.
* **Composants interactifs et modales :**
  * Composant `ConfirmDialog` fondé sur la balise native `<dialog>` avec `showModal()`, gestion native du focus et fermeture par la touche Échap.
  * Composant `GuidedTour` : mise en place d'un piège de tabulation (`Tab` / `Shift+Tab`) pour confiner le focus dans la boîte de dialogue modale (`role="dialog" aria-modal="true"`), et restauration du focus sur l'élément déclencheur lors de la fermeture.
* **Changements de contexte et liens externes :**
  * Signalement explicite de l'ouverture dans une nouvelle fenêtre (`target="_blank"`) via `<span className="sr-only"> (nouvelle fenêtre)</span>` sur l'ensemble des liens externes (Défenseur des droits, CNIL, offres France Travail).
* **Préférences utilisateur :**
  * Prise en compte globale de `prefers-reduced-motion: reduce` dans les feuilles de style pour désactiver les animations (shimmer, sweep) et transitions CSS pour les utilisateurs sensibles au mouvement.
* **Éléments graphiques :**
  * Masquage de toutes les icônes purement décoratives au moyen de `aria-hidden="true"`.
  * Les informations colorées (ex. `MatchBadge`, `ApplicationStatus`) portent systématiquement un équivalent textuel lisible par synthèse vocale.

### 3. Contrôles automatisés réalisés
* Validation syntaxique TypeScript (`npm run typecheck` PASS).
* Analyse statique ESLint (`npm run lint` PASS).
* Tests unitaires et d'intégration Vitest (`npm test` PASS), incluant la vérification des attributs ARIA, des labels, des liens externes et de la structure des pages.
* Compilation de production Vite (`npm run build` PASS).

### 4. Contrôles manuels restant à effectuer
* Tests avec lecteurs d'écran (NVDA sous Firefox, JAWS sous Chrome, VoiceOver sous Safari / iOS).
* Vérification de la navigabilité clavier intégrale sans pointeur sur l'ensemble des flux métier (création de mission, sélection de compétences, dépôt de candidature).
* Test d'agrandissement de texte et zoom graphique à 200 % et 400 % sans superposition ni perte d'information.
* Relevé colorimétrique exhaustif des contrastes texte/fond et composants UI dans tous les états (:hover, :focus, :active, :disabled).

---

## C. Écoconception de services numériques (RGESN)

Deux pratiques réelles et prouvables ont été retenues et documentées dans le code source du projet :

### Pratique 1 : Chargement différé des routes et morcellement du bundle (Code Splitting / Lazy Loading)
* **Principe (RGESN Critère 7.1 / 7.2) :**
  Ne charger et n'exécuter que les ressources logicielles nécessaires à la fonctionnalité demandée par l'utilisateur, afin d'éviter le téléchargement de code superflu.
* **Preuve exacte dans le code :**
  * Fichier `apps/frontend/src/main.tsx` (lignes 30 à 108 et 115) :
    Remplacement de l'ancien bundle monolithique (~666 ko) par des imports dynamiques via `React.lazy()` et `Suspense` pour tous les espaces métier :
    ```typescript
    const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
    const WorkerProfile = lazy(() => import("./pages/WorkerProfile").then((m) => ({ default: m.WorkerProfile })));
    const CompanyDashboard = lazy(() => import("./pages/CompanyDashboard").then((m) => ({ default: m.CompanyDashboard })));
    const CompanyMissionForm = lazy(() => import("./pages/CompanyMissionForm").then((m) => ({ default: m.CompanyMissionForm })));
    const AdminPage = lazy(() => import("./pages/Admin").then((m) => ({ default: m.AdminPage })));
    ```
  * Résultat du build Vite (`npm run build`) :
    Génération de modules séparés par itinéraire (`WorkerProfile-*.js`, `CompanyMissionDetail-*.js`, `Admin-*.js`, etc.), permettant à un visiteur anonyme ou à un intérimaire de ne télécharger aucun octet des composants d'administration ou d'entreprise.
* **Bénéfice concret :**
  * Réduction substantielle du poids initial transféré sur le réseau lors du premier affichage.
  * Diminution du temps d'analyse et d'exécution JavaScript sur le processeur du terminal mobile.
* **Limite éventuelle :**
  * Transition asynchrone nécessitant un état d'attente bref lors du premier passage d'un espace à un autre (géré par un composant discret `<Loading />`).

### Pratique 2 : Limitation des requêtes, pagination bornée et absence de polling inutile
* **Principe (RGESN Critère 4.1 / 4.2 / 5.2) :**
  Restreindre le volume et la fréquence des transferts de données entre client et serveur en interdisant les requêtes en boucle et en limitant strictement la taille des listes retournées.
* **Preuve exacte dans le code :**
  * Fichier `apps/frontend/src/pages/WorkerPublicOffers.tsx` (lignes 50-52) & `apps/frontend/src/services/publicOffers.ts` :
    L'appel à l'API publique France Travail est borné à 12 résultats par page (`limit: 12`), interdisant le rapatriement massif en mémoire de l'ensemble du jeu de données.
  * Fichier `apps/frontend/src/pages/CompanyMissionForm.tsx` (lignes 130-138) :
    La modification d'une mission s'appuie sur `missionDiff()` pour n'envoyer en `PATCH` que les attributs effectivement modifiés par l'utilisateur, limitant la taille de la charge utile et évitant des géocodages superflus côté serveur.
  * Absence totale d'appels récurrents (`setInterval` / polling) : les rafraîchissements de données sont strictement événementiels (sur navigation ou après mutation utilisateur via `invalidate()`).
* **Bénéfice concret :**
  * Réduction de la bande passante consommée sur les réseaux mobiles.
  * Allègement de l'empreinte énergétique des serveurs d'API et de bases de données.
  * Préservation de la batterie du terminal client.
* **Limite éventuelle :**
  * L'utilisateur ne dispose pas d'un rafraîchissement automatique « temps réel » passif en cas de modification concurrente par un tiers.

---

## D. Référencement naturel et indexation (SEO)

### 1. Domaine canonique
* **Domaine de référence :** `https://interimatch-five.vercel.app`

### 2. Pages publiques indexables
Les pages publiques destinées aux moteurs de recherche comportent les balises méta adaptées (`robots: "index,follow"`), un titre unique et descriptif, une méta-description ciblée et une structure sémantique H1/H2 :
* `/` (Accueil)
* `/mentions-legales`
* `/politique-confidentialite`
* `/accessibilite`

### 3. Espaces privés non indexables
Tous les espaces protégés et parcours d'authentification sont strictement exclus de l'indexation au moyen de la directive méta `robots: "noindex,nofollow"` gérée dynamiquement par le hook `usePageSeo` :
* `/login`, `/register`, `/connexion`
* `/auth/callback`
* `/worker/*` (Tableau de bord, profil, missions, candidatures, offres France Travail)
* `/company/*` (Accueil entreprise, profil, missions, création/édition, candidatures)
* `/admin/*`
* `/*` (Page 404 / NotFound)

### 4. Fichiers de découverte (sitemap et robots.txt)
* Le fichier `public/robots.txt` autorise le moissonnage des pages publiques, interdit l'accès aux répertoires privés (`/worker/`, `/company/`, `/admin/`, `/auth/`), et référence le plan de site :
  `Sitemap: https://interimatch-five.vercel.app/sitemap.xml`
* Le fichier `public/sitemap.xml` liste exhaustivement les 4 URLs publiques canoniques avec leur fréquence de modification et priorité.

---

## E. Synthèse et Recette du Lot 8 (Sous-lot 8D)

### 1. Synthèse des sous-lots constitutifs
* **Sous-lot 8A (Pages légales & RGPD) :**
  * Création des routes et pages publiques `/mentions-legales`, `/politique-confidentialite` et `/accessibilite`.
  * Intégration systématique des liens légaux au pied de page (`AppLayout.tsx`).
  * Rappel d'information légale lors de l'inscription (`/register`).
  * Formalisation des finalités, durées de conservation et mesures de sécurité technique (absence de traceurs publicitaires, stockage du token en mémoire, cookie HttpOnly `im_refresh`).
* **Sous-lot 8B (Référencement naturel & SEO) :**
  * Définition du domaine canonique de référence : `https://interimatch-five.vercel.app`.
  * Méta-balises dynamiques gérées par le hook `usePageSeo` avec titres uniques et méta-descriptions pertinentes.
  * Indexation stricte (`index,follow`) des 4 pages publiques et désindexation systématique (`noindex,nofollow`) des espaces d'authentification, espaces privés et de la page d'erreur 404 (`NotFound`).
  * Création des fichiers `public/robots.txt` et `public/sitemap.xml` et réécriture préservée dans `vercel.json`.
* **Sous-lot 8C (Accessibilité RGAA 4.1 & Écoconception RGESN) :**
  * Accessibilité : statut légalement affiché « non conforme », landmarks sémantiques, lien d'évitement (`.skip-link` vers `#content`), associations `label`/`input` explicites, avertissement `(nouvelle fenêtre)` sur les liens externes, trap de tabulation sur la boîte de dialogue modale `GuidedTour`, support de `prefers-reduced-motion`.
  * Écoconception (RGESN) : découpage du bundle par route via `React.lazy()` / `Suspense` (chargement à la demande), pagination bornée à 12 offres sur France Travail, absence totale de polling.
* **Sous-lot 8D (Documentation & Recette de consolidation) :**
  * Remise à niveau intégrale de la documentation obsolète (`README.md`, `apps/frontend/README.md`, `docs/DATA_PUBLIC.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`).
  * Documentation factuelle de l'intégration France Travail (table séparée `public_job_offers`, import par lot/fixture, aucune candidature InteriMatch, connecteur live non branché).
  * Ajout de la suite de tests E2E `apps/frontend/e2e/compliance.spec.ts` validant en conditions réelles les pages légales, le footer, la page 404 noindex et les fichiers statiques SEO.

### 2. Limites connues de la plateforme
* **Accessibilité :** Déclaration de non-conformité maintenue tant qu'un audit formel complet des 106 critères du RGAA 4.1 n'a pas été conduit par un auditeur habilité.
* **France Travail :** Les offres proviennent d'un import de données représentatives (fixture) dans la table `public_job_offers` et non d'une requête en temps réel vers l'API France Travail (provider live non activé).
* **Données légales éditeur :** Raison sociale, SIRET, contact DPO et adresse du siège social sont indiqués sous la mention `[Information à compléter]`.
* **Droits RGPD :** Aucun système d'export ou d'effacement autonome en libre-service n'est encore implémenté dans le prototype (exercice des droits sur demande manuelle).

### 3. Contrôles manuels restants à effectuer
* Restitution vocale intégrale avec lecteurs d'écran (NVDA sous Firefox, JAWS sous Chrome, VoiceOver sous Safari / iOS).
* Parcours clavier intégral (sans souris) sur les formulaires complexes à étapes (sélection des disponibilités, création de mission).
* Vérification du zoom typographique à 200 % et graphique à 400 % sur terminaux mobiles et tablettes.
* Audit colorimétrique exhaustif de tous les états (:hover, :focus, :active, :disabled) dans les thèmes clair/sombre.
