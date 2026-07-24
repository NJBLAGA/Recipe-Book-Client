import React, { useState } from 'react';
import {
  BookOpenText, Refrigerator, ShoppingCart, Users, UserCircle,
  Star, Plus, Search, X, Send, UserMinus, UserPlus, BookOpen,
  ChevronRight, ChevronDown, ChevronUp, Check, ArrowUp, ArrowDown,
  Tag, SlidersHorizontal, Map, Camera, LogOut, ArrowLeftRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTour } from '@/contexts/TourContext';

// ── Demo data ──────────────────────────────────────────────────────────────────

const DEMO_RECIPES = [
  {
    id: '1', title: 'Spaghetti Carbonara', category: 'Italian', servings: 4,
    description: 'Classic Roman pasta with eggs, pecorino, guanciale and black pepper.',
    rating: 4.8, reviews: 12, prepTime: '10 min', cookTime: '20 min',
    img: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=400&q=75',
  },
  {
    id: '2', title: 'Avocado Toast', category: 'Breakfast', servings: 2,
    description: 'Ripe avocado on sourdough with lemon and chilli flakes.',
    rating: 4.2, reviews: 7, prepTime: '5 min', cookTime: '5 min',
    img: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?auto=format&fit=crop&w=400&q=75',
  },
  {
    id: '3', title: 'Chocolate Lava Cake', category: 'Desserts', servings: 4,
    description: 'Warm chocolate cake with a gooey molten centre. Perfect every time.',
    rating: 4.9, reviews: 23, prepTime: '20 min', cookTime: '12 min',
    img: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=75',
  },
];

const DEMO_PANTRY_CATEGORIES = [
  { label: 'Dairy & Eggs', items: [{ name: 'Eggs', inStock: true }, { name: 'Butter', inStock: true }, { name: 'Parmesan', inStock: false }] },
  { label: 'Dry Goods',    items: [{ name: 'Pasta', inStock: true }, { name: 'Rice', inStock: true }, { name: 'Flour', inStock: false }] },
  { label: 'Produce',      items: [{ name: 'Avocado', inStock: true }, { name: 'Lemon', inStock: false }] },
];

const DEMO_SHOPPING_CATS = [
  { label: 'Produce', items: [{ name: 'Avocado', qty: '×2', checked: false }, { name: 'Lemon', qty: '×3', checked: false }, { name: 'Cherry Tomatoes', qty: '250g', checked: true }] },
  { label: 'Dairy',   items: [{ name: 'Milk', qty: '1L', checked: false }, { name: 'Parmesan', qty: '200g', checked: false }] },
  { label: 'Pantry',  items: [{ name: 'Spaghetti', qty: '500g', checked: false }, { name: 'Olive Oil', qty: '', checked: false }] },
];

const DEMO_POSTS = [
  { user: 'Alex Chen', handle: 'alexchen', recipe: 'Thai Green Curry', comment: 'Made this three times this week — the family is obsessed!', reviews: 9, rating: 4.6, following: true,
    img: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=400&q=75' },
  { user: 'Sam Rivera', handle: 'samrivera', recipe: 'Banana Bread', comment: 'Best banana bread I\'ve ever tried. So moist!', reviews: 14, rating: 4.7, following: false,
    img: 'https://images.unsplash.com/photo-1607478900766-efe13248b125?auto=format&fit=crop&w=400&q=75' },
  { user: 'Priya Nair', handle: 'priya_cooks', recipe: 'Butter Chicken', comment: 'Restaurant quality at home. Don\'t skip the marinating step!', reviews: 31, rating: 4.9, following: false,
    img: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=400&q=75' },
];

const DEMO_MEMBERS = [
  { name: 'Jamie Cook', handle: 'jamiecook', role: 'OWNER' as const, ini: 'JC' },
  { name: 'Alex Chen', handle: 'alexchen', role: 'USER' as const, ini: 'AC' },
  { name: 'Sam Rivera', handle: 'samrivera', role: 'USER' as const, ini: 'SR' },
];

// ── Tour steps ─────────────────────────────────────────────────────────────────

type DemoPage = 'welcome' | 'navbar' | 'recipes' | 'pantry' | 'shopping' | 'community' | 'profile' | 'done';

interface TourStep { page: DemoPage; title: string; content: string; highlight?: string }

const TOUR_STEPS: TourStep[] = [
  { page: 'welcome', title: 'Welcome to Recipe Book', content: 'Your household\'s all-in-one cooking companion — shared recipe book, pantry, and shopping list. Let\'s take a quick look around.' },
  { page: 'navbar',  title: 'Finding your way around', content: 'Five sections live in the navigation bar at the bottom. Tap any icon to jump straight there — it\'s always visible, no matter where you are in the app.' },
  { page: 'recipes', title: 'Your Recipe Book', content: 'One shared recipe book for the whole household. Add recipes manually, scan cookbook pages, or import from a URL — all three land in the same review form.', highlight: 'recipe-list' },
  { page: 'recipes', title: 'Organise with categories', content: 'Create your own categories — Weeknight Dinners, Desserts, Christmas Specials — to keep the book tidy. Every recipe shows its live pantry status at a glance.', highlight: 'categories' },
  { page: 'pantry',  title: 'Your Pantry', content: 'Track what your household has in stock. Items are either In Stock or Out of Stock — tap any item to toggle it. The pantry powers live ingredient matching on every recipe.', highlight: 'pantry-items' },
  { page: 'pantry',  title: 'Smart ingredient links', content: 'Out-of-stock items show a warning on any recipe that needs them. Tap an item to push it straight to your shopping list — no double entry.', highlight: 'out-of-stock' },
  { page: 'shopping', title: 'Shopping List', content: 'One shared list for the whole household. Items arrive from recipes, the pantry, or added directly. Check them off as you shop.', highlight: 'list' },
  { page: 'shopping', title: 'Organised your way', content: 'Create categories that match your supermarket layout — Produce, Bakery, Freezer — so you never have to backtrack.', highlight: 'categories' },
  { page: 'community', title: 'Community', content: 'Discover what other households are cooking. Follow people you like, share your own recipes, and leave reviews. Every share creates an independent copy.', highlight: 'posts' },
  { page: 'community', title: 'Request any recipe', content: 'Spot something you want? Hit Request — the owner can send a copy directly to your recipe book. You can also leave a review after cooking it.', highlight: 'request' },
  { page: 'profile',  title: 'Your Profile', content: 'Edit your name, handle, bio, and profile photo. Choose your theme, toggle visibility between public and private, and set your preferred measurement units.', highlight: 'profile-card' },
  { page: 'profile',  title: 'Your Household', content: 'The Household tab shows everyone in your kitchen. Invite new members, manage who\'s in, and transfer ownership if needed.', highlight: 'household-tab' },
  { page: 'done',    title: 'You\'re all set!', content: 'That\'s everything — recipe book, pantry, shopping list, community, and profile, all connected. Head to Profile › Settings any time to replay this tour.' },
];

// ── Nav items ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { page: 'recipes'   as DemoPage, icon: BookOpenText, label: 'Recipes' },
  { page: 'community' as DemoPage, icon: Users,        label: 'Community' },
  { page: 'profile'   as DemoPage, icon: UserCircle,   label: 'Profile' },
  { page: 'pantry'    as DemoPage, icon: Refrigerator, label: 'Pantry' },
  { page: 'shopping'  as DemoPage, icon: ShoppingCart, label: 'Shopping' },
];

const NAV_DESCRIPTIONS: Record<string, string> = {
  recipes:   'Your shared recipe book. Add, browse, and organise everything your household has saved.',
  community: 'See what other households are cooking. Follow people and share your own recipes.',
  profile:   'Manage your account, household members, and in-app notifications.',
  pantry:    'Track what\'s in stock. Links live to recipes — missing ingredients surface instantly.',
  shopping:  'One shared list fed by recipes, pantry, or direct entry. Check off as you shop.',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function StarRow({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('h-3 w-3', i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25')} />
      ))}
      <span className="text-[10px] text-muted-foreground">({count})</span>
    </div>
  );
}

// ── Demo Pages ─────────────────────────────────────────────────────────────────

function DemoNavbar() {
  return (
    <div className="px-4 pt-6 pb-48 space-y-5">
      {/* Page header */}
      <div className="mb-1 flex items-center gap-2">
        <Map className="h-5 w-5 text-primary shrink-0" />
        <h1 className="text-xl font-bold">Navigation</h1>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        The bar at the bottom is always visible — tap any icon to jump straight to that section.
      </p>

      {/* Nav bar preview */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="px-3 py-1.5 border-b bg-muted/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Navigation Bar (always at the bottom)</p>
        </div>
        <div className="flex items-center justify-around px-3 py-3 bg-background/95">
          {NAV_ITEMS.map(({ page, icon: Icon, label }, i) => (
            <div key={page} className="flex flex-col items-center gap-1.5">
              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', i === 0 ? 'bg-primary/15' : 'bg-muted/50')}>
                <Icon className={cn('h-5 w-5', i === 0 ? 'text-primary' : 'text-muted-foreground/60')} />
              </div>
              <span className={cn('text-[9px] font-medium', i === 0 ? 'text-primary' : 'text-muted-foreground')}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section descriptions */}
      <div className="space-y-2">
        {NAV_ITEMS.map(({ page, icon: Icon, label }) => (
          <div key={page} className="flex items-start gap-3 rounded-xl border bg-card p-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{NAV_DESCRIPTIONS[page]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoRecipes({ highlight }: { highlight?: string }) {
  const recipes = highlight === 'categories' ? DEMO_RECIPES.slice(0, 2) : DEMO_RECIPES;
  return (
    <div className="px-4 pt-6">
      {/* Page header */}
      <div className="mb-1 flex items-center gap-2">
        <BookOpenText className="h-5 w-5 text-primary shrink-0" />
        <h1 className="text-xl font-bold">Recipe Book</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Your household's shared collection. Browse, search, and filter everything your household has saved.
      </p>

      {/* Action rows */}
      <div className="flex gap-2 mb-2">
        <button type="button" className="flex-1 flex items-center justify-center gap-1.5 h-9 text-sm font-medium rounded-lg bg-primary text-primary-foreground opacity-60 cursor-default">
          <Plus className="h-4 w-4" />Add Recipe
        </button>
        <button type="button" className="flex-1 flex items-center justify-center gap-1.5 h-9 text-sm font-medium rounded-lg border border-border bg-card opacity-60 cursor-default">
          <Tag className="h-4 w-4" />Manage Categories
        </button>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <div className="h-9 pl-9 rounded-xl border border-border/60 bg-card/50 flex items-center">
            <span className="text-sm text-muted-foreground/50">Search recipes…</span>
          </div>
        </div>
        <button type="button" className="h-9 flex items-center gap-1.5 px-3 rounded-xl border border-border/60 bg-card/50 opacity-60 cursor-default">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Filters</span>
        </button>
      </div>

      {/* Categories */}
      <div className={cn(
        'pb-3 flex gap-2 overflow-x-auto scrollbar-hide',
        highlight === 'categories' && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl px-2 py-2',
      )}>
        {['All', 'Italian', 'Breakfast', 'Desserts'].map((c) => (
          <span key={c} className={cn('shrink-0 text-xs font-medium rounded-full border px-3 py-1', c === 'All' ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground')}>
            {c}
          </span>
        ))}
      </div>

      {/* Recipe grid */}
      <div className={cn(
        'grid grid-cols-2 gap-3 pb-48',
        highlight === 'recipe-list' && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl p-2',
        highlight === 'categories' && 'mt-5',
      )}>
        {recipes.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-card overflow-hidden">
            <div className="aspect-[4/3] relative overflow-hidden bg-muted">
              <img src={r.img} alt={r.title} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="p-2.5 space-y-1">
              <p className="font-semibold text-sm leading-tight line-clamp-2">{r.title}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</p>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="text-primary text-[10px]">⏱</span>
                  <span className="font-medium text-foreground/80">Prep</span>{r.prepTime}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="text-amber-500 text-[10px]">🍳</span>
                  <span className="font-medium text-foreground/80">Cook</span>{r.cookTime}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoPantry({ highlight }: { highlight?: string }) {
  return (
    <div className="px-4 pt-6">
      {/* Page header */}
      <div className="mb-1 flex items-center gap-2">
        <Refrigerator className="h-5 w-5 text-primary shrink-0" />
        <h1 className="text-xl font-bold">Pantry</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Track what your household has in stock. Items link to recipes and your shopping list.
      </p>

      {/* Action rows */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button type="button" className="flex items-center justify-center gap-1.5 h-9 text-sm font-medium rounded-lg bg-primary text-primary-foreground opacity-60 cursor-default">
          <Plus className="h-4 w-4" />Add Item
        </button>
        <button type="button" className="flex items-center justify-center gap-1.5 h-9 text-sm font-medium rounded-lg border border-border bg-card opacity-60 cursor-default">
          <Tag className="h-4 w-4" />Manage Categories
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <div className="h-9 pl-9 rounded-xl border border-border/60 bg-card/50 flex items-center">
            <span className="text-sm text-muted-foreground/50">Search pantry…</span>
          </div>
        </div>
        <button type="button" className="flex items-center justify-center gap-1.5 h-9 text-sm font-medium rounded-xl border border-border/60 bg-card/50 opacity-60 cursor-default">
          <Search className="h-4 w-4 text-muted-foreground" /><span className="text-xs">Find by Ingredient</span>
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />In stock</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />Out of stock</span>
        <span className="ml-auto text-[10px]">8 items</span>
      </div>

      {/* Category groups */}
      <div className="space-y-6 pb-48">
        {DEMO_PANTRY_CATEGORIES.map((cat) => (
          <div key={cat.label} className={cn('space-y-2', highlight === 'out-of-stock' && cat.items.some((i) => !i.inStock) && 'ring-2 ring-rose-400 ring-offset-2 ring-offset-background rounded-xl p-2')}>
            <div className="flex w-full items-center gap-2 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat.label}</span>
              <span className="text-[10px] text-muted-foreground">({cat.items.length})</span>
              <span className="flex-1 h-px bg-border" />
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
            <div className={cn('grid grid-cols-2 gap-2', highlight === 'pantry-items' && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl p-2')}>
              {cat.items.map((item) => (
                <div key={item.name}
                  className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3 w-full text-left hover:bg-accent/40 hover:border-primary/30 transition-all cursor-pointer">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-semibold leading-snug line-clamp-1">{item.name}</p>
                    <span className={cn(
                      'inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none',
                      item.inStock
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
                    )}>
                      <span className={cn('h-1 w-1 rounded-full shrink-0', item.inStock ? 'bg-emerald-500' : 'bg-rose-500')} />
                      {item.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoShopping({ highlight }: { highlight?: string }) {
  const [ticked, setTicked] = useState<Set<string>>(new Set(['Cherry Tomatoes']));
  const toggle = (name: string) =>
    setTicked((prev) => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });

  return (
    <div className="px-4 pt-6">
      {/* Page header */}
      <div className="mb-1 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-primary shrink-0" />
        <h1 className="text-xl font-bold">Shopping List</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Shared household list. Items added from recipes and pantry appear here automatically.
      </p>

      {/* Action rows */}
      <div className="flex gap-2 mb-2">
        <button type="button" className="flex-1 flex items-center justify-center gap-1.5 h-9 text-sm font-medium rounded-lg bg-primary text-primary-foreground opacity-60 cursor-default">
          <Plus className="h-4 w-4" />Add Item
        </button>
        <button type="button" className="flex-1 flex items-center justify-center gap-1.5 h-9 text-sm font-medium rounded-lg border border-border bg-card opacity-60 cursor-default">
          <Tag className="h-4 w-4" />Manage Categories
        </button>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="w-1/2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <div className="h-9 pl-9 rounded-xl border border-border/60 bg-card/50 flex items-center">
            <span className="text-sm text-muted-foreground/50">Search list…</span>
          </div>
        </div>
        <button type="button" className="w-1/2 h-9 flex items-center gap-2 px-3 rounded-xl border border-border/60 bg-card/50 opacity-60 cursor-default">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium flex-1">Filters</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </div>

      {/* Category sections */}
      <div className="space-y-5 pb-48">
        {DEMO_SHOPPING_CATS.map((cat) => (
          <div key={cat.label} className={cn('space-y-1.5', highlight === 'categories' && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl p-2')}>
            <div className="flex w-full items-center gap-2 text-left py-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat.label}</span>
              <span className="text-[10px] text-muted-foreground">({cat.items.length})</span>
              <span className="flex-1 h-px bg-border" />
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
            <div className={cn('grid grid-cols-1 gap-2', highlight === 'list' && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl p-2')}>
              {cat.items.map((item, idx) => {
                const checked = ticked.has(item.name);
                return (
                  <div key={item.name}
                    className={cn('relative flex items-center gap-3 rounded-xl border bg-card px-3 py-3 transition-all hover:bg-accent/40 hover:border-primary/30 cursor-pointer', checked && 'opacity-60')}>
                    <button type="button"
                      onClick={() => toggle(item.name)}
                      className={cn('shrink-0 flex h-4 w-4 items-center justify-center rounded border-2 transition-colors', checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary/50')}>
                      {checked && <Check className="h-2.5 w-2.5" />}
                    </button>
                    <div className={cn('min-w-0 flex-1 space-y-0.5', checked && 'line-through')}>
                      <p className={cn('text-sm font-semibold leading-snug', checked && 'text-muted-foreground')}>{item.name}</p>
                      {item.qty && <p className="text-xs text-muted-foreground">{item.qty}</p>}
                    </div>
                    <div className="shrink-0 flex flex-col items-center gap-0.5">
                      <button type="button" disabled={idx === 0} className="disabled:opacity-20 text-muted-foreground p-0.5">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button type="button" disabled={idx === cat.items.length - 1} className="disabled:opacity-20 text-muted-foreground p-0.5">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoCommunity({ highlight }: { highlight?: string }) {
  return (
    <div className="px-4 pt-6">
      {/* Page header */}
      <div className="mb-1 flex items-center gap-2">
        <Users className="h-5 w-5 text-primary shrink-0" />
        <h1 className="text-xl font-bold">Community</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Discover recipes shared by other users, follow members you love, and share your own creations.
      </p>

      {/* Tabs */}
      <div className="rounded-t-2xl border border-b-0 overflow-hidden">
        <div className="w-full h-12 bg-card border-b flex">
          {['Community Recipes', 'Search Members', 'Following'].map((label) => (
            <div key={label}
              className={cn('flex-1 flex items-center justify-center text-[10px] font-medium',
                label === 'Community Recipes'
                  ? 'bg-background border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground')}>
              {label}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-b-2xl border border-t-0 bg-background overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Check out what the community is cooking</p>
            <button type="button" className="flex items-center gap-1.5 h-8 text-xs font-medium rounded-lg bg-primary text-primary-foreground px-3 opacity-60 cursor-default">
              <Plus className="h-3.5 w-3.5" />Share A Recipe
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <div className="h-9 pl-9 rounded-xl border border-border/60 bg-card/50 flex items-center">
              <span className="text-sm text-muted-foreground/50">Search posts by username…</span>
            </div>
          </div>

          <div className={cn('space-y-3 pb-44', highlight === 'posts' && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl p-2')}>
            {DEMO_POSTS.map((post, i) => (
              <div key={post.handle} className="rounded-2xl border bg-card overflow-hidden">
                <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{post.user[0]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">@{post.handle}</p>
                    <p className="text-[10px] text-muted-foreground">{post.user}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button"
                      className={cn(
                        'flex items-center gap-1 text-[11px] font-medium rounded-full border px-2.5 py-1 transition-colors',
                        post.following
                          ? 'border-border/60 text-muted-foreground'
                          : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground',
                      )}>
                      {post.following ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                      {post.following ? 'Unfollow' : 'Follow'}
                    </button>
                  </div>
                </div>
                <div className="px-3 pb-2">
                  <p className="text-sm leading-relaxed text-foreground/90 line-clamp-2">{post.comment}</p>
                </div>
                <div className="mx-3 mb-3 rounded-xl border bg-background/60 overflow-hidden">
                  <div className="h-20 bg-muted overflow-hidden">
                    <img src={post.img} alt={post.recipe} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className={cn('flex items-center gap-2 px-3 py-2.5', highlight === 'request' && i === 1 && 'ring-2 ring-primary ring-inset')}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{post.recipe}</p>
                      <StarRow rating={post.rating} count={post.reviews} />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button"
                        className="flex items-center gap-1 text-[11px] font-medium rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground">
                        <BookOpen className="h-3 w-3" />View
                      </button>
                      <button type="button"
                        className={cn(
                          'flex items-center gap-1 text-[11px] font-medium rounded-full border px-2.5 py-1 transition-colors',
                          highlight === 'request' && i === 1
                            ? 'border-primary text-primary bg-primary/5'
                            : 'border-primary text-primary',
                        )}>
                        <Send className="h-3 w-3" />Request
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoProfile({ highlight }: { highlight?: string }) {
  const activeTab = highlight === 'household-tab' ? 'household' : 'settings';

  return (
    <div className="px-4 pt-6">
      {/* Page header */}
      <div className="mb-1 flex items-center gap-2">
        <UserCircle className="h-5 w-5 text-primary shrink-0" />
        <h1 className="text-xl font-bold">My Profile</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Manage your account settings, household members, and notifications.
      </p>

      {/* Tabs */}
      <div className="rounded-t-2xl border border-b-0 overflow-hidden">
        <div className="w-full h-12 bg-card border-b flex">
          {(['Settings', 'Household', 'Notifications'] as const).map((label) => {
            const isActive = (label === 'Settings' && activeTab === 'settings') || (label === 'Household' && activeTab === 'household');
            return (
              <div key={label}
                className={cn('flex-1 flex items-center justify-center text-xs font-medium',
                  isActive ? 'bg-background border-b-2 border-primary text-foreground' : 'text-muted-foreground')}>
                {label}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-b-2xl border border-t-0 bg-background overflow-hidden mb-48 divide-y">

        {activeTab === 'settings' && (
          <>
            {/* Avatar + name + logout */}
            <div className={cn('flex flex-col items-center gap-2 p-6', highlight === 'profile-card' && 'ring-2 ring-primary ring-inset')}>
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">J</div>
                <div className="bg-primary text-primary-foreground absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full shadow-md">
                  <Camera className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-semibold">Jamie Cook</p>
                <p className="text-muted-foreground text-xs">@jamiecook</p>
              </div>
              <div className="mt-1 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium opacity-60 cursor-default">
                <LogOut className="h-3.5 w-3.5" />Log Out
              </div>
            </div>

            {/* Profile section */}
            <div className="p-5 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Profile</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium">First Name</p>
                  <div className="h-9 rounded-lg border bg-card/50 px-3 flex items-center text-sm">Jamie</div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium">Last Name</p>
                  <div className="h-9 rounded-lg border bg-card/50 px-3 flex items-center text-sm">Cook</div>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">Handle</p>
                <div className="h-9 rounded-lg border bg-card/50 px-3 flex items-center text-sm text-muted-foreground">@jamiecook</div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">Bio</p>
                <div className="rounded-lg border bg-card/50 px-3 py-2.5 text-sm text-muted-foreground min-h-[60px]">Passionate home cook who loves Italian food.</div>
              </div>
              <button type="button" className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium opacity-60 cursor-default">
                Save Changes
              </button>
            </div>

            {/* Email section */}
            <div className="p-5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</p>
              <p className="text-sm font-medium">jamie@example.com</p>
              <button type="button" className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium opacity-60 cursor-default">
                Change Email
              </button>
            </div>

            {/* Advanced Settings */}
            <div className="p-5 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Advanced Settings</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground">Theme</p>
                  <div className="relative flex h-9 w-full items-center rounded-full border bg-muted/60 p-0.5">
                    {['Light', 'Dark'].map((t, i) => (
                      <button key={t} type="button"
                        className={cn('flex-1 text-[10px] font-medium py-1 rounded-full transition-colors', i === 1 ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground')}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground">Visibility</p>
                  <div className="relative flex h-9 w-full items-center rounded-full border bg-muted/60 p-0.5">
                    {['Public', 'Private'].map((t, i) => (
                      <button key={t} type="button"
                        className={cn('flex-1 text-[10px] font-medium py-1 rounded-full transition-colors', i === 0 ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground')}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground">Units</p>
                  <div className="relative flex h-9 w-full items-center rounded-full border bg-muted/60 p-0.5">
                    {['Metric', 'Imperial'].map((t, i) => (
                      <button key={t} type="button"
                        className={cn('flex-1 text-[10px] font-medium py-1 rounded-full transition-colors', i === 0 ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground')}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Pinned Recipes */}
            <div className="p-5 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pinned Recipes</p>
              <p className="text-xs text-muted-foreground">Up to 5 pinned recipes appear on your public profile.</p>
              <div className="space-y-2">
                {[
                  { pos: 1, title: 'Spaghetti Carbonara', img: DEMO_RECIPES[0].img },
                  { pos: 2, title: 'Chocolate Lava Cake', img: DEMO_RECIPES[2].img },
                ].map((pin) => (
                  <div key={pin.pos} className="relative flex items-center gap-3 rounded-xl border bg-card p-2.5">
                    <span className="absolute -top-2 -left-2 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow-sm">{pin.pos}</span>
                    <img src={pin.img} alt={pin.title} className="h-12 w-12 rounded-lg object-cover shrink-0" loading="lazy" />
                    <p className="text-sm font-semibold flex-1 min-w-0 truncate">{pin.title}</p>
                  </div>
                ))}
                <button type="button" className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground cursor-default opacity-60">
                  <Plus className="h-3.5 w-3.5" />Add Pin
                </button>
              </div>
            </div>

            {/* App Tour */}
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                  <Map className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">App Tour</p>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                    Walk through a demo showing all sections of the app with fake data — no changes to your real content.
                  </p>
                  <button type="button" className="mt-3 flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium opacity-60 cursor-default">
                    <Map className="h-3.5 w-3.5" />Take the tour
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'household' && (
          <>
            {/* Household header */}
            <div className={cn('p-5', highlight === 'household-tab' && 'ring-2 ring-primary ring-inset')}>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold shrink-0">T</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">The Cook Kitchen</p>
                  <p className="text-muted-foreground text-xs">3 members</p>
                </div>
                <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-primary/15 text-primary">Owner</span>
              </div>
            </div>

            {/* Members */}
            <div className="p-5 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Members</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEMO_MEMBERS.map((m) => (
                  <div key={m.handle} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">{m.ini}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">@{m.handle}</p>
                    </div>
                    <span className={cn('text-[10px] font-medium rounded-full px-2 py-0.5', m.role === 'OWNER' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                      {m.role === 'OWNER' ? 'Owner' : 'Member'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite */}
            <div className="p-5">
              <button type="button" className="w-full flex items-center justify-center gap-1.5 h-9 text-sm font-medium rounded-lg bg-primary text-primary-foreground opacity-60 cursor-default">
                <Plus className="h-4 w-4" />Invite Member
              </button>
            </div>

            {/* Management */}
            <div className="p-5 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Management</p>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Transfer ownership to another member</p>
                <div className="flex gap-2">
                  <div className="flex-1 h-9 rounded-lg border bg-card/50 px-3 flex items-center text-sm text-muted-foreground">Select member…</div>
                  <button type="button" className="flex items-center gap-1 h-9 px-3 rounded-lg border border-border text-xs font-medium opacity-60 cursor-default">
                    <ArrowLeftRight className="h-3.5 w-3.5" />Transfer
                  </button>
                </div>
              </div>
              <button type="button" className="w-full flex items-center justify-center gap-1.5 h-9 text-sm font-medium rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 opacity-60 cursor-default">
                Leave Household
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DemoWelcome() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
      <div className="h-20 w-20 rounded-3xl bg-primary flex items-center justify-center shadow-xl">
        <BookOpenText className="h-10 w-10 text-primary-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Welcome to Recipe Book</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
          Shared recipes, pantry tracking, and shopping lists — built for households.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs pt-2">
        {[
          { icon: BookOpenText, label: 'Recipes' },
          { icon: Refrigerator, label: 'Pantry' },
          { icon: ShoppingCart, label: 'Shopping' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-2 rounded-2xl border bg-card/60 p-4">
            <Icon className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoDone() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
      <div className="h-20 w-20 rounded-3xl bg-emerald-500 flex items-center justify-center shadow-xl">
        <Star className="h-10 w-10 text-white" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">You're all set!</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
          Everything is connected and ready to use. Jump in and start building your household's recipe collection.
        </p>
      </div>
    </div>
  );
}

// ── Locked Demo Nav Bar ────────────────────────────────────────────────────────

function DemoNav({ currentPage }: { currentPage: DemoPage }) {
  return (
    <nav className="shrink-0 bg-background/95 border-t supports-[backdrop-filter]:backdrop-blur-sm pointer-events-none select-none">
      <div className="flex items-center justify-around px-2 py-1.5 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map(({ page, icon: Icon, label }) => {
          const active = currentPage === page;
          return (
            <div key={page}
              className={cn(
                'flex flex-row items-center gap-1.5 rounded-xl min-w-0 px-1.5 py-1.5 text-[9px]',
                active ? 'text-primary font-medium' : 'text-muted-foreground',
              )}>
              <Icon className={cn('h-4 w-4 shrink-0', active && 'stroke-[2.5]')} />
              <span className="truncate leading-none">{label}</span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

// ── Tour Bubble ────────────────────────────────────────────────────────────────

function TourBubble({ step, onPrev, onNext, onStop }: {
  step: TourStep;
  onPrev: () => void; onNext: () => void; onStop: () => void;
}) {
  const { currentStep, totalSteps } = useTour();
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className="absolute bottom-4 left-3 right-3 z-20 rounded-2xl shadow-2xl border bg-card border-border">
      <div className="px-4 pt-4 pb-3 space-y-3">
        {/* Title + content */}
        <div className="space-y-1.5">
          <p className="font-semibold text-sm text-foreground">{step.title}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{step.content}</p>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Navigation row */}
        <div className="flex items-center justify-between">
          <button type="button" onClick={onPrev} disabled={isFirst}
            className="flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors bg-muted text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-muted">
            ‹ Prev
          </button>

          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {currentStep + 1} / {totalSteps}
          </span>

          <button type="button" onClick={isLast ? onStop : onNext}
            className="flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors bg-primary text-primary-foreground hover:bg-primary/90">
            {isLast ? 'Finish' : 'Next ›'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Overlay ───────────────────────────────────────────────────────────────

export function TourOverlay() {
  const { isTourActive, currentStep, nextStep, prevStep, stopTour } = useTour();

  if (!isTourActive) return null;

  const step = TOUR_STEPS[Math.min(currentStep, TOUR_STEPS.length - 1)];
  const effectivePage: DemoPage = step.page;

  const showNav = effectivePage !== 'welcome' && effectivePage !== 'done' && effectivePage !== 'navbar';

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm px-2 sm:px-0">
      <div className="w-full max-w-2xl h-[88vh] flex flex-col bg-background rounded-2xl border border-border/20 shadow-2xl overflow-hidden">

        {/* Demo header — locked: no search icon, prominent Stop Tour button */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <BookOpenText className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Recipe Book</span>
            <span className="rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-2 py-0.5">Demo</span>
          </div>
          <button type="button" onClick={stopTour}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors shadow-sm">
            <X className="h-3.5 w-3.5" />Stop Tour
          </button>
        </div>

        {/* Demo page content */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          <div className="absolute inset-0 overflow-y-auto">
            {effectivePage === 'welcome'   && <DemoWelcome />}
            {effectivePage === 'navbar'    && <DemoNavbar />}
            {effectivePage === 'done'      && <DemoDone />}
            {effectivePage === 'recipes'   && <DemoRecipes highlight={step.highlight} />}
            {effectivePage === 'pantry'    && <DemoPantry highlight={step.highlight} />}
            {effectivePage === 'shopping'  && <DemoShopping highlight={step.highlight} />}
            {effectivePage === 'community' && <DemoCommunity highlight={step.highlight} />}
            {effectivePage === 'profile'   && <DemoProfile highlight={step.highlight} />}
          </div>

          {/* Tour bubble */}
          <TourBubble step={step} onNext={nextStep} onPrev={prevStep} onStop={stopTour} />
        </div>

        {/* Locked demo nav — shown on all pages except welcome/done/navbar */}
        {showNav && <DemoNav currentPage={effectivePage} />}

      </div>
    </div>
  );
}
