# Décisions du Lot 0

Statut : socles implémentés au Lot 0 ; décisions métier pour les lots suivants.

## D01 — Auth classique obligatoire

Le PDF page 6 exige que l’équipe implémente l’authentification classique. Le choix « Supabase Auth seul » ne satisfait pas cette formulation. Prévoir email/mot de passe dans Express, hash via bibliothèque Argon2id, sessions opaques révocables stockées sous forme de hash dans PostgreSQL, protections contre brute force et énumération. Ne pas écrire de cryptographie maison. Google OAuth reste confié à Supabase.

Le backend valide la session Supabase à l’échange OAuth puis établit sa propre session applicative. Identités liées à un utilisateur métier interne ; pas de fusion de comptes sur la seule égalité d’un email. Rôle persisté côté serveur, jamais accepté depuis des métadonnées modifiables par l’utilisateur. En POC, bearer applicatif gardé en mémoire, sans localStorage ; reconnexion classique au rechargement acceptable au départ. Expiration, logout/révocation et tests sont obligatoires au Lot 1. Le choix évite les cookies tiers entre Vercel et Render.

## D02 — Source de vérité et ATS

La présentation évoque un ATS Python/JavaScript séparé et MongoDB au backend. Retenir le cahier : API Node/TS et moteur de matching TypeScript pur dans le backend, PostgreSQL pour le métier. MongoDB conserve les traces détaillées désensibilisées des calculs. Pas de service ATS séparé pour ce POC. L’équipe ATS peut contribuer au module et à ses tests.

## D03 — Acceptation ≠ attribution

Le §10 du cahier peut faire croire que l’acceptation pourvoit la mission. Retenir le flux utilisateur explicite : acceptation = intérêt confirmé ; attribution = décision entreprise distincte. La transaction d’attribution revérifie mission ouverte, acceptation, capacité et conflits. Verrouiller la mission et le candidat pour sérialiser les attributions concurrentes ; une réservation active par proposition, capacité jamais dépassée. `filled` seulement lorsque toutes les places sont attribuées. `mission.unfilled` est un événement, pas un nouveau statut.

## D04 — Matching explicable

Poids centralisés : compétences 45, localisation 25, expérience 20, complément 10 ; configuration versionnée avec chaque calcul. Avant score : mission ouverte, candidat actif, disponibilité couvrant tout le créneau, aucun conflit d’attribution. Intervalles [début, fin), dates stockées en UTC avec fuseau d’affichage ; gérer les missions passant minuit.

Formules initiales à implémenter/tester au Lot 4 :

- Compétences : 45 × proportion des compétences métier requises présentes. Un prérequis légal/certification bloquant doit être distinct des compétences scorées et testé avant scoring.
- Localisation : 25 × max(0, 1 − distance/rayon), distance géographique en km. Rayon nul : 25 uniquement à distance nulle. Hors rayon : `outside_zone=true`, score localisation 0, profil toujours consultable.
- Expérience : 20 × min(années pertinentes / années demandées, 1) ; si aucune expérience requise : 20.
- Complément : 10 × proportion des compétences souhaitées présentes ; en l’absence de souhait : 10. Remplace la clé `availability` ambiguë de l’exemple du cahier par `complementary`. La disponibilité reste un filtre d’éligibilité, pas une préférence inventée.
- Si aucune compétence métier requise : sous-score 45 ; données de profil manquantes : pas de bonus implicite. Géolocalisation inconnue : distance et `outside_zone` inconnus, motif explicite, pas de notification automatique avant complétion.

Les résultats inéligibles gardent leurs raisons et ne sont pas proposés automatiquement. Tri déterministe par score puis identifiant ; paliers calculés sur le score non arrondi. Affichage arrondi uniquement. Seuils configurables : 70, 60, 50 ; sélectionner le premier palier non vide parmi les candidats éligibles dans la zone, sans proposition déjà traitée. Hors zone : affichage et sélection volontaires par l’entreprise. Sous 50 : aucune notification automatique. Aucun déclassement automatique après délai dans le P0 sans règle métier supplémentaire.

## D05 — Automatisations et emails

Le PDF page 4 impose deux automatisations ; Slack/Discord y sont conseillés, pas obligatoires. Brevo est conservé. Workflow A : notifier une proposition issue d’un match. Workflow B : informer l’entreprise d’une acceptation. Le backend enregistre toujours l’état métier et la notification en application avant d’émettre ; n8n ne décide ni de l’éligibilité ni de l’attribution. n8n possède tous les emails métier ; le backend possède les emails d’auth classique via une abstraction EmailService. Aucun envoi double en secours implicite.

## D06 — Ordre de travail et Git

Consigne actualisée : opérations Git locales autorisées, commits/push/PR/publication interdits. Dépôt initialisé avec origin officiel, remote vide. Deux worktrees frères sans premier commit permettent le développement sans mélanger les applications sur main. Avant tout premier commit applicatif, rattacher leurs HEAD au premier commit main selon DEPLOYMENT.md ; aucun historique parallèle créé.

## D07 — Référence UI et conformité

La maquette est la référence Intérimaire ; l’Entreprise aura ses propres contenus et actions. Messagerie, urgence et documents sont différés. Conserver les couleurs de la référence plutôt qu’une palette aléatoire. Le sitemap public demandé par le PDF est à livrer, même si le cahier le rend optionnel. Tests, sécurité et accessibilité commencent dès les fondations, le Lot 8 consolide leurs preuves.
