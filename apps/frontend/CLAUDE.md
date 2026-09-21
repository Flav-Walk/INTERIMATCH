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
Geist               @fontsource-variable/geist ← police unique, servie localement
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

Les couleurs créent un contraste fort : blocs sombres contre canevas clair.

```css
--forest:       oklch(0.32 0.065 165);  /* Vert Savoie — primary, fonds sombres de marque */
--forest-mid:   oklch(0.42 0.085 165);  /* Vert Lichen — secondary */
--orange:       oklch(0.75 0.17 43);    /* Orange Service — CTA uniquement */
--orange-ink:   oklch(0.52 0.16 43);    /* orange lisible en texte (≥ 4,5:1) */
--background:   oklch(0.975 0.003 165); /* fond global très clair */
--surface:      oklch(1 0 0);           /* fond cards */
--border:       oklch(0.88 0.008 160);  /* bordures hairline */
--ink:          oklch(0.23 0.02 160);   /* texte primaire / fonds sombres */
--muted:        oklch(0.45 0.02 160);   /* texte secondaire */
--radius-card:  24px;                   /* arrondis larges pour les blocs */
--radius-pill:  999px;                  /* boutons et tags */
```

Les composants du design system utilisent les alias `--c-*`, `--sp-*`, `--r-*`,
`--fs-*` définis en bas de `tokens.css` : ne pas y écrire de couleur littérale
ailleurs.

### Typographie

- **Geist** — unique famille pour tout (titres et texte), servie localement via
  `@fontsource-variable/geist` (importée dans `tokens.css`). Aucune requête tierce.
- `--font-ui` et `--font-display` pointent vers la même pile : ne pas réintroduire
  une seconde famille (pas de serif, pas de Montserrat / Inter).
- Graisses autorisées : **400, 500, 600**. Pas de 700 et plus.
- Objectif : rendu néo-minimaliste, lisibilité, poids réseau minimal (RGESN).

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

- **Contraste structurel fort** : alterner sections à fond sombre (`--ink` / `--forest`,
  texte blanc) et sections à fond clair (`--background`, texte `--ink`).
- **Formes** : boutons (CTA) et badges/tags en **pill** (`--radius-pill`) ; grandes
  cartes et blocs en `--radius-card`.
- **Hiérarchie** par la taille et les marges généreuses, sans multiplier les bordures.
- **Interactions** : hover très subtil (couleur de fond ou de texte) — pas de `scale`,
  pas d'ombres portées massives.
- **Orange** (`--orange`) : CTAs primaires et badge « urgent » uniquement.
- **Ornements** : aucun élément décoratif superflu (pas de blur-orbs).

---

## 12. RGAA / RGESN (contraintes projet)

- `<a href="#main-content">Aller au contenu</a>` en premier enfant du body (skip link).
- Attributs `aria-*` sur tous les éléments interactifs non standards.
- Contraste minimum RGAA 4.1 niveau AA.
- RGESN : police unique servie localement (sous-ensembles chargés à la demande),
  images en `loading="lazy"`, pas d'images décoratives lourdes.
