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


---

# Design system InteriMatch

## Architecture des styles

Le produit portait 7 200 lignes de CSS écrites à la main. Elles font vivre des
écrans qui fonctionnent, et les remplacer d'un bloc est exactement ce qui a
produit les régressions de la tentative précédente.

L'entrée `src/styles/global.css` déclare donc une cascade en couches :

    @layer legacy, theme, base, components, utilities;

- `legacy` reçoit l'existant **sans qu'une ligne soit modifiée**, et se retrouve
  au plus bas de la cascade ;
- `theme` et `utilities` viennent de Tailwind v4, importés **sans Preflight** —
  l'import complet remettrait à zéro marges, titres et listes de toute la page,
  donc de tous les écrans non encore repris ;
- `base` et `components` portent le design system (`src/styles/interimatch.css`).

Conséquence pratique : tout ce que la refonte écrit passe au-dessus de l'existant
**sans surenchère de spécificité et sans un seul `!important`**. Un écran non
repris s'affiche exactement comme avant ; un écran repris est gouverné par les
nouvelles règles.

Preflight étant désactivé, une liste écrite par la refonte garde la puce et le
retrait du navigateur : la classe `.im-bare` remet cela à zéro **localement**.
Un reset global dépouillerait aussi les listes de texte des pages légales, où la
puce porte du sens.

## Identité

Vert émeraude, vert sauge et terracotta sont conservés et portés à maturité, en
OKLCH, dans le bloc `@theme` de `global.css`. Le papier est un blanc cassé
**chaud** : un gris bleuté ferait tableau de bord financier, ce que ce produit
n'est pas. Les rayons sont volontairement serrés — 8 px sur un contrôle, 14 px
sur une carte — parce que le « tout arrondi » est la signature la plus
reconnaissable d'une interface produite à la chaîne.

Playfair Display porte les titres, Inter l'interface. Le produit affichait
jusqu'ici `system-ui` et `Georgia`, c'est-à-dire les polices par défaut du
navigateur.

---

# Composants externes réellement intégrés

Chacun a été **récupéré depuis le registre public de sa bibliothèque**, lu, puis
adapté. Le fichier d'arrivée porte en commentaire la source, l'URL du registre,
et ce qui a été changé — et pourquoi.

| Fichier InteriMatch | Source | Composant | Licence |
| --- | --- | --- | --- |
| `components/ui/Reveal.tsx` | Magic UI | `blur-fade` | MIT |
| `components/ui/Ticker.tsx` | Magic UI | `number-ticker` | MIT |
| `components/ui/Texture.tsx` → `DotTexture` | Magic UI | `dot-pattern` | MIT |
| `components/ui/Texture.tsx` → `BeamFrame` | Magic UI | `border-beam` | MIT |
| `components/ui/Spotlight.tsx` | Magic UI | `magic-card` | MIT |
| `components/ui/RuleRing.tsx` | Magic UI | `animated-circular-progress-bar` | MIT |
| `pages/Home.tsx` (grille bento) | Magic UI | `bento-grid` | MIT |
| `components/ui/Segmented.tsx` | SmoothUI | `animated-tabs` | MIT |
| `components/applications/ApplicationTrack.tsx` | SmoothUI | `animated-stepper` | MIT |
| `components/profile/AvatarField.tsx` | Aceternity UI | `file-upload` | MIT |
| `layouts/AppLayout.tsx` (indicateur actif) | SmoothUI / Aceternity | `animated-tabs`, `resizable-navbar` | MIT |
| `components/profile/AvailabilityCalendar.tsx` | Opensource UI | `BookingSlotCalendar` | MIT |

## Ce qui a été changé, et pourquoi

Les adaptations ne sont pas cosmétiques. Les plus structurantes :

- **`dot-pattern`** rendait un `<motion.circle>` par point : plus de 3 000 nœuds
  animés pour une texture de fond. Remplacé par un `<pattern>` SVG unique.
- **`border-beam`** confine sa lueur au liseré par composition de masques. La
  composition n'a pas pris ici et a produit un demi-disque vert **posé sur le
  contenu**. Remplacé par deux plans empilés — dégradé conique, puis rectangle
  opaque en retrait d'un pixel — qui ne dépendent d'aucun masque.
- **`magic-card`** dépend de `next-themes` et propose un halo de 420 px. La
  dépendance tombe, le halo aussi : sur une grille de missions, c'est un effet de
  démonstration. Le dégradé violet/rose devient le vert de marque.
- **`animated-stepper`** ne connaît que des étapes qu'on franchit. Une
  candidature peut **s'arrêter** — refus, annulation : un quatrième état
  `failed`, avec sa géométrie propre, a été ajouté.
- **`file-upload`** dépend de `react-dropzone` et rend une trame de 451 `<div>`.
  Le glisser-déposer natif les remplace, et le champ reste la vraie commande —
  c'est lui qui rend le dépôt atteignable au clavier.
- **`number-ticker`** rend « 0 » dans le HTML : un tableau de bord y affichait un
  zéro à la place d'un chiffre juste tant que le script n'avait pas tourné. Le
  HTML porte désormais la vraie valeur, et un effet de mise en page la ramène à
  zéro avant la première peinture.
- **`BookingSlotCalendar`** réserve un créneau dans un agenda dont les
  disponibilités sont données : sept jours, huit horaires fixes. InteriMatch fait
  l'inverse — l'utilisateur DÉCLARE ses disponibilités, et un créneau y est un
  intervalle daté qui va de trois heures à trois mois. La bande de sept jours
  devient donc une grille mensuelle, les horaires fixes disparaissent (une
  coupure va de 18 h à 2 h du matin), et un jour porte un ÉTAT de couverture —
  `available`, `unavailable` ou `mixed` — au lieu d'un booléen.
- **`animated-tabs`** ne connaît que le motif `tablist`. La moitié des usages du
  produit ne sont pas des onglets : filtrer des missions par statut ne change pas
  de panneau. Un mode `filters` rend alors de simples boutons `aria-pressed`.

## Ce qui n'a pas été repris

Les composants maison sans équivalent externe pertinent : le **système de
statuts** (`components/ui/Status.tsx`) et l'**anneau de règles**
(`components/ui/RuleRing.tsx`, dont seule la technique d'arc vient de Magic UI).
Aucune bibliothèque ne propose ce dont le produit avait besoin : des statuts
distingués par la FORME plutôt que par la teinte, et un indicateur de complétion
qui dise **ce qui manque** et pas seulement combien.


---

# Pièges de la désactivation de Preflight

Preflight est volontairement absent (voir plus haut). Trois conséquences se sont
manifestées **en recette**, pas en relecture, et méritent d'être connues avant
d'écrire un composant :

1. **Un `<ul>` garde la puce et le retrait de 40 px du navigateur.** D'où la
   classe `.im-bare`, posée explicitement sur les listes de la refonte.
2. **Un `<button>` nu garde la bordure en relief et le fond gris du système.**
   Tout bouton écrit par la refonte pose donc `border-0 bg-transparent`, ou
   porte `.im-btn` qui s'en charge. Le sélecteur segmenté a passé une recette
   entière avec quatre entrées encadrées avant que ce ne soit vu.
3. **Une feuille importée depuis un composant .tsx n'est dans aucune couche**,
   et le non-layé l'emporte sur TOUTES les couches. `applications.css`,
   `admin.css` et `profile.css` sont donc enveloppées dans `@layer legacy { … }`
   à l'intérieur du fichier lui-même.
