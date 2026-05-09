# UI primitives — `src/components/ui/`

Design-system primitives for the v1.7 revamp. **Every screen consumes these instead of MUI primitives directly.**

## Conventions

- One primitive per file (e.g. `Button.tsx`); barrel re-export in `index.ts`.
- Every primitive is a **wrapper around MUI** (or a Radix-equivalent we already have, e.g. notistack for toasts). We do not invent novel APIs.
- Props extend the underlying MUI prop interface. Add only what the design system requires (extra `variant`, `size`, `loading`, etc.).
- **Token consumption only** — no raw hex codes in primitive files. Refer to `src/styles/tokens.css`. For values that don't fit MUI palette tokens, use `var(--*)` via `sx`.
- Logical properties only — `marginInlineStart` not `marginLeft`, `paddingInlineEnd` not `paddingRight`. Use MUI `sx` shortcut where it exists (`ms`, `me`, `ps`, `pe`).
- Min touch target 40 × 40; 44 × 44 for primary actions on mobile.
- `aria-*` attributes mandatory on icon-only buttons.

## Imports

```ts
import { Button, Card, DataTable } from 'src/components/ui'
```

Always import from the barrel — never reach into individual files. This lets us refactor internals without breaking callers.

## Adding a primitive

1. Create `src/components/ui/<Name>.tsx`.
2. Default-export the component **and** named-export the props type.
3. Add it to `src/components/ui/index.ts`.
4. If the primitive needs typography variants beyond the spec scale, extend the MUI theme in `src/theme/muiTheme.ts` instead of inlining font sizes.
