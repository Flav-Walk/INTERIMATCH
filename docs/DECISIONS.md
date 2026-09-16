# Décisions

Statut : Lots 0 et 1 implémentés. D01 à D07 datent du Lot 0 ; D08 à D10 ont été prises au Lot 1 et sont marquées comme telles.

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

## D08 — Connexion PostgreSQL par le Session Pooler (Lot 1)

L'hôte direct `db.<ref>.supabase.co` ne publie qu'un enregistrement AAAA. Vérifié depuis deux environnements de développement : la résolution IPv4 renvoie ENODATA et `pg` échoue en ENOTFOUND, faute de route IPv6 utilisable. Ce n'est pas une erreur de configuration mais une propriété de l'infrastructure Supabase.

Retenir le **Session Pooler** (port 5432, utilisateur `postgres.<ref>`), joignable en IPv4. Le Transaction Pooler (6543) est écarté : le code utilise `pg_advisory_xact_lock`, `SELECT … FOR UPDATE` et des transactions multi-requêtes, que le mode transaction ne garantit pas.

Le pooler présente un certificat signé par l'autorité Supabase, absent des magasins système : `rejectUnauthorized: true` échoue en `SELF_SIGNED_CERT_IN_CHAIN`. Plutôt que de désactiver la vérification globalement, la configuration devient explicite :

- `DB_SSL` — activer TLS, vrai par défaut ;
- `DB_SSL_CA_PATH` — chemin du certificat d'autorité Supabase ; s'il est fourni, la vérification est **active** ;
- `DB_SSL_INSECURE` — repli local uniquement, refusé au démarrage si `NODE_ENV=production`.

Le développement local tourne avec `DB_SSL_INSECURE=true`. Avant tout déploiement Render, télécharger le certificat depuis Supabase (Settings → Database → SSL Configuration), le fournir par `DB_SSL_CA_PATH` et laisser `DB_SSL_INSECURE` vide. Le refus en production est testé.

## D09 — Portée du coverage (Lot 1)

Les points d'entrée qui s'exécutent à l'import — `server.ts`, `scripts/**` — sont hors du périmètre Vitest et vérifiés par exécution réelle. Côté frontend, Vitest mesure `src/services/**` et les vues React sont couvertes par Playwright. Les deux mesures sont rapportées séparément : un pourcentage unique mélangeant tests unitaires et parcours navigateur ne signifierait rien. Aucun test ne doit exister uniquement pour augmenter un pourcentage.

## D10 — Comptes de démonstration (Lot 1)

Deux comptes applicatifs distincts, `jimmy.worker@example.test` et `jimmy.company@example.test`, marqués `demo=true` en base et signalés dans l'interface par un bandeau « DEVELOPMENT / DEMO DATA ». Le domaine `.test` est réservé par la RFC 2606 : aucun email réel ne peut être atteint par erreur.

Le mot de passe n'est jamais dans Git : `scripts/seed.ts` lit `DEMO_PASSWORD` depuis l'environnement local, exige 12 caractères minimum, exige `ALLOW_DEMO_SEED=true`, et refuse de s'exécuter si `NODE_ENV=production`. Le script refuse également de modifier un compte dont `demo` est faux, et révoque toutes les sessions existantes du compte à chaque réinitialisation du mot de passe. Il est idempotent : deux exécutions successives laissent exactement les mêmes lignes.

## D11 — Le rôle est attribué par le serveur, jamais choisi (Lot 2)

La sélection libre du rôle à l'inscription est supprimée. Tout nouveau compte est
`worker`. L'accès à l'espace Entreprise est décidé par la table `company_accounts` :
un déclencheur `BEFORE INSERT` sur `profiles` attribue `company` si l'adresse y figure,
et `login`/`google` réappliquent la règle pour qu'une adresse ajoutée après coup prenne
effet à la connexion suivante.

Ce choix répond à deux exigences en même temps. D'abord la sécurité : un contrôle
`if (email === "…")` côté navigateur n'est pas une autorisation, et une valeur de rôle
envoyée par le client ne doit jamais être acceptée — les schémas Zod stricts rejettent
d'ailleurs tout champ non déclaré, y compris `role`. Ensuite l'extensibilité : ajouter
une entreprise est un `INSERT`, pas un déploiement.

`profiles.role` devient `NOT NULL`. L'endpoint `PUT /me/role` est supprimé ; aucune
route ne permet plus de choisir ou changer un rôle. `admin` reste hors de portée.

## D12 — Visite guidée versionnée plutôt que formulaire bloquant (Lot 2)

L'onboarding n'est plus un formulaire obligatoire placé avant l'espace : un compte
accède immédiatement à son espace, et découvre l'interface par une visite guidée
(surbrillance d'une zone réelle, bulle explicative, étapes, Passer/Précédent/Suivant).
Le profil se complète depuis l'espace, et son état est rappelé sur le tableau de bord.

La progression est en base, pas dans `localStorage` : `profiles.tour_version` conserve
la version la plus haute réellement terminée, ce qui la rend valable sur tout appareil
et lisible par le serveur. La constante `CURRENT_TOUR_VERSION` décide de ce qui est
diffusé : l'augmenter rejoue la visite pour tout le monde, y compris les comptes
existants, ce qui est le mécanisme prévu pour présenter une nouveauté. Écrire `0`
relance la visite pour un compte : c'est ce que fait « Revoir la visite ».

Les étapes ne pointent que des zones réellement rendues, et la visite ne démarre que
sur le tableau de bord, pour qu'aucune étape ne désigne un élément absent. Un test
vérifie que chaque cible correspond à un attribut `data-tour` existant.

## D13 — Vocabulaire métier servi par le backend (Lot 2)

Secteurs, statuts de mission et statuts de candidature sont déclarés une seule fois
dans `src/domain/reference.ts` et exposés par `GET /api/v1/reference`. Les écrans ne
redéclarent aucune de ces listes. Les statuts ATS sont volontairement déclarés avant
d'être implémentés — ils décrivent le suivi à venir — mais aucune transition n'existe,
et la documentation le dit explicitement partout où ils apparaissent.
