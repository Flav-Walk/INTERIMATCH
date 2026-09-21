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

**Éligibilité ≠ score.** Le moteur commence par les règles bloquantes : recherche de missions active, toutes les compétences obligatoires détenues, disponibilité couvrant entièrement le créneau, mission dans le rayon déclaré et aucun engagement accepté en conflit. Un seul de ces motifs rend le résultat incompatible, quel que soit son score. Les intervalles sont comparés comme des instants UTC et traités en plages semi-ouvertes `[début, fin)`.

Le score ne sert qu’à classer et expliquer les profils restés éligibles. Les dimensions réellement implémentées sont : compétences souhaitées 45, proximité 25, métier 20 et expérience 10. Une dimension sans donnée applicable est retirée du dénominateur plutôt que gratifiée implicitement. Le métier est gradué — principal 100 %, secondaire 60 %, absent 0 % — et n’est pas une règle éliminatoire. Les compétences obligatoires sont, elles, exclusivement une règle d’éligibilité.

La géolocalisation inconnue ne permet pas d’affirmer un hors-zone et retire la dimension. Côté worker, un hors-zone bloque la proposition ; côté entreprise, le profil reste consultable afin de permettre un élargissement volontaire. Cette asymétrie est explicite dans le DTO (`outside_zone` et `blockers`).

Les résultats inéligibles gardent leurs raisons et ne sont pas proposés automatiquement. Tri déterministe sur le score brut puis l’identifiant ; palier calculé sur le score brut, score public arrondi uniquement à l’affichage. Seuils : 70, 60, 50. Aucun déclassement automatique après délai dans le POC sans règle métier supplémentaire.

## D05 — Automatisations et emails

Le PDF page 4 impose deux automatisations ; Slack/Discord y sont conseillés, pas obligatoires. Brevo est conservé. Workflow A : notifier une proposition issue d’un match. Workflow B : informer l’entreprise d’une acceptation. Le backend enregistre toujours l’état métier et la notification en application avant d’émettre ; n8n ne décide ni de l’éligibilité ni de l’attribution. n8n possède tous les emails métier ; le backend possède les emails d’auth classique via une abstraction EmailService. Aucun envoi double en secours implicite.

Exception ultérieure : le workflow contractuel est entièrement possédé par le
backend, sans n8n. Ses notifications passent directement par Brevo API v3 et
une outbox PostgreSQL idempotente. Cette exception ne déplace ni le matching ni
les autres webhooks hors de leur architecture existante.

## D08 — Validation contractuelle interne

Le prototype fige un snapshot, journalise utilisateur authentifié, rôle,
version, états et horodatage, puis archive un PDF final. Sans prestataire de
confiance qualifié, preuve cryptographique personnelle et clauses légales
complètes, l'interface et le PDF parlent de **validation interne de
démonstration**, jamais de signature qualifiée ou de contrat de travail complet.

Pour devenir juridiquement exploitable, il manque notamment l'identification
légale complète de l'employeur et du salarié, convention collective et
classification, qualification/type/durée du contrat, temps de travail et
pauses, salaire détaillé et accessoires, période d'essai, congés/indemnités,
motif et mentions propres au travail temporaire, ainsi que le choix et la preuve
d'un procédé de signature adapté. Ces champs doivent être collectés et validés
par le métier/juridique ; aucune valeur par défaut ne doit être inventée.

## D06 — Ordre de travail et Git

Consigne actualisée : opérations Git locales autorisées, commits/push/PR/publication interdits. Dépôt initialisé avec origin officiel, remote vide. Deux worktrees frères sans premier commit permettent le développement sans mélanger les applications sur main. Avant tout premier commit applicatif, rattacher leurs HEAD au premier commit main selon DEPLOYMENT.md ; aucun historique parallèle créé.

## D07 — Référence UI et conformité

La maquette est la référence Intérimaire ; l’Entreprise aura ses propres contenus et actions. Messagerie, urgence et documents sont différés. Conserver les couleurs de la référence plutôt qu’une palette aléatoire. Le sitemap public demandé par le PDF est à livrer, même si le cahier le rend optionnel. Tests, sécurité et accessibilité commencent dès les fondations, le Lot 8 consolide leurs preuves.
