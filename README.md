# The Shared Pantry Experience — Frontend

Vite · React · TypeScript · TanStack Router · TanStack Query · Tailwind CSS v4 · shadcn/ui

---

## Purpose

Mobile-first progressive web app for The Shared Pantry Experience API. Designed primarily for phone use in the kitchen — installs to the home screen and runs app-like via PWA. A single responsive build covers mobile, tablet, and desktop.

---

## Tech Stack

| Library | Why |
|---|---|
| **Vite** | Fast dev server with HMR, TypeScript out of the box, and a clean plugin model for PWA and path aliasing. No bundler configuration overhead. |
| **React 19** | Industry-standard component model with a large ecosystem. Concurrent features available for future performance work. |
| **TypeScript** | End-to-end type safety. Zod schemas are shared with the backend, so form validation and API contracts stay in sync automatically. |
| **TanStack Router** | File-based routing that generates a fully type-safe route tree. Params, search params, and `navigate()` calls are all checked at compile time — no string-based navigation. |
| **TanStack Query** | All backend data lives in Query's cache. Handles fetching, background revalidation, and mutation side effects cleanly. Avoids the `useState + useEffect` data-fetching anti-pattern and its race conditions. |
| **Tailwind CSS v4** | Utility-first CSS with no config file — all design tokens are CSS custom properties in `index.css`. Works naturally with shadcn/ui and produces predictable, minimal output. |
| **shadcn/ui** | Radix UI primitives with Tailwind styling, copied into the repo rather than installed as a dependency. Fully accessible, fully owned — any component can be modified without forking an upstream package. |
| **React Hook Form + Zod** | Performant uncontrolled forms with schema validation. Sharing Zod schemas with the backend means validation rules only need to exist in one place. |
| **better-auth browser client** | Matches the backend's better-auth setup. Provides `useSession`, `signIn`, `signUp`, and `signOut` with cookie-based session management. |
| **vite-plugin-pwa** | Generates the web app manifest and a Workbox service worker at build time. Precaches the app shell for instant subsequent loads offline. |

---

## Features

The app has five main sections accessible via a persistent bottom navigation bar.

**Recipes** — Browse the household's recipe book by category or search by title. Open any recipe for full detail: ingredients with live pantry-status indicators (in stock / missing), serving scaler, metric ↔ imperial toggle, and step-by-step instructions. Start a cook session directly from a recipe. Includes the "What can I make?" view that matches all recipes against current pantry stock and tiers results into ready, almost-there, and ranked by match percentage.

**Pantry** — View and manage household stock by category. Each item shows in-stock status, quantity, unit, and notes. Add items, adjust stock, push items to the shopping list, and attach photos.

**Shopping List** — A household-shared list fed from recipes, the pantry, or direct entry. Organised into user-created categories. Tick items off as you shop; clear all checked items in one tap. Items carry a source indicator (recipe / pantry / direct).

**Community** — Two-tab section:
- *Feed* — Browse and post to the community feed. Posts are attached to a recipe with a comment. Filter by users you follow or by ingredient.
- *Household* — Manage membership: invite users, handle incoming join requests, view members, transfer ownership, or leave. Shares: send recipes to other users, manage received shares, accept/reject/re-copy. Leave reviews on received shares. Follow/unfollow users.

**Profile** — Edit profile details (first name, last name, handle, bio, profile picture), set account visibility, choose light/dark/system theme. Select up to five pinned recipes for the public profile page, draggable to reorder. View personal cook history with notes and photos. Account settings: change email, change password, delete account.

**Add Recipe** — Floating action button accessible from the Recipes tab. Three entry methods all converge on the same review form before saving:
1. Manual — fill in the form directly.
2. Image scan — upload 1–10 photos (cookbook pages, handwriting, screenshots); the recipe is extracted and pre-fills the form.
3. URL import — paste a recipe page link; structured data is parsed directly when available, or the page text is processed as a fallback.

**Cook Session** — Opened from a recipe detail. Tick ingredients as you cook; for each tick the user can mark the pantry item as used up or still in stock. Steps can also be ticked off. On completion, a summary screen lets the user review all queued pantry changes, add extras, then confirm in one atomic operation. Optional post-cook note and photos.

---

## Route Structure

```
/sign-in                      Sign-in page
/sign-up                      Registration page
/forgot-password              Request password-reset email
/reset-password?token=        Set new password (token from email)
/onboarding                   Household create-or-join flow (post-signup)

/_app (authenticated shell)
  /                           Redirects to /recipes
  /recipes                    Recipe list + "What can I make?"
  /pantry                     Pantry item list
  /shopping-list              Shopping list
  /community                  Community feed + household management
  /profile                    Own profile + cook history + settings
```

Public profile pages are served at `/@:handle` (handled by the Recipes tab context when navigating from within the app).

---

## Design Flow

### Authentication & onboarding

```
/sign-in ─────────────────────────────► app
/sign-up → email verification ────────► onboarding ─┬─ Create household ─► app
                                                     └─ Join household   ─► app
```

New users with no household land on onboarding. They either create a household (becoming its owner) or join an existing one via invite or by searching for a user and requesting to join. Onboarding can seed the new household with demo data for an interactive tour.

### Main navigation

```
Bottom nav: Recipes │ Pantry │ Shopping │ Community │ Profile
```

Each tab is a full page. Sub-screens (recipe detail, cook session, household settings, public profile, share management) open as sheets or navigate to nested routes within the same tab.

### Recipe flow

```
Recipe list (search / filter by category / "What can I make?")
  └─► Recipe card
        └─► Recipe detail sheet
              ├─ View (ingredients + pantry status, steps, serving scaler, unit toggle)
              ├─ Edit recipe
              ├─ Share recipe
              └─ Start Cooking
                    └─► Cook session
                          (tick ingredients + steps → per-ingredient pantry update prompts)
                          └─► Summary screen (review all queued pantry changes)
                                ├─ Adjust any change
                                ├─ Cancel (session marked cancelled, no DB writes)
                                └─ Confirm (atomic: apply pantry changes + mark complete)
                                      └─► Optional: add cook note + photos
```

### Household & social flow

```
Community tab
  ├─ Feed (community posts, filter by following / ingredient)
  │    └─ Post a recipe comment → creates a community post
  ├─ User search / public profiles (/@handle)
  ├─ Follow / unfollow
  ├─ Share a recipe → recipient gets a notification
  ├─ Shares received → accept / reject / re-copy / leave review
  └─ Household settings
        ├─ View members
        ├─ Invite a user
        ├─ Accept / decline join requests
        ├─ Transfer ownership
        └─ Leave household
```

---

## Design System

**Colour palette — warm stone.** Both light and dark modes use slightly warm grays (`oklch()` values) rather than pure neutral. Warm tones read better on phone screens in kitchen lighting.

**`oklch()` colour space.** All design tokens use `oklch()` for perceptually uniform lightness — `oklch(0.5 0.15 X)` has the same perceived brightness regardless of hue, making the light/dark system coherent without manual per-colour tweaks.

**Tailwind v4, CSS-first.** No `tailwind.config.ts`. All tokens (colours, radii) are CSS custom properties under `@theme inline` in `index.css`. The design system is visible in one file.

**shadcn/ui ownership model.** Components live in `src/components/ui/`. Add a new one with `npx shadcn add <component>`. Every component is fully owned — no upstream version to track.

---

## Development

```bash
npm install
npm run dev        # Starts Vite dev server on http://localhost:5173
npm test           # Run all tests (81 tests across 7 files)
npm run build      # Production build
```

The dev server proxies all `/api` requests to `http://localhost:3000`.

---

## Deployment

Built for Netlify. The `public/_redirects` file routes all paths to `index.html` for SPA routing:

```
/* /index.html 200
```

Set `VITE_API_URL` to the Render backend URL in Netlify's environment variables before deploying.
