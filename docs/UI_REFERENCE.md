# Lecture de image.png

Référence inspectée : 1321 × 876 pixels. Référence **Intérimaire**, selon la précision explicite de Flavien : établissement « Le Comptoir des Halles », CTA « Créer une mission », candidats et missions à pourvoir. Cette image n’est ni une liste exhaustive de fonctionnalités ni une capture du code actuel.

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


Les libellés de recrutement observés dans l’image ne changent pas son attribution Intérimaire, précisée par Flavien. Les tokens actuels sont dans apps/frontend/src/styles/tokens.css ; les photos restent différées.
