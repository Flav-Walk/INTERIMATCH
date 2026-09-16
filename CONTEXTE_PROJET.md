# INTERIMATCH --- CONTEXTE PROJET

Ce fichier fournit aux développeurs/assistants une lecture rapide du
projet. Le détail fonctionnel est dans `CAHIER_DES_CHARGES.md`.

## Projet

Interimatch est un POC EPITECH de mise en relation entre entreprises de
l'hôtellerie-restauration et intérimaires.

Priorités : 1. espace Intérimaire ; 2. espace Entreprise ; 3. Admin plus
tard.

Flux critique :
`Mission → Matching → Notification/Proposition → Acceptation/Refus → Attribution`.

## Références à la racine

-   sujet officiel EPITECH ;
-   note de cadrage / PowerPoint ;
-   `image.png` : maquette UI de référence fournie par l'équipe ;
-   `CAHIER_DES_CHARGES.md` : source de vérité détaillée.

## Feedback reçu

Go avec corrections : - matching/scoring à revoir ; - périmètre
fonctionnel à détailler ; - automatisation n8n candidats à revoir ; -
roadmap à corriger.

## Stack décidée

Frontend : - React + TypeScript + Vite - branche `frontend` - Vercel à
la fin

Backend : - Node.js + TypeScript + Express - branche `backend` - Render
à la fin - URL prévue : `https://interimatch.onrender.com`

Stable/intégration : - branche `main`

Services : - Supabase/PostgreSQL - Supabase Auth + Google OAuth -
MongoDB comme base non relationnelle complémentaire - Brevo pour
emails - n8n pour automatisations

## Règle Git

Les opérations Git locales sont autorisées : initialisation, remote, fetch,
branches et worktrees. Flavien réalise seul les commits et push. Aucune PR
ni publication par les assistants ; aucune attribution dans les métadonnées Git.

## n8n

Ne pas construire immédiatement les workflows. Préparer les contrats
backend et maintenir `docs/N8N_HANDOFF.md` afin qu'un autre développeur
puisse ensuite intégrer n8n rapidement.

## Secrets

Les secrets sont fournis pendant le développement si nécessaire mais
doivent uniquement aller dans les environnements
locaux/Render/Vercel/n8n. Aucun secret dans Git.
