# Recipe Book App — Frontend

Vite · React · TypeScript · TanStack Router · TanStack Query · Tailwind CSS v4 · shadcn/ui · better-auth · vite-plugin-pwa

> **This is a living document.** Updated as the build progresses — architecture, routing, design decisions, and page reference are recorded here.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Architecture](#3-architecture)
4. [Design System](#4-design-system)
5. [PWA](#5-pwa)
6. [Setup](#6-setup)
7. [Pages & Routes](#7-pages--routes)
8. [Design Decisions](#8-design-decisions)

---

## 1. Tech Stack

| Layer | Library | Purpose |
|---|---|---|
| Build | Vite | Dev server + bundler. HMR, TypeScript out of the box |
| UI | React 19 | Component model |
| Language | TypeScript | Type safety across the full stack |
| Routing | TanStack Router (file-based) | File-based routing, type-safe params, route guards |
| Server state | TanStack Query | API fetching, caching, mutation + cache invalidation |
| Styling | Tailwind CSS v4 | Utility-first CSS, no config file — all in `index.css` |
| Components | shadcn/ui | Accessible, pre-built components (Radix UI + Tailwind) |
| Forms | React Hook Form + Zod | Performant forms, shared Zod schemas with backend |
| Auth client | better-auth | Session management, sign-in/sign-up/sign-out hooks |
| Icons | lucide-react | Consistent icon set used across all components |
| PWA | vite-plugin-pwa | Web App Manifest + Workbox service worker |

---

## 2. Project Structure

```
client/
├── public/
│   ├── favicon.svg           # App icon (recipe book, dark bg, white lines)
│   └── icons/                # Additional icon sizes (future)
├── src/
│   ├── routes/               # TanStack Router — one file = one URL
│   │   ├── __root.tsx        # Root layout (providers, global chrome)
│   │   ├── index.tsx         # / — landing / auth gate
│   │   └── ...               # Built out as screens are added
│   ├── components/
│   │   ├── ui/               # shadcn/ui components (owned, not imported)
│   │   └── ...               # Feature-level components
│   ├── hooks/                # Custom hooks (useDebounce, useLocalStorage, etc.)
│   ├── lib/
│   │   ├── utils.ts          # cn() helper (clsx + tailwind-merge)
│   │   ├── api.ts            # Typed fetch wrapper around /api/*
│   │   └── auth.ts           # better-auth browser client
│   └── index.css             # Tailwind v4 import + full design token system
├── components.json           # shadcn/ui CLI config (run: npx shadcn add <component>)
├── vite.config.ts            # Vite config — plugins, path alias, API proxy, PWA manifest
├── tsconfig.app.json         # TypeScript config for src — paths, strict mode
└── index.html                # Shell — PWA meta tags, viewport, theme-color
```

### Path alias

`@/` resolves to `src/`. Example: `import { cn } from '@/lib/utils'`.

Configured in both `vite.config.ts` (runtime resolution) and `tsconfig.app.json` (TypeScript type resolution).

---

## 3. Architecture

### Request lifecycle

```
URL change
  → TanStack Router matches route file
  → Route component renders
  → useQuery() fires GET /api/...
  → TanStack Query checks cache
      hit  → renders cached data instantly, revalidates in background
      miss → shows loading state → fetches → caches → renders
  → User action (create / update / delete)
  → useMutation() fires POST/PATCH/DELETE /api/...
  → on success: invalidateQueries(['key']) → automatic re-fetch
```

### API communication

All API calls go through `/api/*`. In development, Vite proxies `/api/*` to `http://localhost:3000` — no CORS issues during dev. In production, the frontend and backend share the same origin (Netlify + Render are configured to forward `/api/*`).

The `src/lib/api.ts` wrapper handles:
- Attaching credentials (session cookie sent automatically)
- Consistent error parsing (response body → typed error object)
- TypeScript return types per endpoint

### Auth

better-auth runs on the backend (`/api/auth/*`). The browser client (`src/lib/auth.ts`) provides:

```typescript
authClient.useSession()          // { data: { user, session } | null, isPending }
authClient.signIn.email(...)     // sign in with email + password
authClient.signIn.social(...)    // Google OAuth redirect
authClient.signUp.email(...)     // register
authClient.signOut()             // clear session
```

The session cookie is `httpOnly`, set by the server. TanStack Router checks session state at the root layout to decide whether to render the app shell or redirect to the auth screen.

### Theme (light / dark)

The user's preference is stored on the `user.theme` column (`'light' | 'dark' | null`). On page load, `localStorage` is read first to apply the theme before the API response arrives — preventing a flash of the wrong theme. Once the session loads, the stored preference overrides `localStorage` if they differ, and the new value is written back.

---

## 4. Design System

### Tailwind v4

No `tailwind.config.ts`. Everything is declared in `src/index.css`:

```css
@import "tailwindcss";       /* Tailwind core */
@import "tw-animate-css";    /* Animation utilities (used by shadcn/ui) */
```

Custom design tokens are declared as CSS custom properties under `@theme inline { ... }` and referenced in `:root` (light) and `.dark` (dark). Tailwind generates utility classes from these tokens automatically.

### Color palette — warm stone

Both light and dark modes use warm stone (slightly warm grays) rather than pure neutral. This reads well in kitchen environments — warmer than blue-shifted screens.

| Token | Light | Dark |
|---|---|---|
| `background` | `oklch(0.99 0.003 80)` — near-white, faintly warm | `oklch(0.14 0.005 60)` — deep warm charcoal |
| `foreground` | `oklch(0.15 0.008 60)` — near-black, warm | `oklch(0.97 0.003 80)` — near-white |
| `primary` | `oklch(0.21 0.008 60)` — deep warm stone | `oklch(0.97 0.003 80)` — near-white (inverted) |
| `muted-foreground` | `oklch(0.52 0.01 60)` — mid stone | `oklch(0.65 0.008 60)` |
| `border` | `oklch(0.91 0.005 60)` — light warm gray | `oklch(1 0 0 / 10%)` — white at 10% opacity |
| `destructive` | `oklch(0.57 0.24 27)` — warm red | `oklch(0.70 0.19 22)` |

All colors use `oklch()` for perceptually uniform lightness steps and vivid, consistent chroma.

### Border radius

Base radius is `0.625rem`. Components scale from that: `--radius-sm` (−4 px), `--radius-md` (−2 px), `--radius-lg` (base), `--radius-xl` (+4 px).

### shadcn/ui components

Components are copied into `src/components/ui/` — you own the code. Add new ones with:

```bash
npx shadcn add button
npx shadcn add dialog
npx shadcn add form
# etc.
```

Components already added: _(none yet — added as needed)_

---

## 5. PWA

Configured via `vite-plugin-pwa` in `vite.config.ts`.

| Setting | Value |
|---|---|
| Register type | `autoUpdate` — new service worker activates silently on next load |
| Display | `standalone` — launches without browser chrome (full-screen app feel) |
| Orientation | `portrait` — locked to portrait on mobile |
| Theme color | `#1c1917` — deep warm stone, used for mobile status bar |
| Background color | `#fafaf9` — warm near-white for the splash screen |
| Start URL | `/` |
| Icon | `favicon.svg` — recipe book silhouette, dark background, white lines |

**Service worker** — Workbox `generateSW` mode. Precaches all JS, CSS, HTML, images, and fonts at build time. Subsequent loads are instant (no network needed for the shell).

**Installing on iOS / Android:**
- Android Chrome: "Add to Home Screen" banner appears automatically after criteria are met, or via the browser menu.
- iOS Safari: Share → "Add to Home Screen".

The `viewport-fit=cover` meta tag and `apple-mobile-web-app-status-bar-style: black-translucent` ensure the app fills edge-to-edge on notched iPhones.

---

## 6. Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local from the example
cp .env.example .env.local

# 3. Start the backend (from /server)
cd ../server && npm run dev

# 4. Start the frontend dev server
cd ../client && npm run dev
# → http://localhost:5173
# → /api/* proxied to http://localhost:3000
```

### Environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL for the backend (only needed for non-proxied environments). In dev, the Vite proxy handles this — leave unset. |

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server with HMR at `localhost:5173` |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |

---

## 7. Pages & Routes

TanStack Router uses file-based routing. Each file in `src/routes/` maps to a URL segment. The route tree is auto-generated into `src/routeTree.gen.ts` (git-ignored — regenerated on every `npm run dev`).

### Route conventions

| File | URL | Notes |
|---|---|---|
| `__root.tsx` | _(wraps all routes)_ | Global providers, layout shell, auth gate |
| `index.tsx` | `/` | Landing / redirect to dashboard if authenticated |
| `_auth/` | _(layout route)_ | Unauthenticated layout (centered card, no nav) |
| `_auth/sign-in.tsx` | `/sign-in` | |
| `_auth/sign-up.tsx` | `/sign-up` | |
| `_app/` | _(layout route)_ | Authenticated layout (nav, household context) |
| `_app/index.tsx` | `/` | Dashboard |
| `_app/recipes/` | `/recipes` | Recipe book |
| `_app/recipes/$id.tsx` | `/recipes/:id` | Recipe detail |
| `_app/pantry.tsx` | `/pantry` | Pantry |
| `_app/shopping-list.tsx` | `/shopping-list` | Shopping list |
| `_app/cook/$recipeId.tsx` | `/cook/:recipeId` | Cook session |
| `_app/can-make.tsx` | `/can-make` | "What can I make?" |
| `_app/household.tsx` | `/household` | Household management |
| `_app/notifications.tsx` | `/notifications` | Notification inbox |
| `_app/profile.tsx` | `/profile` | Own profile + edit |
| `$handle.tsx` | `/@:handle` | Public user profile |

> Prefixing a folder with `_` creates a **pathless layout route** — it provides a shared layout without adding a URL segment.

_Routes marked above are the planned structure. This table is updated as each screen is built._

---

## 8. Design Decisions

**Vite proxy for `/api/*`** — In development, `vite.config.ts` proxies all `/api/*` requests to `http://localhost:3000`. This means the frontend always calls `/api/...` relative to its own origin — no hardcoded backend URL, no CORS headers needed in dev. In production, the same pattern is replicated via Netlify redirect rules (`/api/* → https://api.recipebook.app/:splat`).

**TanStack Router over React Router** — File-based routing generates a fully type-safe route tree. Route params, search params, and loader data are all typed. No string-based navigation — `navigate({ to: '/recipes/$id', params: { id } })` is checked at compile time.

**TanStack Query for all server state** — Component-local `useState` + `useEffect` for data fetching is an anti-pattern (race conditions, no deduplication, no cache). TanStack Query handles caching, background revalidation, stale-while-revalidate, and mutation side effects cleanly. All backend data lives in Query's cache, keyed by resource identifier.

**shadcn/ui components are owned, not imported** — Running `npx shadcn add button` copies the component source into `src/components/ui/button.tsx`. This means every pixel is adjustable with no upstream dependency to manage. The trade-off is that updates to shadcn/ui require re-copying (rare; done when a fix is needed).

**Tailwind v4 — CSS-first configuration** — Tailwind v4 eliminated the JavaScript config file. All tokens (colors, radii, spacing) are CSS custom properties in `index.css` and referenced by Tailwind's `@theme inline` block. This makes the design system visible in one file and removes a build-time JavaScript step.

**`oklch()` color space** — All design tokens use `oklch()` rather than `hsl()` or hex. `oklch` has perceptually uniform lightness, so `oklch(0.5 0.15 X)` has the same perceived brightness regardless of hue. This makes the light/dark system coherent without manual per-color tweaks.

**React Hook Form + Zod — shared schema validation** — The same Zod schemas used by the backend (for input validation) are used on the frontend (for form validation). A recipe form and a recipe API route share the same ingredient schema. Changes to a field's constraints only need to be made once.

**Theme stored on `user.theme`, cached in `localStorage`** — The backend is the source of truth (`user.theme: 'light' | 'dark' | null`). On every page load, `localStorage` is read first so the correct theme is applied before the API call returns. Once the session loads, if the DB value differs from `localStorage`, `localStorage` is updated. `null` means follow the OS preference (`prefers-color-scheme`).

**PWA icons as SVG** — Modern Android and iOS support SVG icons in the web app manifest. Using a single `favicon.svg` with `sizes: "any"` avoids generating and maintaining multiple PNG sizes at this stage. If specific stores or platforms require PNG icons, they can be generated from the SVG source using `@vite-pwa/assets-generator` at deployment time.
