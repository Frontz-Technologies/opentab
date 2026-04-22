# OpenTab Design System

> Living document — update this file whenever design decisions change.

---

## Creative North Star: "The Digital Ledger"

OpenTab occupies a precise aesthetic intersection: the editorial rigour of a well-typeset financial publication, the density-tolerance of a developer tool, and the tactile warmth of high-end stationery. In dark mode, think a Moleskine ledger rendered in dark glass. In light mode, think premium parchment stationery — structured, warm, purposeful.

Every visual decision should answer: _does this feel like a tool a serious freelancer trusts with their money?_

Both themes share the same emerald accent, typography, layout rules, and tonal separation philosophy. The warm undertone is the constant — dark mode uses warm charcoals, light mode uses warm parchments. Neither feels "cold" or "clinical."

---

## Colors — Tonal Atmosphere

### The No-Line Rule

Never use a 1px border to separate sections or define layout regions. Separation comes exclusively from tonal surface shifts. The eye reads depth through colour temperature, not strokes.

**Exception:** ghost borders at 15% opacity (`outline-variant` at low alpha) are permitted as a last resort when purely tonal separation fails — e.g., inside a frosted-glass overlay where background bleed makes surface colour unreadable.

### Surface Hierarchy

Surfaces stack tonally to create depth. In dark mode, elevation goes from darkest (floor) to lightest (most elevated). In light mode, the direction reverses — the floor is the lightest, and elevation adds warmth/density downward.

Both palettes use the same warm undertone family. The light palette's olive-parchment tint mirrors the dark palette's warm charcoal.

**Dark mode:**

| Token                       | Hex       | Role                              |
| --------------------------- | --------- | --------------------------------- |
| `surface-dim`               | `#131313` | Page background — the floor       |
| `surface-container-lowest`  | `#0E0E0E` | Recessed wells, input fills       |
| `surface-container-low`     | `#1C1B1B` | Subtle inset sections             |
| `surface-container`         | `#201F1F` | Default card surface              |
| `surface-container-high`    | `#2A2A2A` | Raised cards, hover states        |
| `surface-container-highest` | `#353534` | Tooltips, popovers, most elevated |
| `surface-bright`            | `#3A3939` | Highlighted / selected rows       |

**Light mode:**

| Token                       | Hex       | Role                              |
| --------------------------- | --------- | --------------------------------- |
| `surface-dim`               | `#FAFAF9` | Page background — warm parchment  |
| `surface-container-lowest`  | `#FDFDFC` | Recessed wells, input fills       |
| `surface-container-low`     | `#F5F5F0` | Subtle inset sections             |
| `surface-container`         | `#EEEEE8` | Default card surface              |
| `surface-container-high`    | `#E5E5DF` | Raised cards, hover states        |
| `surface-container-highest` | `#DDDDD7` | Tooltips, popovers, most elevated |
| `surface-bright`            | `#D5D5CF` | Highlighted / selected rows       |

Use one step up the hierarchy to create lift. Never skip two steps — the contrast differential becomes harsh. This rule applies identically in both themes.

### Primary & Accent

The emerald primary is the brand anchor across both themes. In light mode, the primary shifts deeper to maintain contrast and readability against pale backgrounds.

**Dark mode:**

| Token                 | Hex       | Usage                                       |
| --------------------- | --------- | ------------------------------------------- |
| `primary`             | `#4EDEA3` | Active states, links, focus rings, key data |
| `primary-container`   | `#10B981` | Filled chip backgrounds                     |
| `on-primary`          | `#003824` | Text on primary-coloured surfaces           |
| `secondary`           | `#9ED2B5` | Secondary interactive elements              |
| `secondary-container` | `#21523C` | Secondary chip/badge backgrounds            |

**Light mode:**

| Token                 | Hex       | Usage                                       |
| --------------------- | --------- | ------------------------------------------- |
| `primary`             | `#087055` | Active states, links, focus rings, key data |
| `primary-container`   | `#10B981` | Filled chip backgrounds                     |
| `on-primary`          | `#FFFFFF` | Text on primary-coloured surfaces           |
| `secondary`           | `#3D7A5C` | Secondary interactive elements              |
| `secondary-container` | `#C8EDD8` | Secondary chip/badge backgrounds            |

### Tertiary / Danger

**Dark mode:**

| Token                   | Hex       | Usage                                                                  |
| ----------------------- | --------- | ---------------------------------------------------------------------- |
| `tertiary`              | `#FFB3AF` | Soft warnings, overdue indicators                                      |
| `tertiary-container`    | `#FC7C78` | Destructive action fills (Delete / Reset confirmations)                |
| `on-tertiary-container` | `#711419` | Text on destructive action fills                                       |
| `error`                 | `#FFB4AB` | Inline form-error feedback (banner text + tinted bg via `bg-error/10`) |
| `error-container`       | `#93000A` | Solid error fills where needed                                         |

**Light mode:**

| Token                   | Hex       | Usage                                                                  |
| ----------------------- | --------- | ---------------------------------------------------------------------- |
| `tertiary`              | `#B3261E` | Soft warnings, overdue indicators                                      |
| `tertiary-container`    | `#F9DEDC` | Destructive action fills (Delete / Reset confirmations)                |
| `on-tertiary-container` | `#8C1D18` | Text on destructive action fills                                       |
| `error`                 | `#B3261E` | Inline form-error feedback (banner text + tinted bg via `bg-error/10`) |
| `error-container`       | `#F9DEDC` | Solid error fills where needed                                         |

**Inline form-error banners** (post-submit failures on `/login`, `/register`, `/reset-password`, etc.) use the `error` token pair: `p-4 rounded-xl bg-error/10 text-error text-sm mb-6` plus `role="alert"`. This is the M3 "error" role — reserve `tertiary-container` for destructive _action_ affordances (Reset-demo button, delete dialogs).

### Text

**Dark mode:**

| Token                | Hex       | Usage                                                  |
| -------------------- | --------- | ------------------------------------------------------ |
| `on-surface`         | `#E5E2E1` | Primary body text — warm near-white                    |
| `on-surface-variant` | `#BBCABF` | Secondary text, placeholders, captions                 |
| `outline`            | `#86948A` | Disabled states, decorative separators (use sparingly) |
| `outline-variant`    | `#3C4A42` | Ghost border fallback                                  |

**Light mode:**

| Token                | Hex       | Usage                                                  |
| -------------------- | --------- | ------------------------------------------------------ |
| `on-surface`         | `#1A1A1A` | Primary body text — deep charcoal, not pure black      |
| `on-surface-variant` | `#4A5A4F` | Secondary text — green-tinted for brand cohesion       |
| `outline`            | `#8A9A8E` | Disabled states, decorative separators (use sparingly) |
| `outline-variant`    | `#C2CFC6` | Ghost border fallback                                  |

Avoid pure `#FFFFFF` (dark mode) and pure `#000000` (light mode). Both text colours carry a warm tint that reads more natural against their respective palettes.

### Glass & Gradient Rule

**Floating elements** (modals, dropdowns, sidebars, tooltips) use glassmorphism:

**Dark mode:**

- Background opacity: 70% of the underlying surface token
- Backdrop blur: `blur(24px)` (`backdrop-filter: blur(24px)`)
- Combined with a ghost border at `outline-variant` 15% opacity to define the edge

**Light mode:**

- Background opacity: 85% of the underlying surface token (higher than dark — light backgrounds make blur artifacts more visible)
- Backdrop blur: `blur(16px)` (reduced to avoid the "frosted shower door" effect)
- Combined with a ghost border at `outline-variant` 10% opacity

**Call-to-action buttons** use the solid emerald primary token. A
`.btn-gradient` utility exists in `apps/web/app/globals.css` for legacy
reasons but is **reserved** — do not use in product code. We evaluated
a gradient CTA (`linear-gradient(135deg, #4EDEA3, #10B981)`) and
decided against it: a single flat colour is easier to reason about
across Button / Link / disabled / hover / focus states, and reduces the
visual noise on screens that already carry several surface tiers. The
utility stays defined so removing it later is a one-commit cleanup; new
code must not reference it.

---

## Typography — Editorial Logic

Four typefaces, each with a precise role. Never swap them.

| Family             | Token           | Role                                                      | Why                                                                     |
| ------------------ | --------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Manrope**        | `font-headline` | Display text, page headings, section titles               | Geometric, high x-height, authoritative at large sizes                  |
| **Inter**          | `font-body`     | Body copy, paragraphs, form labels, prose                 | Optimised for screen legibility in dense financial UIs                  |
| **Space Grotesk**  | `font-label`    | Financial figures, status badges, table headers, metadata | Monospace-leaning — numbers align in columns without true mono overhead |
| **JetBrains Mono** | `font-mono`     | Invoice numbers, API keys, code snippets, IBANs           | True monospace for values where every character position matters        |

### Scale Guidance

Use extreme scale contrast to create editorial hierarchy. A dashboard page might have:

- A `text-4xl font-headline font-bold` KPI figure
- A `text-xs font-label uppercase tracking-widest` label beneath it
- A `text-sm font-body` description paragraph

The gap between the largest and smallest text on a page should feel intentional, not accidental.

### Number Formatting

All financial values, percentages, and counts use `font-label` (Space Grotesk). When a value must be absolutely precise in a monospace grid (e.g., an invoice line-item table), use `font-mono` (JetBrains Mono).

---

## Elevation & Depth

OpenTab uses **tonal layering** — not box shadows — to communicate elevation.

- **Shadows are banned** for layout elevation. They belong to a different era of flat-to-skeuomorphic design.
- **Elevation = surface token value.** An element on `surface-container-high` is visually higher than one on `surface-container`.
- **Interaction lift:** on hover, raise a card from `surface-container` → `surface-container-high`. This single-step shift signals interactivity.
- **Ghost border fallback:** when a floating element (glass overlay) needs an explicit boundary, use `border border-outline-variant/15` — a 1px stroke at 15% opacity. This is the only border exception.

---

## Voice & Tone

OpenTab's copy should sound like a confident colleague, not a press release. Direct, specific, free of filler. The interface already carries the brand; text should carry meaning.

### Rules

- **No em-dashes (`—`) in user-facing copy.** This applies to anything a user reads: translation files, hardcoded JSX strings, page titles, marketing taglines, error messages, placeholder text. Rewrite each case on its merits:
  - **Comma** for a soft aside: _"…your finances, without calling your accountant."_
  - **Colon** when announcing a consequence or definition: _"OpenTab: keep tabs on your business."_
  - **Period** when the fragments are really two sentences: _"Greek business detected. Greek features will follow."_
  - Never swap a `—` for `--` or `-`. Rewrite the sentence.
  - Code comments, JSDoc, git commits, and internal docs (this file, ARCHITECTURE.md, CONVENTIONS.md, CLAUDE.md) are exempt.
- **Prefer active voice.** _"We saved your invoice"_ beats _"Your invoice has been saved."_
- **No corporate filler.** Drop "simply", "just", "please note", "kindly". If the sentence works without them, remove them.
- **Numbers are facts, not dramatics.** _"3 clients overdue"_ beats _"You have 3 clients overdue!"_. Save exclamation marks for the one per-page moment that earns them.

### Localisation notes

- Greek quote marks are `«»`, not `""`. Greek question mark is `;`, not `?`.
- Spanish opens questions with `¿`. Keep both marks.
- When an English sentence reads naturally with a comma aside, the Greek and Spanish equivalents usually do too. Resist the urge to translate punctuation structure one-to-one. Translate the rhythm.

---

## Components

### Buttons

**Primary (solid emerald):**

- Background: `bg-primary` (dark: `#0A8F6C`, light: `#087055`) or `bg-primary-container` for the brighter fill
- Text: `on-primary` (`#003824`), `font-label`, medium weight
- Border radius: `rounded-lg` (0.5rem)
- One per page region — the hero action, nothing more
- Note: `.btn-gradient` is reserved, not used. New code must not reference it.

**Secondary (surface):**

- Background: `surface-container-high`
- Text: `on-surface`
- No border. Hover shifts to `surface-container-highest`

**Destructive:**

- Background: `tertiary-container` (`#FC7C78`)
- Text: `on-tertiary-container`
- Confirm destructive actions with an intermediate step — never a single click

**Ghost / text button:**

- No background, no border
- Text: `primary` on hover, `on-surface-variant` at rest

### Inputs

- Fill: `surface-container-lowest` (`#0E0E0E`) — recessed below the card surface
- Text: `on-surface`
- Placeholder: `on-surface-variant`
- Focus: background shifts to `surface-container-low`, primary-coloured ring (`ring-primary/50`)
- No visible border at rest. The recessed fill is the affordance.
- Error state: ring switches to `tertiary-container`

### Cards

- Background: `surface-container` (`#201F1F`)
- Border radius: `rounded-xl` (0.75rem)
- Padding: generous — prefer `p-6` over `p-4`
- **No `<hr>` or border dividers inside cards.** Separate sections with vertical whitespace (`space-y-6` or `mt-6 pt-6` with no border)
- Hover state (when interactive): background lifts to `surface-container-high`

### Sidebar

- Width: 240px fixed
- Style: glassmorphic — `bg-surface-container/70 backdrop-blur-[24px]`
- Ghost edge border: `border-r border-outline-variant/15`
- Nav items: `font-label text-sm`, `on-surface-variant` at rest, `on-surface` + `surface-container-high` background when active
- Active indicator: 2px left border in `primary`

### Status Badges

Implemented via `.status-badge` utility class:

```css
font-family: Space Grotesk;
font-size: 0.625rem; /* 10px */
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.05em;
padding: 0.25rem 0.75rem;
border-radius: 9999px; /* pill */
```

Common variants (both themes use the same token references — the values resolve per theme):

| Status         | Background                  | Text                 |
| -------------- | --------------------------- | -------------------- |
| Paid / Active  | `primary-container/20`      | `primary`            |
| Overdue        | `tertiary-container/20`     | `tertiary`           |
| Draft          | `surface-container-highest` | `on-surface-variant` |
| Pending / Sent | `secondary-container`       | `secondary`          |

**Light mode resolved examples:**

| Status         | Background | Text      |
| -------------- | ---------- | --------- |
| Paid / Active  | `#D1FAE5`  | `#067049` |
| Overdue        | `#F9DEDC`  | `#B3261E` |
| Draft          | `#DDDDD7`  | `#5C6B60` |
| Pending / Sent | `#C8EDD8`  | `#3D7A5C` |

Never introduce blue (`#0070F3`, etc.) for status badges — keep all status colours within the emerald/red/neutral family.

---

## Icons

Two icon systems, each for a distinct context:

**Material Symbols Outlined** — navigation, feature icons, section markers

- Use the `outlined` weight for consistency with the open, airy aesthetic
- Size at 20px or 24px; never smaller than 16px

**Lucide React** — small in-line UI icons (via shadcn)

- Inline icons inside buttons, inputs, table cells
- Stroke-based, pairs cleanly with Inter at small sizes

Never mix the two systems within a single UI region. Navigation uses Material; inline UI uses Lucide.

---

## Do's and Don'ts

### Do

- Use **extreme typographic scale** — large display figures feel premium
- Layer surfaces tonally — depth without shadows
- Apply **asymmetric padding** in layouts: wider gutters on the right, compressed on the left creates editorial tension
- Keep the emerald primary as the _only_ saturated colour anchor in both themes
- Use the solid emerald primary button sparingly — one hero action per page region
- Use **token references** (not hex values) so both themes resolve automatically

### Don't

- Use **opaque borders** for layout separation — tonal shifts only (both themes)
- Use **standard blue** (`#0070F3`, etc.) for any interactive element — the emerald primary owns that role
- Use pure `#FFFFFF` text (dark) or pure `#000000` text (light) — both carry warm tints
- **Crowd the sidebar** — empty space in navigation communicates calm confidence
- Hard-code hex colours in components — always use semantic tokens so theme switching works

---

## Dual Theme Architecture

OpenTab supports two themes: **Dark** (default) and **Light**. Dark is the primary brand expression. Light is the companion — it must feel like the same product, not a desaturated afterthought.

### Implementation

- `darkMode: "class"` in `tailwind.config.ts` toggles between themes
- The `dark` class on `<html>` activates dark mode (default)
- Removing the `dark` class activates light mode
- User preference is stored in the `user_preferences.theme` column and applied server-side
- All colour tokens are defined as CSS custom properties with both dark and light values
- Components must use semantic tokens (e.g., `bg-surface-container`) — never raw hex values

### Design Parity Checklist

When building or modifying any component, verify it works in both themes:

1. Surface hierarchy uses token references, not hex
2. Primary colour contrast is sufficient (dark: `#4EDEA3`, light: `#087055`)
3. Glass effects use the correct opacity/blur per theme
4. Status badges resolve correctly
5. The No-Line Rule applies in both themes — no opaque borders

### Light Mode — Quick Reference

```
Surfaces:        #FAFAF9 → #FDFDFC → #F5F5F0 → #EEEEE8 → #E5E5DF → #DDDDD7 → #D5D5CF
Primary:         #087055 (deep emerald — WCAG AA body on parchment)
Primary CTA:     #087055 (solid emerald)
Text:            #1A1A1A (primary) / #4A5A4F (secondary, green-tinted)
Danger:          #B3261E (text) / #F9DEDC (container)
Ghost border:    rgba(194, 207, 198, 0.10)
Glass:           85% opacity, blur(16px)
```
