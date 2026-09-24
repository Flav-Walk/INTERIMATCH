# Visuel de recette

`mission.jpg` est la photo servie par les serveurs éphémères — suite navigateur
et recette humaine — pour toute mission publiée par leurs jeux de données.

Elle n'est **pas** un repli de production : depuis la migration 010, une mission
InteriMatch porte la photo que son établissement a choisie, importée ou tirée de
la bibliothèque Unsplash. Aucun écran ne va chercher ce fichier de lui-même.

Elle existe parce que les jeux de recette écrivent `status='open'` en SQL direct
et doivent donc satisfaire la contrainte de photo sans passer par un stockage
distant. Voir `localFixtureMediaStore` dans le backend.

`avatar.svg` joue le même rôle pour la photo de PROFIL, devenue obligatoire avec
la migration 012 : les jeux de recette créent des intérimaires complets, et un
profil sans photo ne peut plus postuler.

Il est volontairement abstrait. Un visage photographique laisserait entendre que
le produit connaît cette personne, alors qu'aucun compte de recette ne
correspond à quiconque. Voir `localFixtureAvatarStore` dans le backend.
