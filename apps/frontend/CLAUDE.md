# CLAUDE.md — INTERIMATCH / ALP'EMPLOI

> Fichier de référence pour Claude Code.
> Branche active : **develop**
> Scope Yrieix : `apps/frontend/` uniquement.

---

## 0. Identité projet

Plateforme d'intérim sectorisée **HCR (Hôtellerie-Cafés-Restauration)** en Auvergne-Rhône-Alpes.
Nom commercial : **ALP'EMPLOI** — Code Epitech : **INTERIMATCH / D-WEB-901**.

| Clé | Valeur |
|-----|--------|
| Repo | `https://github.com/Flav-Walk/INTERIMATCH` |
| Branche dev | `develop` |
| Deploy | `https://interimatch-five.vercel.app` |
| Node | `>=24 <25` |

---

## 1. Stack technique réelle

```
React 19.3          react + react-dom
React Router DOM 7  react-router-dom ^7.18.4
TypeScript 6.0      strict
Vite 8.3            bundler
Vitest 5.0          tests unitaires
Playwright 1.63     tests E2E (apps/frontend/e2e/)
Supabase JS 2.116   @supabase/supabase-js
Lucide React 1.46   lucide-react  ← SEULE lib d'icônes
Zod 4.6             validation schémas
Geist               @fontsource-variable/geist ← texte et interface, servie localement
Bricolage Grotesque @fontsource-variable/bricolage-grotesque ← titres uniquement, servie localement
```

**PAS de Tailwind. PAS de CSS Modules. PAS de styled-components.**
CSS vanilla avec variables CSS (`oklch`) dans `styles/tokens.css`.

---

## 2. Scripts npm

```bash
cd apps/frontend

npm run dev          # vite --host 127.0.0.1
npm run build        # tsc --noEmit && vite build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run test         # vitest run
npm run test:coverage # vitest run --coverage
npm run start        # vite preview
npm run test:e2e     # playwright test
```

Toujours lancer `npm run typecheck && npm run lint` avant de committer.

---

## 3. Arborescence `apps/frontend/src/`

```
src/
├── main.tsx                        ← point d'entrée, utilise AppLayout nommé
│
├── components/
│   ├── applications/
│   │   ├── ApplicationStatus.tsx
│   │   ├── ApplyToMission.tsx
│   │   ├── MissionApplications.tsx
│   │   └── RecentApplications.tsx
│   ├── form/
│   │   └── Field.tsx
│   ├── mission/
│   │   ├── MatchBadge.tsx
│   │   ├── MatchExplanation.tsx
│   │   ├── MissionCard.tsx         ← JobGlyph SVG par métier, pas d'imageUrl
│   │   ├── PlanningCard.tsx
│   │   └── SkillPicker.tsx
│   ├── ui/                         ← design system (1 dossier = 1 composant)
│   │   ├── Avatar/  Badge/  Button/  CandidateCard/  EmptyState/
│   │   ├── FilterChip/  Input/  MatchBadge/  MissionCard/
│   │   ├── NavigationItem/  Progress/  SearchInput/  Skeleton/
│   │   ├── StatusBadge/  Tabs/
│   │   └── index.ts                ← barrel export
│   ├── ConfirmDialog.tsx
│   ├── PageHero.tsx                ← bandeau clair des pages connectées (+ <div className="page-panel">)
│   ├── Guards.tsx
│   ├── GuidedTour.tsx
│   ├── PasswordField.tsx
│   └── PasswordStrength.tsx
│
├── hooks/                          ← 🚫 NE PAS MODIFIER (Flavien)
│   ├── AuthContext.tsx
│   ├── CompanyData.tsx
│   └── useAuth.ts
│
├── layouts/
│   └── AppLayout.tsx               ← named export + default export
│
├── pages/                          ← flat, pas de sous-dossiers
│   ├── Admin.tsx  Callback.tsx  Dashboard.tsx  Home.tsx  Login.tsx
│   ├── Missions.tsx  ProfileForm.tsx
│   ├── Company{Applications,Dashboard,MissionDetail,MissionForm,Missions}.tsx
│   └── Worker{Applications,MissionDetail,Profile}.tsx
│
├── services/                       ← 🚫 NE PAS MODIFIER (Flavien)
│
└── styles/
    ├── tokens.css                  ← variables CSS oklch (source de vérité)
    ├── global.css                  ← reset + règles globales
    ├── shell.css                   ← composants réutilisables
    ├── admin.css
    ├── animations.css
    ├── applications.css
    └── company-applications.css
```

---

## 4. Système CSS — règles absolues

### Variables (tokens.css — noms réels)

Palette « Altheia » : deux verts, une crème, un or. Le vert profond mène, le vert moyen
répond, l'or signale. Source : le visuel de charte fourni par Yrieix.

```css
--vert-profond:   oklch(0.319 0.051 183); /* #0A3B35 — marque : hero d'accueil et de dashboard, bouton principal, encre des titres */
--vert-moyen:     oklch(0.45 0.064 172);  /* #2A6151 — survols, focus */
--laurier:        oklch(0.772 0.019 124); /* #B2B7AA — neutres froids : états éteints, fonds discrets (jamais en texte) */
--creme:          oklch(0.978 0.011 77);  /* #FCF7F0 — fond global */
--or:             oklch(0.825 0.048 76);  /* #D8C2A4 — signal : CTA, match, disponible. Texte nuit ou vert profond dessus */
--nuit:           oklch(0.2 0.025 172);   /* #091A15 — texte principal */
--brume:          oklch(0.47 0.025 165);  /* #4E5F57 — texte secondaire */
--cuivre:         oklch(0.55 0.19 28);    /* #C93029 — urgence, erreurs. Texte blanc dessus (5,3:1) */
--surface:        oklch(1 0 0);           /* fond cards */
--radius-card:    24px;                   /* arrondis larges pour les blocs */
--radius-pill:    999px;                  /* boutons et tags */
```

Attention : sur le visuel de charte, le HEX du « Deep bluish green » est imprimé `#0A3B25`
mais son RVB (10 | 59 | 53) donne `#0A3B35`. Le RVB correspond à l'aplat affiché et c'est lui
qui est retenu. À faire confirmer par l'auteur du visuel.

Noms sémantiques : `--brand` (= `--vert-profond`), `--brand-hi` (= `--vert-moyen`), `--accent`
(= `--or`), `--accent-hover`. Les feuilles de style écrivent ces noms, jamais la teinte :
changer de palette revient à changer les alias dans `tokens.css`. Encre et teintes de la
marque : `--brand-ink`, `--brand-50`, `--brand-100`, `--accent-ink`, `--accent-50`,
`--laurier-50`, `--laurier-100`. Échelles du design system : `--c-brand-*`, `--c-accent-*`.
Alias courts historiques (à retirer au fil des migrations) : `--background` → `--creme`,
`--ink` → `--nuit`, `--muted` → `--brume`, `--tint` → `--laurier-100`.

L'or ne sert jamais de couleur de texte sur fond clair (1,7:1) : sur fond clair, texte
d'accent = `--accent-ink` (6,6:1) ou `--brand-ink`. Le cuivre porte du texte blanc, jamais du
texte nuit (3,4:1).

Les composants du design system utilisent les alias `--c-*`, `--sp-*`, `--r-*`,
`--fs-*` définis en bas de `tokens.css` : ne pas y écrire de couleur littérale
ailleurs.

### Typographie

- **Geist** — texte et interface (boutons, badges, formulaires), servie localement via
  `@fontsource-variable/geist`. Graisses : 400, 500, 600.
- **Bricolage Grotesque** — titres `h1` et `h2` uniquement, via `--font-title`
  (graisses 600 à 700), servie localement. `--font-ui` et `--font-display`
  restent Geist.
- Aucune requête tierce (RGESN). Pas de serif, pas d'Inter / Montserrat.

### Icônes

`lucide-react` **uniquement**. Ne jamais importer Phosphor, HeroIcons, Material Icons.

### Règles CSS

- CSS vanilla, variables CSS via `var(--token)`.
- PAS de Tailwind, PAS de classes utilitaires externes.
- Sentence case partout (sauf noms de marque).

---

## 5. Périmètre Yrieix

### ✅ Modifiable

`apps/frontend/src/pages/`, `components/`, `styles/`, `layouts/`.

### 🚫 Jamais toucher

`apps/frontend/src/services/`, `apps/frontend/src/hooks/`, `apps/backend/`,
`config/`, `docs/`, `tools/`.

---

## 6. Hooks — contrats de lecture seule

### `useAuth()`

```typescript
const { user, revision } = useAuth();
// PAS de .role, PAS de .signOut
```

**Déduire le rôle depuis le pathname :**

```typescript
import { useLocation } from 'react-router-dom';
const { pathname } = useLocation();
const role = pathname.startsWith('/company') ? 'company' : 'worker';
```

### `AppLayout.tsx`

Deux exports (`export { AppLayout }` nommé pour `main.tsx`, et `export default`).
`handleSignOut` → `navigate('/login')` (signOut réel non branché).

---

## 7. Type Mission (`services/missions.ts` — lecture seule)

```typescript
type Mission = {
  id: string; title: string; job: string;
  starts_at: string; ends_at: string;
  city: string; address: string; postal_code: string;
  pay_amount: string | null; pay_unit: string | null;
  headcount: number;
  status: 'draft' | 'open' | 'filled' | 'completed' | 'cancelled';
  skills: string[];
};
```

Pas d'`imageUrl` : pas d'image d'illustration, on utilise les **JobGlyphs** (SVG).

---

## 8. Statuts

| Entité | Valeurs |
|--------|---------|
| Mission | `draft` · `open` · `filled` · `completed` · `cancelled` |
| Candidature | `pending` · `accepted` · `rejected` |

Dans le flux de page → `<Badge>` (avec `MISSION_STATUS_VARIANT` /
`APPLICATION_STATUS_VARIANT`). Superposé à un visuel → `<StatusBadge>`.

---

## 9. Architecture n8n (référence)

Flux : `Frontend → Backend → BDD → événement n8n`.
Jamais d'appel direct frontend → n8n.

| Événement | Déclencheur |
|-----------|-------------|
| `matching.found` | Nouveau matching calculé |
| `application.interested` | Candidature soumise |
| `candidate.selected` | Candidature acceptée |
| `worker.profile_updated` | Profil intérimaire mis à jour |
| `worker.onboarded` | Inscription terminée |

---

## 10. Tests

| Suite | Nombre | État |
|-------|--------|------|
| Backend (NestJS) | 46 | ✅ |
| Frontend (Vitest) | 120 | ✅ |
| E2E (Playwright) | 10 | ✅ |

---

## 11. Charte design (néo-minimaliste)

- **Clair par défaut, un seul moment sombre par écran.** Fond `--creme`, cartes
  blanches à filet fin (`--border`), pas d'ombres pour les séparer. Le sombre (`--brand`,
  texte blanc) est réservé à une carte : le hero de l'accueil ou du dashboard, en carte
  arrondie inset (`--radius-card`), jamais en dalle pleine largeur. En-tête et pied de page
  sont clairs.
- **Le vert profond est une encre** sur fond clair : titres, liens, logo, texte des états
  actifs (`--brand-ink`). Les surfaces secondaires (états actifs, avatars, cartes
  d'information, badges) prennent une teinte (`--brand-50/100`, `--accent-50`), pas un
  aplat. Seul le bouton principal reste plein.
- **Formes** : boutons (CTA) et badges/tags en **pill** (`--radius-pill`) ; grandes
  cartes et blocs en `--radius-card`.
- **Hiérarchie** par la taille et les marges généreuses, sans multiplier les bordures.
- **Interactions** : hover très subtil (couleur de fond ou de texte) — pas de `scale`,
  pas d'ombres portées massives.
- **Or** (`--accent`) : CTAs primaires, badge de match, état « disponible ». Une seule
  action en or par écran. **Cuivre** (`--cuivre`) : « urgent » et erreurs.
- **Pages connectées** : `<PageHero>` (bandeau clair, lavis `--brand-50`) suivi
  d'un panneau clair `.page-panel` (ou `.missions-page__body`, `.dashboard-layout`,
  `.detail-layout`) qui chevauche le hero. Photos : icônes métiers en arche, duotone vert profond ;
  tant que les clichés ne sont pas livrés, on garde les JobGlyphs.
- **Ornements** : aucun élément décoratif superflu (pas de blur-orbs).

### Logo

- **Composition** : repère + mot-symbole `alp'emploi` en minuscules, Bricolage Grotesque 700,
  interlettrage serré (-0,035em).
- **Repère** : un sommet aux angles adoucis avec un petit soleil rond en or en haut à
  droite. Version « rich » : rempli d'un dégradé vert profond (puis d'une photo en duotone
  « nuit » quand elle sera livrée).
- **Apostrophe** : surlignée par un rectangle arrondi de la couleur de signal (or), texte
  sur fond sombre. Sur un fond de la couleur de signal, l'inverse (rectangle sombre).
- **Tailles** : version « rich » à partir de 48 px ; en dessous (en-tête, pied de page,
  favicon), version **aplat** d'une seule couleur.
- **Code** : composant `components/Logo.tsx` (`<Logo />`, `<LogoMark />`), styles `.logo*`
  dans `shell.css`, favicon `public/favicon.svg`.
- **Trois formes de découpe photo** : sommet (logo, héro), arche (icônes métiers, rayon
  `999px 999px 16px 16px`), rond (avatars). Les grandes cartes gardent `--radius-card`.
- **Duotones** : « nuit » par défaut sur toutes les photos ; « signal » réservé aux états
  « disponible » et « match ».

---

## 12. RGAA / RGESN (contraintes projet)

- `<a href="#main-content">Aller au contenu</a>` en premier enfant du body (skip link).
- Attributs `aria-*` sur tous les éléments interactifs non standards.
- Contraste minimum RGAA 4.1 niveau AA.
- RGESN : police unique servie localement (sous-ensembles chargés à la demande),
  images en `loading="lazy"`, pas d'images décoratives lourdes.
