# OpenTab Design System

> Living document — update this file whenever design decisions change.

---

## Creative North Star: "The Digital Ledger"

OpenTab occupies a precise aesthetic intersection: the editorial rigour of a well-typeset financial publication, the density-tolerance of a developer tool, and the tactile warmth of high-end stationery. Think a Moleskine ledger rendered in dark glass — structured, premium, purposeful.

Every visual decision should answer: _does this feel like a tool a serious freelancer trusts with their money?_

---

## Colors — Tonal Atmosphere

### The No-Line Rule

Never use a 1px border to separate sections or define layout regions. Separation comes exclusively from tonal surface shifts. The eye reads depth through colour temperature, not strokes.

**Exception:** ghost borders at 15% opacity (`outline-variant` at low alpha) are permitted as a last resort when purely tonal separation fails — e.g., inside a frosted-glass overlay where background bleed makes surface colour unreadable.

### Surface Hierarchy

Surfaces stack from darkest (base/floor) to lightest (most elevated):

| Token                       | Hex       | Role                              |
| --------------------------- | --------- | --------------------------------- |
| `surface-dim`               | `#131313` | Page background — the floor       |
| `surface-container-lowest`  | `#0E0E0E` | Recessed wells, input fills       |
| `surface-container-low`     | `#1C1B1B` | Subtle inset sections             |
| `surface-container`         | `#201F1F` | Default card surface              |
| `surface-container-high`    | `#2A2A2A` | Raised cards, hover states        |
| `surface-container-highest` | `#353534` | Tooltips, popovers, most elevated |
| `surface-bright`            | `#3A3939` | Highlighted / selected rows       |

Use one step up the hierarchy to create lift. Never skip two steps — the contrast differential becomes harsh.

### Primary & Accent

| Token                 | Hex       | Usage                                       |
| --------------------- | --------- | ------------------------------------------- |
| `primary`             | `#4EDEA3` | Active states, links, focus rings, key data |
| `primary-container`   | `#10B981` | Gradient endpoint, filled chip backgrounds  |
| `on-primary`          | `#003824` | Text on primary-coloured surfaces           |
| `secondary`           | `#9ED2B5` | Secondary interactive elements              |
| `secondary-container` | `#21523C` | Secondary chip/badge backgrounds            |

### Tertiary / Danger

| Token                   | Hex       | Usage                                  |
| ----------------------- | --------- | -------------------------------------- |
| `tertiary`              | `#FFB3AF` | Soft warnings, overdue indicators      |
| `tertiary-container`    | `#FC7C78` | Error fills, destructive action states |
| `on-tertiary-container` | `#711419` | Text on error fills                    |

### Text

| Token                | Hex       | Usage                                                  |
| -------------------- | --------- | ------------------------------------------------------ |
| `on-surface`         | `#E5E2E1` | Primary body text — warm near-white                    |
| `on-surface-variant` | `#BBCABF` | Secondary text, placeholders, captions                 |
| `outline`            | `#86948A` | Disabled states, decorative separators (use sparingly) |
| `outline-variant`    | `#3C4A42` | Ghost border fallback                                  |

Avoid pure `#FFFFFF`. `on-surface` (#E5E2E1) has a warm tint that reads more natural against the dark palette.

### Glass & Gradient Rule

**Floating elements** (modals, dropdowns, sidebars, tooltips) use glassmorphism:

- Background opacity: 70% of the underlying surface token
- Backdrop blur: `blur(24px)` (`backdrop-filter: blur(24px)`)
- Combined with a ghost border at `outline-variant` 15% opacity to define the edge

**Call-to-action buttons** use the gradient:

```css
background: linear-gradient(135deg, #4edea3, #10b981);
```

This gradient is reserved for the single primary action per screen. Don't apply it to secondary or tertiary buttons.

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

## Components

### Buttons

**Primary (gradient):**

- Background: `linear-gradient(135deg, #4EDEA3, #10B981)` via `.btn-gradient`
- Text: `on-primary` (`#003824`), `font-label`, medium weight
- Border radius: `rounded-lg` (0.5rem)
- One per page region — do not scatter gradient buttons

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

Common variants:
| Status | Background | Text |
|---|---|---|
| Paid / Active | `primary-container/20` | `primary` |
| Overdue | `tertiary-container/20` | `tertiary-container` |
| Draft | `surface-container-highest` | `on-surface-variant` |
| Pending | `secondary-container` | `secondary` |

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
- Keep the emerald primary as the _only_ saturated colour anchor on a dark screen
- Reserve the gradient CTA for the single most important action

### Don't

- Use **opaque borders** for layout separation — tonal shifts only
- Use **standard blue** (`#0070F3`, etc.) for any interactive element — the emerald primary owns that role
- Add a **light mode** — the warm dark palette is the brand, not a preference
- **Crowd the sidebar** — empty space in navigation communicates calm confidence
- Use `#FFFFFF` text — always use `on-surface` (`#E5E2E1`) for warmth

---

## Dark-Only

There is no light mode. The warm dark palette is not a theme toggle — it is the brand identity. Do not add light mode variables, do not configure `darkMode: "class"` to toggle, do not add a theme switcher component.

The `darkMode: "class"` in `tailwind.config.ts` is present for shadcn compatibility only. The `dark` class is permanently applied to `<html>`.
