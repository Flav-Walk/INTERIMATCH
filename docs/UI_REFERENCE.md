# Lecture de image.png

Référence inspectée : 1321 × 876 pixels. Cette image n’est ni une liste exhaustive de fonctionnalités ni une capture du code actuel.

## Point à trancher : à quel espace appartient la maquette ?

Flavien a précisé à deux reprises que `image.png` est la référence **Intérimaire**. Le contenu observé dit l’inverse : compte « Marie Dupont · Le Comptoir des Halles », titre « Prêt à renforcer votre équipe ? », sous-titre « Publiez une mission… trouvez des talents qualifiés », CTA « Créer une mission », onglets « Vos missions », « Candidats », et un bloc « Candidatures récentes » affichant des pourcentages de match avec « Voir le profil ». Ce sont les actions d’une entreprise qui recrute, pas celles d’un intérimaire qui cherche une mission.

Deux lectures possibles, sans conséquence sur le travail déjà fait :

1. l’étiquette est une inversion de nom, et la maquette décrit l’espace Entreprise ;
2. la maquette a été produite comme « écran de référence » générique et son contenu n’a pas été relu.

Dans les deux cas la consigne opérationnelle est la même et a été appliquée : **conserver l’identité graphique** — couleurs, rayons, typographie, densité, structure deux colonnes — et adapter les contenus au rôle affiché. C’est ce qui est implémenté. À confirmer par l’équipe avant de produire les écrans Missions du Lot 3, où la question deviendra structurante.

## Composition observée

Navigation horizontale d’environ 54 px : marque à gauche, liens métier au centre, recherche/notifications/compte à droite. Marge extérieure proche de 20–28 px. Contenu desktop en deux colonnes, environ 3/4 pour les missions et 1/4 pour le planning, gouttière proche de 18 px. Hero photo restaurant ~935 × 262 px, texte blanc sur zone sombre et CTA orange. Quatre cartes mission avec photo, statut, poste, localisation, créneau et candidatures ; blocs inférieurs de réponses et messages ; planning à droite et footer discret.

## Direction visuelle à traduire en tokens

Valeurs indicatives estimées visuellement, pas des mesures colorimétriques : vert forêt ~#103D30, orange ~#FF642B, fond cassé très clair ~#F7F7F4, surface blanche, encre ~#17211C, bordure gris clair. Préserver cette identité imposée ; les valeurs finales et contrastes seront mesurés à l’implémentation. L’orange observé avec texte blanc doit être contrôlé et ajusté pour les petits textes.

Titres éditoriaux à empattements, interface/corps sans empattements. Familles exactes non identifiables depuis l’image ; prévoir serif système pour les titres d’accueil et sans système pour les contrôles. Titre hero ~36 px, titres de section ~20 px, texte ~14–16 px. Pas d’écriture manuscrite nécessaire pour le P0.

Rayons approximatifs 10–14 px, badges pilules, bordures fines, ombres très discrètes. Espacements à normaliser sur 4/8/12/16/24/32 px. Icônes linéaires homogènes, photos sectorielles et portraits ponctuels. Photos optimisées/licenciées à sélectionner plus tard ; ne pas présenter les personnages ou chiffres de la maquette comme données réelles.

## Adaptation métier

Entreprise : CTA création, suivi missions et places à pourvoir, réponses des candidats, attribution et planning établissement. Intérimaire : CTA disponibilités, complétion de profil, propositions reçues avec explication du score, accepter/refuser et prochaines missions. Navigation Intérimaire centrée sur propositions, disponibilités et profil. Même typographie, couleurs, boutons et états ; contenus différents.

Messagerie, mode urgent, documents et aide conversationnelle visibles sur l’image restent hors P0. Aucun bouton factice correspondant à un service absent.

## Responsive et accessibilité à vérifier

Sur mobile, navigation compacte, colonne unique, action principale avant contenus secondaires et cartes réorganisées sans débordement. Ordre de lecture sémantique, contrôle clavier, focus visible, labels, contrastes et statuts textuels. Cibles tactiles confortables, états vide/chargement/erreur réels. Fondation rendue et testée sur desktop et mobile ; voir TESTING.md.


## État au Lot 1

Tokens dans `apps/frontend/src/styles/tokens.css` : vert forêt `oklch(0.32 0.065 165)`, orange `oklch(0.75 0.17 43)`, fond `oklch(0.975 0.003 165)`, encre, bordure, teinte pâle, rayon 12 px et échelle d’espacement 4/8/12/16/24/32. Titres à empattements, interface sans empattements, comme sur la référence.

Implémenté et vérifié au navigateur sur desktop et mobile : accueil public, connexion et inscription en deux panneaux (récit sombre + formulaire), choix du rôle en deux cartes, onboarding en fieldsets, et espace de travail en deux colonnes reprenant la composition de la maquette — bloc d’accueil vert forêt avec CTA orange, section principale, panneaux latéraux localisation et planning. Les états vides sont réels et annoncent ce qui n’existe pas encore, sans bouton factice : l’action « Créer une mission » est visible mais désactivée et annoncée comme disponible au prochain lot.

Les photos, la messagerie, le mode urgent, les documents et l’aide conversationnelle visibles sur l’image restent hors P0. Aucun personnage ni chiffre de la maquette n’est présenté comme une donnée réelle ; les comptes de démonstration portent un bandeau explicite.
