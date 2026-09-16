# Audit initial — 16 septembre 2026

## Inspection réelle

Six fichiers initiaux, tous examinés : PDF de 10 pages (lecture du texte intégral), présentation de 11 diapositives (texte extrait de chaque slide et notes, notes vides), deux documents de cadrage Markdown, gabarit n8n et image de 1321 × 876 pixels inspectée visuellement. Les chiffres de marché de la présentation ne sont pas vérifiés auprès de leurs sources externes.

Aucun code, `package.json`, lockfile, migration, test ou fichier AGENTS.md applicable trouvé. `git status` et `git branch --all` retournent « not a git repository ». Aucun remote ni historique inspectable. Ne pas confondre ce dossier avec un clone existant.

L’extraction du PDF a nécessité l’installation de l’outil Python `pypdf` dans l’environnement local ; ce n’est pas une dépendance applicative.

## Obligations du sujet officiel

Références : numéro de page du fichier PDF, couverture comprise.

| Pages | Obligation | Prise en charge prévue |
| --- | --- | --- |
| 2–3 | Secteur justifié, marché/concurrence/besoins, proposition de valeur, cadrage J+2, estimation par module | Cadrage fourni ; sources précises du marché et chiffrage à compléter |
| 3, 6 | Deux comptes et permissions ; auth sécurisée ; auth classique implémentée par l’équipe ; OAuth via fournisseur existant | Backend auth classique + Google/Supabase, Lot 1 |
| 3 | Chiffrement des données sensibles au repos/en transit | HTTPS et configuration des stockages à vérifier ; éviter documents d’identité et données bancaires dans le P0 |
| 3 | Missions, profils détaillés, matching compétences/zone/disponibilité, suivi des statuts | Lots 2–5 |
| 4 | Source publique consommée, nettoyée, reformatée et exploitée dans une fonction visible | Lot 7, script reproductible ; pas un simple affichage brut |
| 4 | Au moins deux automatisations no-code réelles | Lot 6, réalisation n8n par le développeur désigné |
| 5 | Bases RGAA 4.1 ; deux pratiques RGESN documentées | Appliquer dès les composants ; preuves Lot 8 |
| 5 | RGPD : base légale, conservation, mentions ; règles du travail applicables aux missions | Travail de conformité à mener, aucune conformité revendiquée |
| 5 | Réflexion achat responsable/réemploi si pertinent | Documenter une réflexion sectorielle, sans ajouter une fonctionnalité P0 |
| 5 | SEO public, titres/meta, URL lisibles, sitemap minimal | Prévoir page publique ; espaces privés non indexables |
| 6 | Frontend JS/TS, backend Node/TS, responsive ; bases relationnelle ET non relationnelle | React/Vite, Express ; PostgreSQL + traces réelles MongoDB |
| 6 | Tests unitaires et fonctionnels critiques ; coverage livré ; bibliothèque CLI | Tests continus, rapport livré ; CLI d’import Lot 7 |
| 7–8 | Code/README, exports ou captures n8n, traitement public, marché, estimé/réel, pitch et participation de tous | Suivi de livrables et du temps dès maintenant |

## Quatre réserves du GO

- Matching : poids explicites mais formule complémentaire et cas limites encore absents ; décisions initiales dans DECISIONS.md.
- Périmètre : cahier détaillé exploitable ; messagerie, urgence, documents de la maquette ne deviennent pas automatiquement P0.
- n8n candidats : garder les transactions métier dans le backend ; n8n orchestre les notifications après validation.
- Roadmap : tester dès chaque lot, préparer les contrats tôt et réserver du temps aux deux workflows, aux données publiques et à la soutenance.

## Limites et risques

Blocage immédiat : absence de dépôt/branches. Risques suivants : auth double fournisseur, concurrence sur attribution, délais d’intégration n8n, configuration Brevo, accès/licence des données publiques et planning sur 11 jours. Pas de credential nécessaire avant le socle local.


## Mise à jour après reprise

Les constats d’absence de dépôt/code ci-dessus décrivent uniquement l’état initial. Git est désormais initialisé avec origin officiel vide ; les deux socles existent dans les worktrees frères. Voir README et TESTING pour l’état actuel.
