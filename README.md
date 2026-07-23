# Recipe Book — Frontend

Vite · React · TypeScript · TanStack Router · TanStack Query · Tailwind CSS v4 · shadcn/ui

---

## Purpose

Mobile-first progressive web app for the Recipe Book API. Designed primarily for phone use in the kitchen — installs to the home screen and runs app-like via PWA. A single responsive build covers mobile, tablet, and desktop.

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

**Recipes** — Browse the household's recipe book by category or search by title. Open any recipe for full detail: ingredients with live pantry-status indicators (in stock / low / missing), serving scaler, metric ↔ imperial toggle, and step-by-step instructions. Start a cook session directly from a recipe.

**Pantry** — View and manage household stock by category. Each item shows fill level across one or more batches (0 / 25 / 50 / 75 / 100%). Add items, adjust fill levels, and push items to the shopping list.

**Shopping List** — A household-shared list fed from recipes, the pantry, or direct entry. Organised into user-created categories. Tick items off as you shop; clear all checked items in one tap.

**Community** — Browse public user profiles, follow people, share recipes, and manage incoming shares. View "Shared with me" history to leave a review or re-copy a previously deleted share. Manage household membership: invite members, handle join requests, transfer ownership, or leave the household.

**Profile** — Edit profile details (name, handle, bio, photo), select up to five pinned recipes for the public profile page, and view personal cook history.

**Add Recipe** — Three entry methods all converge on the same review form before saving:
1. Manual — fill in the form directly.
2. Image scan — upload 1–10 photos (cookbook pages, handwriting, screenshots); the recipe is extracted and pre-fills the form.
3. URL import — paste a recipe page link; structured data is parsed directly when available, or the page text is processed as a fallback.

**"What Can I Make?"** — Matches every recipe against current pantry stock. Shows ready-to-cook recipes, almost-there recipes (with a one-tap "add missing to shopping list" action), and the rest ranked by match percentage.

---

## Design Flow

### Authentication & onboarding

```
/sign-in ─────────────────────────────► app
/sign-up → email verification ────────► onboarding ─┬─ Create household ─► app
                                                     └─ Join household   ─► app
```

New users with no household land on an onboarding screen. They either create a household (becoming its owner) or join an existing one via invite or by searching for a user and requesting to join their household.

### Main navigation

```
Bottom nav: Recipes │ Pantry │ Shopping │ Community │ Profile
```

Each tab is a full page. Sub-screens (recipe detail, cook session, household settings, public profile) open as sheets or navigate to nested routes within the same tab.

### Recipe flow

```
Recipe list (search / filter by category)
  └─► Recipe card
        └─► Recipe detail sheet
              ├─ View (ingredients, steps, serving scaler, unit toggle)
              ├─ Edit recipe
              ├─ Share recipe
              └─ Start Cooking
                    └─► Cook session
                          (tick ingredients → pantry update prompts per ingredient)
                          └─► Summary screen (review all queued pantry changes)
                                ├─ Adjust any change
                                ├─ Cancel (session marked cancelled, no DB writes)
                                └─ Confirm (atomic: apply pantry changes + mark complete)
                                      └─► Optional: add cook note + photos
```

### Household & social flow

```
Community tab
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

**Colour palette — warm stone.** Both light and dark modes use slightly warm grays (`oklch()` values) rather than pure neutral. Warm tones read better on phone screens in kitchen lighting than blue-shifted displays.

**`oklch()` colour space.** All design tokens use `oklch()` for perceptually uniform lightness — `oklch(0.5 0.15 X)` has the same perceived brightness regardless of hue, making the light/dark system coherent without manual per-colour tweaks.

**Tailwind v4, CSS-first.** No `tailwind.config.ts`. All tokens (colours, radii) are CSS custom properties under `@theme inline` in `index.css`. The design system is visible in one file.

**shadcn/ui ownership model.** Components live in `src/components/ui/`. Add a new one with `npx shadcn add <component>`. Every pixel is customisable with no upstream version to track.

