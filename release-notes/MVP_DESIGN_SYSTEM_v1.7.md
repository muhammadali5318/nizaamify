# MVP UI Revamp — v1.7 (Design System)

**Audience:** Claude Code
**Companion to:** `PRD.md` (v1.2 baseline) and the v1.3–v1.6 fix specs.
**Stack:** unchanged — React + Vite + TypeScript + Tailwind + react-i18next.

> **THIS IS A UI-ONLY CHANGE. DO NOT MODIFY ANY BUSINESS LOGIC, RPC CALLS, RUNTIME BEHAVIOR, ROUTES, DATA SHAPES, OR COMPONENT API CONTRACTS WITH THE REST OF THE APP.** Only visual presentation, structure of presentational markup, and the addition of a token layer. If you find yourself editing files in `src/lib/supabase.ts`, `src/features/*/api.ts`, mutation handlers, or any RPC wrapper — **stop**. That's not in scope.

---

## 0. How to work this ticket

### Phase A — Discovery (read before writing code)

1. **Skills setup — this is the first action of the ticket.**
   - Check whether the `frontend-design` skill is available (it's in `/mnt/skills/public/frontend-design/SKILL.md` as a built-in for Claude Code in this environment). Read it. It's heavily aesthetic-direction-focused — useful for inspiration but not prescriptive for a business app. We're after *refined-minimal*, not *maximalist*.
   - Check whether `ui-ux-pro-max` is installed. If a `.skills/` directory exists and lists it, read its SKILL.md. If not, install it:
     ```bash
     npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max
     ```
     If the install fails (network / repo gone / package mismatch), proceed without it and note the failure in the discovery report. Do not block the rest of the work on it.
   - Also install the official frontend skill if not already on the path:
     ```bash
     npx skills add https://github.com/anthropics/skills --skill frontend-design
     ```
     Same fallback rule: if it fails, proceed.
   - Read both skills' guidance before designing tokens.
2. **Inspect the current codebase:**
   - `tailwind.config.{ts,js}` — current theme, fonts, colors, spacing.
   - `index.html` — current font preconnect / link tags, the Urdu Noto Nastaliq link the user flagged.
   - `src/lib/i18n.ts` and `src/locales/ur/*` — current Urdu strings, RTL setup.
   - `src/components/ui/*` — current primitives (if shadcn/ui is installed, work with it; if not, propose adding it in the discovery report).
   - `src/components/layout/*` — AppShell, TopBar, Sidebar.
   - Pick **5 representative screens** to screenshot before/after — at minimum: Login, Dashboard, `/pos`, `/products`, `/customers/:id`. Document what's broken visually (small fonts, low contrast, dense tables, etc.) and what you'll fix.
3. **Audit the problem screens explicitly:**
   - Find every `<table>` and table-like list. Note any text smaller than 14px, padding under 12px vertical, or rows without hover/active states.
   - Find every form. Note fields without labels, error states without color + icon + text, or submit buttons that don't change state during pending mutations.
   - Find every card / surface. Note flat backgrounds with no separation from page background, missing focus states on interactive elements.
   - Find every place hardcoded color hex/rgb appears (`grep -r "#" src/ | grep -E "#[0-9a-fA-F]{3,8}"`). These are token migration targets.
4. **Discovery report in chat** before any code:
   - Skills install status.
   - Whether shadcn/ui (or a similar primitive lib) is in the project, or you need to add it.
   - Top 10 visual issues across the 5 representative screens, ranked by user pain.
   - Migration plan in screen order.
   - Then proceed.

### Phase B — Foundations (tokens first)

CSS variables, Tailwind theme extension, font loading. Nothing visual yet — tokens land *invisibly*, then components consume them. See §3–§7.

### Phase C — Component primitives

Build / refine the design-system primitives (Button, Input, Card, Table, etc.) in `src/components/ui/`. These must be **drop-in replacements** for whatever's there now — same component names, same prop signatures wherever possible. See §8–§10.

### Phase D — Migration screen by screen

Apply the new components to existing screens. **Each screen migration must be independently mergeable.** No screen migration may change data flow, query keys, route structure, or RPC signatures.

### Phase E — Verification

Visual smoke test. RTL audit. Accessibility audit (focus, contrast, screen reader). Confirm zero functional regressions: every flow from `PRD.md` §6 still works end-to-end.

---

## 1. Design philosophy

The product is for **small shop owners doing daily transactions** — POS, khata, stock-in. The design must be:

- **Calm, not exciting.** A cashier looks at this for 8 hours a day. Avoid loud gradients, dense decoration, animation-as-flair. Aesthetic peers: Linear, Notion, Stripe Dashboard, Things 3 — clean, confident, restrained.
- **Trustworthy.** This handles money. Information density is okay; visual chaos is not.
- **Built for one hand on a phone or a fast keyboard on desktop.** Cashiers are mid-transaction; nothing should require precision.
- **Bilingual-first.** Every layout must work in English (LTR) and Urdu (RTL). No screen designed for one and "translated" to the other.

The mint→teal→navy palette gives us a quietly distinctive identity without needing to be loud. Lean into that. **Do not** add decorative gradients, noise textures, or animated backgrounds — those clash with the trust-and-money tone. Save bold flourishes for landing pages or marketing surfaces (which we don't have yet).

---

## 2. Color tokens

The user supplied four anchor colors. We expand these into a complete system. **All shipping code consumes semantic tokens, not raw hex** — that way dark mode (future) and brand tweaks don't require global find-and-replace.

### 2.1 Brand scale (mint → teal → navy)

A single continuous scale that traverses the user's four anchors. The named anchors below stay exactly as the user provided them; intermediate stops are interpolated.

| Token | Hex | Use |
|---|---|---|
| `brand-50`  | `#F0FDF4` | Page tint, lightest surface |
| `brand-100` | `#DCFCE7` | Hover surface, very light fill |
| `brand-200` | `#AAFFC7` | **(user)** Highlight pills, success-tint backgrounds |
| `brand-300` | `#86E0A4` | Decorative accent, focus ring (light variant) |
| `brand-400` | `#67C090` | **(user)** Brand accent, secondary CTA, active tabs |
| `brand-500` | `#4A9D88` | Mid-tone, used sparingly |
| `brand-600` | `#357B7E` | Hover state for primary surfaces |
| `brand-700` | `#215B63` | **(user)** **Primary CTA**, focus ring (default), key text-on-light |
| `brand-800` | `#184E68` | Hover state for primary CTA |
| `brand-900` | `#124170` | **(user)** Heading text, sidebar/topbar surface |
| `brand-950` | `#0A2A4A` | Pressed/active state, deep emphasis |

> **Why `brand-700` is the primary CTA, not `brand-400` (mint).** White on `brand-400` (#67C090) is ~3.5:1 contrast — below WCAG AA for normal text. White on `brand-700` (#215B63) is ~9.5:1 — passes AAA. The mint stays as an accent / secondary signal, not a CTA fill.

### 2.2 Neutral scale (slightly cool)

Tinted ~3% toward teal so it sits next to the brand scale without feeling alien. Standard 50–950.

| Token | Hex | Use |
|---|---|---|
| `neutral-0`   | `#FFFFFF` | Surface base |
| `neutral-50`  | `#F8FAFA` | Page background |
| `neutral-100` | `#F1F4F4` | Subtle dividers, hover on rows |
| `neutral-200` | `#E2E7E8` | Borders default |
| `neutral-300` | `#CBD2D4` | Borders strong, disabled fill |
| `neutral-400` | `#9AA4A8` | Placeholder, muted icons |
| `neutral-500` | `#6B7679` | Muted text, secondary labels |
| `neutral-600` | `#4D5659` | Body text on light surfaces |
| `neutral-700` | `#363D40` | Strong body text |
| `neutral-800` | `#23282A` | Heading on light surfaces |
| `neutral-900` | `#13171A` | Highest emphasis text |

### 2.3 Semantic scales

| Family | 50 | 100 | 500 (base) | 600 | 700 | Use |
|---|---|---|---|---|---|---|
| `success` | `#F0FDF4` | `#DCFCE7` | `#16A34A` | `#15803D` | `#166534` | Confirmations, paid status, healthy stock |
| `warning` | `#FFFBEB` | `#FEF3C7` | `#F59E0B` | `#D97706` | `#B45309` | Trial expiring, low stock, "below avg cost" |
| `error`   | `#FEF2F2` | `#FEE2E2` | `#DC2626` | `#B91C1C` | `#991B1B` | Validation, destructive actions, expired |
| `info`    | `#EFF6FF` | `#DBEAFE` | `#2563EB` | `#1D4ED8` | `#1E40AF` | Informational banners, links |

### 2.4 Semantic surface & text tokens

These are what components consume. **Never reference brand/neutral scales directly inside a component — always go through these.**

```css
/* In src/styles/tokens.css */
:root {
  /* Surfaces */
  --surface-base:        var(--neutral-0);    /* Card / dialog / modal background */
  --surface-subtle:      var(--neutral-50);   /* Page background */
  --surface-muted:       var(--neutral-100);  /* Hovered row, secondary panel */
  --surface-emphasis:    var(--brand-50);     /* Subtly branded section */
  --surface-inverse:     var(--brand-900);    /* TopBar, Sidebar, dark header */

  /* Text */
  --text-primary:        var(--neutral-900);  /* Headings, primary copy */
  --text-secondary:      var(--neutral-700);  /* Body */
  --text-muted:          var(--neutral-500);  /* Sublabels, captions */
  --text-disabled:       var(--neutral-400);
  --text-inverse:        var(--neutral-0);    /* On surface-inverse */
  --text-brand:          var(--brand-700);    /* Branded links / emphasis */

  /* Borders */
  --border-subtle:       var(--neutral-100);
  --border-default:      var(--neutral-200);
  --border-strong:       var(--neutral-300);
  --border-brand:        var(--brand-700);
  --border-focus:        var(--brand-700);

  /* Interactive */
  --action-primary:      var(--brand-700);
  --action-primary-hover:var(--brand-800);
  --action-primary-press:var(--brand-950);
  --action-primary-text: var(--neutral-0);

  --action-secondary:    var(--neutral-0);
  --action-secondary-hover: var(--neutral-50);
  --action-secondary-border: var(--neutral-300);
  --action-secondary-text: var(--text-primary);

  --action-accent:       var(--brand-400);    /* Mint, used sparingly */
  --action-accent-hover: var(--brand-500);
  --action-accent-text:  var(--brand-900);    /* dark text on mint = AAA */

  --action-destructive:       var(--error-600);
  --action-destructive-hover: var(--error-700);
  --action-destructive-text:  var(--neutral-0);

  /* Status fills (badges/pills/banners) */
  --status-success-bg:   var(--success-100);
  --status-success-text: var(--success-700);
  --status-warning-bg:   var(--warning-100);
  --status-warning-text: var(--warning-700);
  --status-error-bg:     var(--error-100);
  --status-error-text:   var(--error-700);
  --status-info-bg:      var(--info-100);
  --status-info-text:    var(--info-700);
  --status-brand-bg:     var(--brand-100);
  --status-brand-text:   var(--brand-800);

  /* Focus ring */
  --focus-ring: 0 0 0 3px color-mix(in srgb, var(--brand-700) 40%, transparent);
}
```

Wire these into `tailwind.config.ts` so they're usable as `bg-surface-base`, `text-text-primary`, etc. Pattern:
```ts
theme: {
  extend: {
    colors: {
      surface: {
        base: 'var(--surface-base)',
        subtle: 'var(--surface-subtle)',
        muted: 'var(--surface-muted)',
        emphasis: 'var(--surface-emphasis)',
        inverse: 'var(--surface-inverse)',
      },
      text: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        disabled: 'var(--text-disabled)',
        inverse: 'var(--text-inverse)',
        brand: 'var(--text-brand)',
      },
      // ... rest of semantic tokens
      // Plus the raw scales for rare cases:
      brand: { 50: '#F0FDF4', /* ... */ 950: '#0A2A4A' },
      neutral: { /* ... */ },
      success: { /* ... */ },
      warning: { /* ... */ },
      error: { /* ... */ },
      info: { /* ... */ },
    },
  },
}
```

### 2.5 Contrast verification (do this, don't skip it)

Run a contrast check on every semantic combination before shipping. The brand-700-on-white and white-on-brand-700 pair must hit ≥ 4.5:1 (WCAG AA for normal text). I've checked the anchors; verify the interpolated stops too. Tools: WebAIM contrast checker, or the `chroma-js` library.

---

## 3. Typography

### 3.1 Fix the Urdu font (user-flagged readability issue)

Replace the current Noto Nastaliq Urdu single-font setup. **Nastaliq is beautiful but unreadable at small sizes** — it relies on calligraphic flourishes that get lost below ~22px. For a UI with tables, forms, and 14px body, we need a Naskh/sans font that retains glyph clarity at small sizes.

**New font strategy:**

| Use | Font | Why |
|---|---|---|
| Urdu UI body / tables / forms | **Noto Naskh Arabic** | Highest readability for Arabic-script text at small sizes. Supports the extended Urdu character set. |
| Urdu UI headings (optional flourish) | **Noto Nastaliq Urdu** at ≥ 24px only | Keeps a touch of cultural identity for page titles without sacrificing readability where it matters. |
| English UI | **Inter** (variable) | Industry standard for screen UI, exceptional readability, excellent variable font support. |

> **On the frontend-design skill's guidance to "avoid generic fonts like Inter":** that advice fits marketing/landing surfaces where personality matters. For a business app where readability and cashier speed dominate, Inter is the correct call. We're optimizing for *zero misreads at 14px in a noisy shop*, not aesthetic distinctiveness. Note this deviation in your discovery report so the user agrees.

Replace the `<link>` in `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@500;700&display=swap"
  rel="stylesheet"
/>
```

CSS / Tailwind config:

```css
:root {
  --font-sans-en: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-sans-ur: 'Noto Naskh Arabic', 'Noto Sans Arabic', system-ui, sans-serif;
  --font-display-ur: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', system-ui, sans-serif;
}

html { font-family: var(--font-sans-en); }
html[lang="ur"] { font-family: var(--font-sans-ur); }
html[lang="ur"] h1,
html[lang="ur"] h2,
html[lang="ur"] .display { font-family: var(--font-display-ur); }
```

```ts
// tailwind.config.ts
fontFamily: {
  sans: ['var(--font-sans-en)'],
  'sans-ur': ['var(--font-sans-ur)'],
  display: ['var(--font-display-ur)'],
}
```

The `lang="ur"` selector is set by the i18n init code from PRD §8 — confirm that's still the case during discovery.

> **Honest caveat on Nastaliq for headings:** even at 24px+, Nastaliq is denser than Naskh. If after rollout the user finds it still too "fancy", drop it entirely and use Noto Naskh Arabic for *all* Urdu text. Don't get attached to the cultural-flavor heading idea over the legibility goal.

### 3.2 Type scale

Single scale shared by both languages. Urdu glyphs at the same px size *appear* slightly larger than Latin — that's fine, leave it. Don't try to match optical size with separate scales; you'll just create maintenance pain.

| Token | Size | Line-height | Weight | Use |
|---|---|---|---|---|
| `text-display-lg` | 32px / 2rem | 1.2 | 600 | Hero / empty-state headlines |
| `text-display`    | 28px / 1.75rem | 1.25 | 600 | Page titles |
| `text-h1`         | 24px / 1.5rem | 1.3 | 600 | Section headings |
| `text-h2`         | 20px / 1.25rem | 1.35 | 600 | Sub-sections |
| `text-h3`         | 18px / 1.125rem | 1.4 | 600 | Card titles |
| `text-body-lg`    | 16px / 1rem | 1.5 | 400 | Form inputs, primary body |
| `text-body`       | 15px / 0.9375rem | 1.5 | 400 | **Default body** (incl. tables) |
| `text-body-sm`    | 14px / 0.875rem | 1.5 | 400 | Secondary body |
| `text-caption`    | 13px / 0.8125rem | 1.4 | 500 | Labels, captions, badges |
| `text-overline`   | 12px / 0.75rem | 1.3 | 600 (uppercase, letter-spacing 0.04em) | Section labels |

**Rule:** body and table text default to **15px**, never below 14px. The user's "fonts are too small in tables" issue means somewhere in the codebase a 12px or 13px is being used for table cells. Find those (`grep -r "text-xs\|text-\[12\|text-\[13" src/`) and bump them.

Ban `text-xs` (Tailwind default 12px) from anywhere except badges/chips and corner micro-labels. Body text is never `text-xs`.

### 3.3 Reading width

Long text blocks (descriptions, banner copy, settings explanations) should cap at ~65 characters / `max-w-prose` in Tailwind. Avoid edge-to-edge paragraphs.

---

## 4. Spacing, radii, shadows, motion

### 4.1 Spacing scale

Stick with Tailwind's default 4px-grid scale. **Don't customize.** Document the conventions:

| Use | Tailwind | Pixels |
|---|---|---|
| Tight (icon to text) | `gap-1.5`, `p-1.5` | 6px |
| Default control padding | `px-3 py-2` | 12px / 8px |
| Form field internal padding | `px-3.5 py-2.5` | 14px / 10px |
| Card padding (mobile) | `p-4` | 16px |
| Card padding (desktop) | `p-6` | 24px |
| Section gap | `gap-6`, `space-y-6` | 24px |
| Page gutter (mobile) | `px-4` | 16px |
| Page gutter (desktop) | `px-8` | 32px |

### 4.2 Border radii

Soft, friendly, not playful.

```ts
borderRadius: {
  none: '0',
  sm: '4px',         // tags, chips
  DEFAULT: '8px',    // inputs, buttons, small cards
  md: '10px',        // medium cards, dropdowns
  lg: '12px',        // page-level cards, modals
  xl: '16px',        // hero cards
  full: '9999px',    // pills, avatars
}
```

### 4.3 Shadows

Subtle. Layered with low opacity. **Never use stark black shadows.**

```css
:root {
  --shadow-xs: 0 1px 2px 0 rgba(15, 23, 42, 0.04);
  --shadow-sm: 0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 6px 12px -3px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04);
  --shadow-lg: 0 12px 24px -6px rgba(15, 23, 42, 0.10), 0 4px 8px -4px rgba(15, 23, 42, 0.06);
  --shadow-xl: 0 24px 48px -12px rgba(15, 23, 42, 0.18);

  /* Tinted brand shadow for primary CTA on hover */
  --shadow-brand: 0 8px 20px -8px color-mix(in srgb, var(--brand-700) 40%, transparent);
}
```

Use:
- `shadow-xs` — pressed-down chips
- `shadow-sm` — cards on a colored page
- `shadow-md` — dropdowns, hovering elements
- `shadow-lg` — modals
- `shadow-xl` — full-screen sheets

### 4.4 Motion

Calm and purposeful. **Never animate on scroll.** Animate transitions, hovers, and state changes.

```ts
transitionTimingFunction: {
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',          // default — eases out
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',        // for two-way state
}
transitionDuration: {
  fast: '120ms',     // hovers, small state changes
  base: '200ms',     // default
  slow: '320ms',     // dialog open, drawer
}
```

Respect `prefers-reduced-motion`: wrap any non-essential animation in:
```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## 5. Layout primitives

### 5.1 Page shell

Existing AppShell stays — only restyle, don't restructure. Apply:

- TopBar: `bg-surface-inverse text-text-inverse`, height 56px (mobile) / 64px (desktop), logo on the leading edge, language selector + user menu on the trailing edge.
- Sidebar: 240px wide on desktop, slide-over drawer on mobile, `bg-surface-base` with `border-default` on the trailing edge. Active route gets `bg-status-brand-bg text-status-brand-text` and a 3px leading-edge accent bar in `brand-700`.
- Main: max-width per page (see §5.2), centered, page gutters.

### 5.2 Page max-widths

| Page kind | Max width | Why |
|---|---|---|
| Lists with table | `max-w-7xl` (1280px) | Tables breathe |
| Forms / settings | `max-w-2xl` (672px) | Long form lines fatigue eyes |
| Detail views | `max-w-5xl` (1024px) | Header + body comfortable |
| POS | full width | Two-pane needs space |
| Dashboard | `max-w-7xl` | Mixed widgets |

### 5.3 Breakpoints

Tailwind defaults are correct. Document them:

| Token | Min width | Notes |
|---|---|---|
| `sm` | 640px | Large phones landscape, small tablets |
| `md` | 768px | Tablets portrait |
| `lg` | 1024px | Tablets landscape, small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large desktops |

Mobile-first: write base styles for mobile, then add `md:`/`lg:` overrides upward. Most cashier interactions happen on tablets; design for `md` first if you have to pick a primary.

---

## 6. Component primitives (`src/components/ui/`)

If shadcn/ui is already in the project, refine it with the new tokens. If not, **add it now** as the foundation:
```bash
npx shadcn-ui@latest init
```
shadcn/ui gives accessible, unstyled-by-default Radix primitives that we then theme with our tokens. Don't reinvent these.

Required components (build / refine each):

| Component | Notes |
|---|---|
| `Button` | Variants: `primary` / `secondary` / `accent` / `ghost` / `destructive` / `link`. Sizes: `sm` (32px h) / `md` (40px h, default) / `lg` (44px h, primary CTA). Always shows pending state with spinner + disable. Min touch target 40×40 mobile. |
| `Input` | Variants: `default` / `error` / `success`. Sizes: `md` (40px) / `lg` (44px, mobile/forms). Always paired with Label. Built-in clear button for searches. |
| `Textarea` | Auto-resize up to 8 rows. |
| `Select` (Radix) | Replaces native `<select>` everywhere. |
| `Combobox` | Used for customer picker (v1.4) and product type autocomplete (v1.5). Searchable, debounced. |
| `Checkbox` / `Radio` / `Switch` | Standard, with proper hit areas. |
| `Card` | Variants: `default` (white surface, subtle border) / `muted` (subtle bg) / `elevated` (with shadow-md). |
| `Badge` | Variants per status semantic + brand. Compact, 22px height, `text-caption`. |
| `Banner` | Used by v1.2's DashboardBanner. Variants: info/warning/error/brand. Dismissible variants (info only). |
| `Dialog` (Radix) | Modals. On mobile, use `Drawer` (bottom sheet) instead — see §7.2. |
| `Toast` | Top-right on desktop, top-center mobile. Auto-dismiss 5s; error toasts 8s with explicit dismiss. |
| `Table` | The big one — see §7.1. |
| `Tabs` | Standard. Active tab uses `brand-700` underline. |
| `Tooltip` | For icon-only buttons and abbreviations. 200ms delay. |
| `Pagination` | For all paginated lists. |
| `EmptyState` | Icon + title + description + optional CTA. Used everywhere a list might be empty. |
| `Skeleton` | Loading placeholders shaped like the final content. |
| `Spinner` | Single sized variant for inline (16px) and one for full-page (32px). Brand color. |
| `Field` | Wrapper combining Label + Input + HintText + ErrorText. Universal form atom. |

Each of these has props *familiar to shadcn/ui*. Don't invent novel APIs. Don't change existing app-side imports — when migrating, the old `<Button>` import should still work after the visual revamp.

---

## 7. The two screens you'll spend the most time on

### 7.1 Tables (user-flagged: "fonts are too small")

Build a single `<DataTable>` primitive used everywhere a table appears today (Products, Sales, Customers, Purchases, Expenses, etc.). The user's pain is real — small text in dense rows on dense screens is the #1 readability issue.

**Visual rules:**

- **Body cell text: 15px (`text-body`).** Not 13. Not 14. Period.
- **Row height: 56px on desktop, 64px on mobile.** Generous vertical padding (`py-4` on desktop, `py-5` on mobile).
- **Header row:** 48px tall, `text-overline` (12px uppercase semibold), `text-text-muted` color, `bg-surface-subtle`. Top + bottom border. Sticky on scroll for tall lists.
- **Row dividers** (subtle), no zebra stripes. `border-b border-border-subtle`.
- **Hover state:** `bg-surface-muted`. Cursor `pointer` only when row is clickable.
- **Active/selected row:** `bg-status-brand-bg`, leading-edge 3px `brand-700` bar.
- **Number columns:** right-aligned (LTR) / leading-aligned (RTL handled by logical properties — `text-end`).
- **Action cells:** primary action visible inline; secondary actions in an overflow menu (kebab `…`).
- **Loading state:** show skeleton rows, not a centered spinner. Same height as real rows so the layout doesn't jump.
- **Empty state:** centered `<EmptyState>`, never a blank `<tbody>`.

**Mobile rules:** below `md`, render the same data as **stacked cards** (one per row), not a horizontal-scrolling table. Each card has the primary identifier as the heading, two-column key-value pairs for the rest, and the action set as a button row at the bottom. Use `<DataTable>`'s `mobileVariant="cards"` prop to switch automatically — don't fork the component.

**Pagination:** at the foot of the table (or below the card list on mobile). Show `Showing N–M of T`, prev/next buttons, page-jump on desktop only.

**Sorting:** column headers with sort affordance show a chevron icon. Active sort shows the chevron filled. Sort happens server-side (re-fetch with the sort key) — do not sort in the client when paginating server-side.

### 7.2 POS / cart

This is the most-used screen. Apply v1.5's spec strictly, with the new tokens. Specifically:

- The product table on the left uses `<DataTable>` with the `+` button as the leading action column.
- The `+` button is the `accent` button variant (mint), 40×40 round, with a `+` icon. Hover → `brand-500`. Pressed → satisfying short scale-down (98%) for tactile feedback.
- The cart on the right uses `<Card variant="elevated">` containing a list of cart lines and the totals block.
- Cart line: 64px tall, divider between lines. Round qty stepper buttons (40×40), large qty number (`text-h3` weight 600), unit-price chip (clickable, opens inline edit), line-total at the trailing edge in `text-h3`.
- "Subtotal (products)" → "Service charge" → divider → "Total" (in `text-h2`, `text-text-primary`). Then "Amount paid" / "On credit" / customer / notes / submit.
- Submit button: `lg` size, full width, primary variant, with the dynamic label from v1.4. Disabled state shows reason inline above ("Add a customer for credit sales").

**Mobile POS:** product table on top, scrollable; cart pinned to the bottom as a `Drawer` that opens to full screen on tap. Drawer-collapsed state shows a 64px bar with item count + total + "View cart" pill on the leading edge.

---

## 8. Forms

A form is a `<form>` with `<Field>` children plus a submit button. No exceptions.

**Field rules:**
- **Label always visible.** No floating labels (they fail in RTL and on iOS autofill).
- **Hint text below the input** — neutral-500, `text-caption`.
- **Error text replaces hint** when invalid — `error-700`, with leading icon. The input gets `border-error-500`.
- **Required asterisk** in `error-500`, after the label text in LTR / before in RTL (handled by logical properties).
- **Inputs are 44px tall on mobile / 40px desktop**, never smaller. Touch-target safe.
- **Number inputs** never increment by decimal (v1.5). Use the custom stepper for cart qty; for general number fields use a plain text input with `inputmode="numeric"` and validate on blur.
- **Submit button** is bottom-right (LTR) / bottom-left (RTL), with a `Cancel` ghost button to its leading edge. On mobile, both buttons are full-width stacked, primary on top.
- **Pending mutation:** submit button shows spinner inside, disabled, label changes to "Saving…" (via i18n).
- **Success:** form closes / navigates / shows toast — never just a silent green checkmark with the form still open.

---

## 9. Mobile design specifics

- **Touch targets ≥ 40×40 (Tailwind `h-10 w-10`); 44×44 for primary actions.**
- **Tap, don't hover.** Anywhere that uses `:hover` for revealing info, also expose it on tap (Tooltip → Popover for mobile).
- **Bottom-sheet drawers > centered modals.** Modals on small viewports cover content awkwardly.
- **Sticky bottom action bars** for forms with a single primary action ("Save customer", "Complete sale"). Don't bury the CTA above the keyboard.
- **No horizontal scroll** anywhere. Test at 360px viewport (smallest realistic Android).
- **Avoid `position: fixed` overlays that block scroll** during keyboard open. Use `inset: env(safe-area-inset-*)` for iOS notch.

---

## 10. RTL (Urdu) — make it real

The PRD says Urdu is fully supported, but visual RTL bugs are common. The revamp is the right time to harden this.

- **Logical properties everywhere.** Replace any `ml-*` / `mr-*` / `pl-*` / `pr-*` / `left-*` / `right-*` with `ms-*` / `me-*` / `ps-*` / `pe-*` / `start-*` / `end-*`.
- **Mirror directional icons** (chevrons, arrows, "back") in RTL. Don't mirror non-directional icons (search, settings, plus).
- **Number formatting:** `Intl.NumberFormat('ur-PK', { style: 'currency', currency: 'PKR' })` for currency. Verify Urdu numerals render — if the product is targeted at Pakistani shopkeepers, they may actually prefer Western numerals (1, 2, 3) over Urdu numerals (۱, ۲, ۳). Discovery should ask the user; default to Urdu numerals if no answer.
- **Test every screen in RTL** by setting `<html lang="ur" dir="rtl">` manually before declaring a screen done.
- **Calendar / date pickers** must respect RTL — week-start, month navigation arrows.
- **Form errors / icons** must appear on the side appropriate to the language.

---

## 11. Accessibility (non-negotiable)

- **Color contrast WCAG AA minimum** for all text. Run an axe-core scan once components are migrated.
- **Focus-visible ring on all interactive elements:** 3px `brand-700` ring with 40% alpha, offset 2px from element. Use the `--focus-ring` token.
- **Tab order** must be logical. Skip links to main content from the TopBar.
- **Screen reader labels** on icon-only buttons (`aria-label`). Translate via i18n.
- **Form errors** announced via `aria-describedby` and `role="alert"` on the error text.
- **Don't use color alone** to convey state. Always pair with text or icon.
- **Live regions** for toasts (`role="status"` for info / `role="alert"` for error).
- **Keyboard nav** for combobox, table sort, modal open/close (Esc closes), drawer.

---

## 12. Migration strategy

**Each screen migration is one PR-shaped change.** No "rewrite everything" big bang. Order:

1. **Tokens + Tailwind config.** No visible change yet (raw values are unchanged at the user's current screens because nothing uses tokens yet). This makes everything else additive.
2. **Font swap** in `index.html` + `lang`-scoped CSS. Now Urdu screens look better immediately, even before any other work.
3. **`<DataTable>` primitive.** Built standalone with stories / examples in `src/components/ui/DataTable.dev.tsx`. Verify it works on all four breakpoints with mock data before wiring to real screens.
4. **Other primitives** (Button, Input, Card, Field, Badge, Banner, EmptyState). Land them in `ui/` without using them yet.
5. **TopBar / Sidebar / AppShell.** Touches every screen but the visual change is bounded.
6. **Tables in priority order** — wire `<DataTable>` to:
   - `/products`
   - `/sales`
   - `/customers` (khata list)
   - `/purchases`
   - `/expenses`
7. **POS** — full redesign per §7.2.
8. **Forms in priority order** — Auth (Login, Signup), Onboarding, Customer create/edit, Product create/edit, Receive payment.
9. **Detail screens** — Sale detail, Customer detail (khata), Purchase detail.
10. **Dashboard / Reports / Settings / Subscription pages.**

Between each step, the app must be **deployable and functional**. No half-migrated screens shipped.

**Hard rules during migration:**
- **No new RPC calls, no removed RPC calls, no changed RPC signatures.** If you find yourself touching `supabase.rpc(...)`, stop and back out.
- **No new query keys.** React Query keys stay identical so cache behavior is unchanged.
- **No removed routes, no new routes.** (Adding new screens is out of scope; this is a revamp.)
- **No removed text, no new text.** All copy goes through existing i18n keys; only swap component shells.
- **If a current bug is uncovered during migration, file it as v1.8 — do not fix it in this PR.**

---

## 13. File structure

```
src/
├── styles/
│   ├── tokens.css            # CSS variables (§2.4)
│   ├── globals.css           # base resets, body font wiring
│   └── animations.css        # @keyframes if needed
├── components/
│   ├── ui/                   # Primitives — the design system
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Field.tsx
│   │   ├── Card.tsx
│   │   ├── DataTable.tsx
│   │   ├── Badge.tsx
│   │   ├── Banner.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Dialog.tsx
│   │   ├── Drawer.tsx        # mobile bottom sheet
│   │   ├── Toast.tsx
│   │   ├── Combobox.tsx
│   │   ├── Pagination.tsx
│   │   └── ...
│   └── layout/
│       ├── AppShell.tsx
│       ├── TopBar.tsx
│       ├── Sidebar.tsx
│       └── PageHeader.tsx    # Reusable page-title + actions strip
└── ...
```

Component stories or dev pages (e.g. `Button.dev.tsx` rendered at `/_dev/buttons`) help verify primitives in isolation. Optional but recommended.

---

## 14. Out of scope for this round

- **Dark mode.** Tokens are designed to support it later; we're not implementing it now. (To add later: define `:root[data-theme="dark"]` overrides for the surface/text tokens. The components don't change.)
- **New features, new screens, new flows.** This is purely revamp.
- **Bug fixes** uncovered during migration — file as v1.8.
- **Marketing surfaces** (landing page, public pricing). Different brief.
- **Animations / micro-interactions** beyond standard hover / focus / state transitions. No page-load chorales, no scroll-triggered reveals.
- **Custom illustrations.** Empty states use a single subtle icon (Lucide React) plus copy.
- **Internationalizing content beyond what's already there.** Don't add new languages.
- **Test infrastructure.** Still skipped per user instruction.

---

## 15. Implementation order (precise)

1. **Discovery report** in chat (§Phase A). Skills install status, shadcn/ui status, top 10 issues, screen migration plan.
2. **Phase B foundations:**
   - Add `src/styles/tokens.css` with all CSS variables.
   - Update `tailwind.config.ts` with the token-mapped theme + raw scales.
   - Update `index.html` with the new font links.
   - Add `:root` font-family wiring + `lang="ur"` overrides.
   - Run app — verify nothing visually broke. (At this point Urdu fonts should already look better.)
3. **Phase C primitives:**
   - shadcn/ui init if not present.
   - Build / refine in this order: Button → Field/Input → Badge → Card → Banner → EmptyState → Skeleton → Pagination → DataTable → Dialog/Drawer → Toast → Combobox → Tabs → Tooltip.
   - Each primitive lands with a `*.dev.tsx` page (optional but encouraged) showing all variants.
4. **Phase D layout:** AppShell, TopBar, Sidebar, PageHeader.
5. **Phase D screens** in the order in §12.
6. **Phase E verification:**
   - Run every flow from PRD §6 acceptance criteria — the system must still pass them all.
   - axe-core scan, fix any AA failures.
   - RTL pass: every screen at `<html lang="ur" dir="rtl">` — log issues; fix on the spot if minor, file for v1.8 if structural.
   - 360px mobile viewport pass on POS, Dashboard, Sales list, Customer detail.
   - Lighthouse: aim ≥ 90 a11y, ≥ 80 perf.
7. **Report back** with: skills install outcome, before/after screenshots of the 5 representative screens from §A, what's covered, what's deferred, any pre-existing bugs surfaced.

---

## 16. Acceptance criteria

The revamp is done when **all** of the following hold:

- [ ] Skills install status documented; if either failed, the failure is reported and a fallback path was used.
- [ ] All color, surface, text, and status tokens are defined as CSS variables, exposed through Tailwind, and consumed by the components — no raw hex codes in component files (one or two unavoidable cases acceptable, all others rejected).
- [ ] Inter loaded for English; Noto Naskh Arabic loaded for Urdu UI; Noto Nastaliq Urdu loaded only for Urdu headings ≥ 24px (or removed entirely if the user opts out at discovery).
- [ ] Body / table text is 15px minimum across the app. No `text-xs` outside badges and micro-labels.
- [ ] `<DataTable>` is the single table primitive used by Products, Sales, Customers, Purchases, Expenses, and the POS picker. Mobile collapses to cards automatically.
- [ ] All forms use `<Field>` with visible labels, hint text, error states with icon + color + text.
- [ ] Buttons hit 40×40 minimum touch targets; primary CTAs hit 44×44 on mobile.
- [ ] All interactive elements have a visible focus ring using `--focus-ring`.
- [ ] All `ml/mr/pl/pr/left/right` utilities replaced with logical properties on every screen Claude touched.
- [ ] axe-core: zero AA contrast failures, zero "missing label" failures.
- [ ] **No RPC, route, query-key, or business-logic change anywhere in the diff.** Verified by reviewing the diff for any file under `src/lib/`, `src/features/*/api.ts`, or any `.rpc(` call site.
- [ ] All flows from `PRD.md` §6 / acceptance criteria still pass end-to-end.
- [ ] Both languages tested: every screen Claude touched works visually in `lang="en" dir="ltr"` and `lang="ur" dir="rtl"`.

---

*End of v1.7 design system spec.*
