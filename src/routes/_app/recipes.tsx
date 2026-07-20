import { createFileRoute, useNavigate } from '@tanstack/react-router';
import ReactConfetti from 'react-confetti';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpenText, Plus, Search, X, ChevronLeft, ChevronRight,
  Star, Pencil, Trash2, ArrowUp, ArrowDown, Minus, Camera,
  Link2, UtensilsCrossed, ShoppingCart, AlertCircle, History,
  Check, ChefHat, ChevronDown, ChevronUp, Loader2, SlidersHorizontal,
  FileText, Tag, ArrowRight, ImagePlus, Maximize2, Square, CheckSquare,
  CheckCircle2, XCircle, Clock, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useMeasureSystem } from '@/hooks/useMeasureSystem';
import type { MeasureSystem } from '@/hooks/useMeasureSystem';

export const Route = createFileRoute('/_app/recipes')({
  validateSearch: (search: Record<string, unknown>) => ({
    openRecipeId: typeof search.openRecipeId === 'string' ? search.openRecipeId : undefined,
  }),
  component: RecipesPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category { id: string; name: string; recipeBookId: string; }

interface RecipeSummary {
  id: string; title: string; description: string | null; baseServings: number;
  categoryId: string | null; categoryName: string | null;
  images: string[]; createdAt: string; updatedAt: string;
}

interface Ingredient {
  id: string; ingredientId: string; name: string;
  quantity: string | null; unit: string | null; note: string | null; sortOrder: number;
}

interface RecipeImage { id: string; url: string; sortOrder: number; }

interface RecipeStep { text: string; subSteps: string[]; }

interface RecipeDetail extends Omit<RecipeSummary, 'images'> {
  steps: RecipeStep[]; sharedByUserId: string | null; originalRecipeId: string | null;
  ingredients: Ingredient[]; images: RecipeImage[];
}

interface CookHistoryEntry {
  id: string; recipeId: string | null; recipeTitle: string | null;
  recipeImage: string | null; userId: string; userName: string | null;
  userHandle: string | null; userImage: string | null;
  servings: number | null; note: string | null; cookedAt: string;
}

interface PantryItemSummary {
  id: string; ingredientId: string; ingredientName: string;
  inStock: boolean; quantity: number | null; unit: string | null; notes: string | null;
  images: { id: string; url: string; sortOrder: number }[];
}

interface InProgressSession {
  id: string; recipeId: string | null; recipeTitle: string | null;
  recipeImage: string | null; userId: string; userName: string | null;
  userHandle: string | null; userImage: string | null; startedAt: string;
}

interface UserPin {
  position: number; recipeId: string | null; recipeTitle: string | null;
  recipeDescription: string | null; recipeImage: string | null;
  recipeRating: { avg: number; count: number } | null;
}

interface UserProfile {
  id: string; name: string | null; handle: string | null;
  bio: string | null; image: string | null; pins: UserPin[];
}

interface PantryChange {
  inStock: boolean; quantity: number | null; unit: string | null; notes: string | null;
}

interface CookSession {
  id: string;
  recipeId: string | null;
  status: string;
  pendingChanges: {
    ticked: string[];
    tickedSteps: number[];
    pantryChanges: { itemId: string; inStock: boolean }[];
    extraChanges: { itemId: string; inStock: boolean }[];
  } | null;
  resumed: boolean;
}

interface IngredientRow {
  quantity: string; unit: string; name: string; note: string;
}

interface CanMakeResponse {
  ready: Array<{ id: string; title: string; runningLowItems: Array<{ ingredientId: string; name: string }> }>;
  almost: Array<{ id: string; title: string; matchPct: number; missingIngredients: Array<{ ingredientId: string; name: string }> }>;
  rest: Array<{ id: string; title: string; matchPct: number; missingCount: number }>;
}

interface ExtractedRecipe {
  title: string; description: string | null; baseServings: number;
  steps: string[]; ingredients: Array<{ name: string; quantity: number | null; unit: string | null; note: string | null }>;
}

interface FormImage {
  id?: string;
  url: string;
  file?: File;
  toDelete: boolean;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function round(n: number): string {
  if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
  return n < 10 ? n.toFixed(1) : Math.round(n).toString();
}

function scaleQty(qty: string | null, base: number, target: number): string | null {
  if (!qty) return null;
  const n = parseFloat(qty);
  if (isNaN(n)) return qty;
  return round((n * target) / base);
}

function convertQty(qty: string | null, unit: string | null, system: MeasureSystem) {
  if (!qty || !unit) return { qty: qty ?? '', unit: unit ?? '' };
  const n = parseFloat(qty);
  if (isNaN(n)) return { qty, unit };
  if (system === 'imperial') {
    if (unit === 'g')  return { qty: round(n * 0.03527), unit: 'oz' };
    if (unit === 'kg') return { qty: round(n * 2.20462), unit: 'lb' };
    if (unit === 'ml') return { qty: round(n * 0.00422675), unit: 'cups' };
    if (unit === 'L')  return { qty: round(n * 4.22675), unit: 'cups' };
    if (unit === '°C') return { qty: round(n * 9 / 5 + 32), unit: '°F' };
  } else {
    if (unit === 'oz')   return { qty: round(n * 28.3495), unit: 'g' };
    if (unit === 'lb')   return { qty: round(n * 453.592), unit: 'g' };
    if (unit === 'cups') return { qty: round(n * 236.588), unit: 'ml' };
    if (unit === '°F')   return { qty: round((n - 32) * 5 / 9), unit: '°C' };
  }
  return { qty, unit };
}

function convertStepText(step: string, system: MeasureSystem): string {
  return step
    .replace(/(\d+(?:\.\d+)?)\s*°\s*([CcFf])\b/g, (_, num, unit) => {
      const n = parseFloat(num);
      const u = unit.toUpperCase() as 'C' | 'F';
      if (system === 'imperial' && u === 'C') return `${round(n * 9 / 5 + 32)}°F`;
      if (system === 'metric' && u === 'F') return `${round((n - 32) * 5 / 9)}°C`;
      return `${num}°${u}`;
    });
}

const LEADING_ADJECTIVES = new Set([
  'ripe','fresh','dried','ground','chopped','minced','sliced','diced','grated','peeled',
  'frozen','canned','raw','cooked','large','small','medium','big','whole','half',
  'boneless','skinless','lean','extra','finely','roughly','thinly','thick','thin',
  'hot','cold','warm','sweet','sour','bitter','spicy','mild','heavy','light',
  'soft','firm','hard','tender','crispy','crunchy','plain','unsalted','salted',
  'crushed','flaked','packed','reduced','low-fat','skim','full-fat',
]);

function simplifyIngredientName(name: string): string {
  const words = name.trim().split(/\s+/);
  let start = 0;
  while (start < words.length - 1 && LEADING_ADJECTIVES.has(words[start].toLowerCase())) start++;
  return words.slice(start).join(' ');
}

function pantryStatus(ingredientId: string, pantryMap: Map<string, boolean>): 'in-stock' | 'missing' {
  return pantryMap.get(ingredientId) ? 'in-stock' : 'missing';
}

function PantryIcon({ status }: { status: 'in-stock' | 'missing' }) {
  return status === 'in-stock'
    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
    : <XCircle className="h-4 w-4 shrink-0 text-rose-500" />;
}

function StarDisplay({ rating }: { rating: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const full = rounded >= i;
        const half = !full && rounded >= i - 0.5;
        return (
          <span key={i} className="relative inline-block h-3 w-3">
            <Star className={cn('h-3 w-3', full || half ? 'text-amber-400' : 'text-muted-foreground/25')}
              fill={full ? 'currentColor' : 'none'} />
            {half && <Star className="absolute inset-0 h-3 w-3 fill-amber-400 text-amber-400 [clip-path:inset(0_50%_0_0)]" />}
          </span>
        );
      })}
    </div>
  );
}

function emptyRow(sortOrder = 0): IngredientRow & { sortOrder: number } {
  return { quantity: '', unit: '', name: '', note: '', sortOrder };
}

function extractedToRows(ings: ExtractedRecipe['ingredients']): Array<IngredientRow & { sortOrder: number }> {
  return ings.map((ing, i) => ({
    quantity: ing.quantity != null ? String(ing.quantity) : '',
    unit: ing.unit ?? '',
    name: ing.name,
    note: ing.note ?? '',
    sortOrder: i,
  }));
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

function Confetti({ fading }: { fading: boolean }) {
  return (
    <div style={{ transition: 'opacity 2s ease-out', opacity: fading ? 0 : 1 }}>
      <ReactConfetti
        recycle={false}
        numberOfPieces={120}
        gravity={0.18}
        initialVelocityX={{ min: -7, max: 7 }}
        initialVelocityY={{ min: 7, max: 20 }}
        confettiSource={{ x: 0, y: 0, w: window.innerWidth, h: 0 }}
        style={{ zIndex: 500 }}
      />
    </div>
  );
}

// ─── Alphabet Bar ─────────────────────────────────────────────────────────────

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function AlphabetBar({ filter, onChange }: { filter: string | null; onChange: (l: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-0.5 py-0.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'h-6 px-2.5 rounded-full text-[10px] font-semibold transition-colors',
          filter === null
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
        )}
      >
        All
      </button>
      {ALPHABET.map((letter) => (
        <button
          key={letter}
          type="button"
          onClick={() => onChange(filter === letter ? null : letter)}
          className={cn(
            'h-6 w-6 rounded-full text-[10px] font-semibold flex items-center justify-center transition-colors',
            filter === letter
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
          )}
        >
          {letter}
        </button>
      ))}
    </div>
  );
}

// ─── Cooking Animation ────────────────────────────────────────────────────────

function CookingAnimation({ message = 'Scanning your recipe…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 px-6">
      <div className="relative">
        <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
          <ChefHat className="h-12 w-12 text-primary" style={{ animation: 'bounce 1.2s ease-in-out infinite' }} />
        </div>
        <span className="absolute -top-1 -right-1 text-2xl" style={{ animation: 'spin 3s linear infinite' }}>✨</span>
        <span className="absolute -bottom-1 -left-1 text-xl" style={{ animation: 'bounce 1.5s ease-in-out infinite 0.3s' }}>🍳</span>
      </div>
      <div className="text-center space-y-2">
        <p className="text-sm font-semibold">{message}</p>
        <p className="text-xs text-muted-foreground">Extracting ingredients, steps, and more</p>
        <div className="flex gap-2 justify-center pt-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-2 w-2 rounded-full bg-primary"
              style={{ animation: `bounce 0.8s ease-in-out infinite`, animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Recipe Form ──────────────────────────────────────────────────────────────

interface RecipeFormState {
  title: string;
  description: string;
  baseServings: string;
  categoryId: string;
  steps: RecipeStep[];
  ingredients: Array<IngredientRow & { sortOrder: number }>;
}

interface RecipeFormProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  initial?: Partial<RecipeFormState>;
  editId?: string;
  initialMode?: 'idle' | 'scan' | 'url' | 'paste';
  existingImages?: RecipeImage[];
}

function RecipeForm({ open, onClose, categories, initial, editId, initialMode = 'idle', existingImages }: RecipeFormProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'idle' | 'scan' | 'url' | 'paste'>(initialMode);
  const [scanPhase, setScanPhase] = useState<'select' | 'scanning' | 'done'>('select');
  const [scanFiles, setScanFiles] = useState<File[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [urlPhase, setUrlPhase] = useState<'input' | 'importing' | 'done'>('input');
  const [urlError, setUrlError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pastePhase, setPastePhase] = useState<'input' | 'processing' | 'done'>('input');
  const [formImages, setFormImages] = useState<FormImage[]>([]);
  const [createCatOpen, setCreateCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const emptyStep = (): RecipeStep => ({ text: '', subSteps: [] });

  const [form, setForm] = useState<RecipeFormState>(() => ({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    baseServings: initial?.baseServings ?? '4',
    categoryId: initial?.categoryId ?? '',
    steps: initial?.steps?.length ? initial.steps : [emptyStep()],
    ingredients: initial?.ingredients?.length ? initial.ingredients : [emptyRow(0)],
  }));

  useEffect(() => {
    if (open) {
      setForm({
        title: initial?.title ?? '',
        description: initial?.description ?? '',
        baseServings: initial?.baseServings ?? '4',
        categoryId: initial?.categoryId ?? '',
        steps: initial?.steps?.length ? initial.steps : [emptyStep()],
        ingredients: initial?.ingredients?.length ? initial.ingredients : [emptyRow(0)],
      });
      setMode(initialMode);
      setScanPhase('select');
      setScanFiles([]);
      setUrlInput('');
      setUrlPhase('input');
      setUrlError('');
      setPasteText('');
      setPastePhase('input');
      setFormImages(
        (existingImages ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((img) => ({ id: img.id, url: img.url, toDelete: false })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const prefill = useCallback((extracted: ExtractedRecipe) => {
    setForm((prev) => ({
      ...prev,
      title: extracted.title || prev.title,
      description: extracted.description ?? prev.description,
      baseServings: String(extracted.baseServings),
      steps: extracted.steps.length ? extracted.steps.map((s) => ({ text: s, subSteps: [] })) : prev.steps,
      ingredients: extracted.ingredients.length ? extractedToRows(extracted.ingredients) : prev.ingredients,
    }));
    setScanPhase('done');
  }, []);

  const scanImages = async () => {
    if (scanFiles.length === 0) return;
    setScanPhase('scanning');
    try {
      const fd = new FormData();
      scanFiles.forEach((f) => fd.append('images', f));
      const data = await api.postForm<ExtractedRecipe>('/api/recipe-book/scan', fd);
      prefill(data);
      toast.success('Recipe scanned');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Scan failed');
      setScanPhase('select');
    } finally {
      setScanFiles([]);
    }
  };

  const importUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith('https://')) {
      setUrlError('URL must start with https:// for security');
      return;
    }
    setUrlError('');
    setUrlPhase('importing');
    try {
      const data = await api.post<ExtractedRecipe>('/api/recipe-book/import-url', { url });
      setForm((prev) => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description ?? prev.description,
        baseServings: String(data.baseServings),
        steps: data.steps.length ? data.steps.map((s) => ({ text: s, subSteps: [] })) : prev.steps,
        ingredients: data.ingredients.length ? extractedToRows(data.ingredients) : prev.ingredients,
      }));
      setUrlPhase('done');
      toast.success('Recipe imported');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Import failed');
      setUrlPhase('input');
    }
  };

  const extractPaste = async () => {
    if (!pasteText.trim()) return;
    setPastePhase('processing');
    try {
      const data = await api.post<ExtractedRecipe>('/api/recipe-book/extract-text', { text: pasteText.trim() });
      setForm((prev) => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description ?? prev.description,
        baseServings: String(data.baseServings),
        steps: data.steps.length ? data.steps.map((s) => ({ text: s, subSteps: [] })) : prev.steps,
        ingredients: data.ingredients.length ? extractedToRows(data.ingredients) : prev.ingredients,
      }));
      setPastePhase('done');
      toast.success('Recipe extracted');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Extraction failed');
      setPastePhase('input');
    }
  };

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => api.post<Category>('/api/recipe-book/categories', { name }),
    onSuccess: (newCat) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipeBook.categories() });
      setForm((p) => ({ ...p, categoryId: newCat.id }));
      setNewCatName('');
      setCreateCatOpen(false);
      toast.success('Category created');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const activeFormImages = formImages.filter((i) => !i.toDelete);

  const addPhotos = (files: File[]) => {
    const newImgs: FormImage[] = files.map((f) => ({
      url: URL.createObjectURL(f),
      file: f,
      toDelete: false,
    }));
    setFormImages((prev) => [...prev, ...newImgs]);
  };

  const movePhoto = (idx: number, dir: -1 | 1) => {
    setFormImages((prev) => {
      const active = prev.filter((i) => !i.toDelete);
      const to = idx + dir;
      if (to < 0 || to >= active.length) return prev;
      const newArr = [...prev];
      const aIdx = newArr.indexOf(active[idx]);
      const bIdx = newArr.indexOf(active[to]);
      [newArr[aIdx], newArr[bIdx]] = [newArr[bIdx], newArr[aIdx]];
      return newArr;
    });
  };

  const removePhoto = (idx: number) => {
    setFormImages((prev) => {
      const active = prev.filter((i) => !i.toDelete);
      const img = active[idx];
      if (!img) return prev;
      if (img.id) {
        return prev.map((i) => (i === img ? { ...i, toDelete: true } : i));
      }
      if (img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
      return prev.filter((i) => i !== img);
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const servings = parseInt(form.baseServings);
      if (isNaN(servings) || servings < 1) throw new Error('Servings must be a positive number');
      if (!form.title.trim()) throw new Error('Title is required');
      const ingredients = form.ingredients
        .filter((r) => r.name.trim())
        .map((r, i) => ({
          name: r.name.trim(),
          quantity: r.quantity ? parseFloat(r.quantity) || null : null,
          unit: r.unit.trim() || null,
          note: r.note.trim() || null,
          sortOrder: i,
        }));
      if (ingredients.length === 0) throw new Error('At least one ingredient is required');
      const steps = form.steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim(), subSteps: s.subSteps.filter((ss) => ss.trim()) }));
      if (steps.length === 0) throw new Error('At least one step is required');

      if (!form.categoryId) throw new Error('Category is required');

      const body = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        baseServings: servings,
        categoryId: form.categoryId,
        steps,
        ingredients,
      };

      let recipeId: string;
      if (editId) {
        await api.patch(`/api/recipe-book/recipes/${editId}`, body);
        recipeId = editId;
      } else {
        const created = await api.post<{ id: string }>('/api/recipe-book/recipes', body);
        recipeId = created.id;
      }

      // Delete removed existing images
      const toDelete = formImages.filter((i) => i.toDelete && i.id);
      for (const img of toDelete) {
        await api.delete(`/api/recipe-book/recipes/${recipeId}/images/${img.id}`);
      }

      // Upload new images, collect IDs
      const newImgs = activeFormImages.filter((i) => i.file);
      const uploadedIds: Array<{ id: string }> = [];
      for (const img of newImgs) {
        const fd = new FormData();
        fd.append('image', img.file!);
        const result = await api.postForm<{ id: string }>(`/api/recipe-book/recipes/${recipeId}/images`, fd);
        uploadedIds.push(result);
      }

      // Patch final sort order across all surviving images
      const existingKept = activeFormImages.filter((i) => i.id).map((i) => ({ id: i.id! }));
      const allOrdered = [...existingKept, ...uploadedIds];
      if (allOrdered.length > 0) {
        await api.patch(
          `/api/recipe-book/recipes/${recipeId}/images/order`,
          allOrdered.map((img, idx) => ({ id: img.id, sortOrder: idx })),
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recipe-book'] });
      toast.success(editId ? 'Recipe updated' : 'Recipe saved');
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Save failed'),
  });

  const setIng = (idx: number, field: keyof IngredientRow, val: string) => {
    setForm((p) => {
      const ings = [...p.ingredients];
      ings[idx] = { ...ings[idx], [field]: val };
      return { ...p, ingredients: ings };
    });
  };

  const addIng = () => setForm((p) => ({
    ...p, ingredients: [...p.ingredients, emptyRow(p.ingredients.length)],
  }));

  const removeIng = (idx: number) => setForm((p) => ({
    ...p, ingredients: p.ingredients.filter((_, i) => i !== idx),
  }));

  const moveIng = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    setForm((p) => {
      if (to < 0 || to >= p.ingredients.length) return p;
      const ings = [...p.ingredients];
      [ings[idx], ings[to]] = [ings[to], ings[idx]];
      return { ...p, ingredients: ings };
    });
  };

  const setStep = (idx: number, text: string) => {
    setForm((p) => { const s = [...p.steps]; s[idx] = { ...s[idx], text }; return { ...p, steps: s }; });
  };

  const addStep = () => setForm((p) => ({ ...p, steps: [...p.steps, emptyStep()] }));

  const removeStep = (idx: number) => setForm((p) => ({
    ...p, steps: p.steps.filter((_, i) => i !== idx),
  }));

  const moveStep = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    setForm((p) => {
      if (to < 0 || to >= p.steps.length) return p;
      const s = [...p.steps];
      [s[idx], s[to]] = [s[to], s[idx]];
      return { ...p, steps: s };
    });
  };

  const addSubStep = (stepIdx: number) => {
    setForm((p) => {
      const s = [...p.steps];
      s[stepIdx] = { ...s[stepIdx], subSteps: [...s[stepIdx].subSteps, ''] };
      return { ...p, steps: s };
    });
  };

  const setSubStep = (stepIdx: number, subIdx: number, val: string) => {
    setForm((p) => {
      const s = [...p.steps];
      const ss = [...s[stepIdx].subSteps];
      ss[subIdx] = val;
      s[stepIdx] = { ...s[stepIdx], subSteps: ss };
      return { ...p, steps: s };
    });
  };

  const removeSubStep = (stepIdx: number, subIdx: number) => {
    setForm((p) => {
      const s = [...p.steps];
      s[stepIdx] = { ...s[stepIdx], subSteps: s[stepIdx].subSteps.filter((_, i) => i !== subIdx) };
      return { ...p, steps: s };
    });
  };

  const showScanSelect = mode === 'scan' && scanPhase === 'select';
  const showScanAnimation = mode === 'scan' && scanPhase === 'scanning';
  const showUrlInput = mode === 'url' && urlPhase === 'input';
  const showUrlAnimation = mode === 'url' && urlPhase === 'importing';
  const showPasteInput = mode === 'paste' && pastePhase === 'input';
  const showPasteAnimation = mode === 'paste' && pastePhase === 'processing';
  const showForm = !showScanSelect && !showScanAnimation && !showUrlInput && !showUrlAnimation && !showPasteInput && !showPasteAnimation;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[calc(100vw-16px)] max-w-2xl p-0 gap-0 flex flex-col max-h-[95vh] overflow-hidden" hideClose>

          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b bg-card">
            <h2 className="font-semibold text-base">
              {showScanSelect ? 'Scan Recipe'
                : showScanAnimation ? 'Scanning…'
                : showUrlInput ? 'Import from URL'
                : showUrlAnimation ? 'Importing…'
                : showPasteInput ? 'Paste Recipe Text'
                : showPasteAnimation ? 'Extracting…'
                : editId ? 'Edit Recipe' : 'New Recipe'}
            </h2>
            <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>

          {/* ── SCAN: image select phase ─────────────────────────────── */}
          {showScanSelect && (
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="p-6 space-y-4">
                <input ref={scanFileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => setScanFiles(Array.from(e.target.files ?? []).slice(0, 10))} />

                {/* Drop zone */}
                <button type="button"
                  onClick={() => scanFileInputRef.current?.click()}
                  className="w-full rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 p-10 text-center hover:border-primary/40 hover:bg-primary/5 transition-all">
                  <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">Upload recipe images</p>
                  <p className="text-xs text-muted-foreground mt-1">Click to browse · Up to 10 images</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Cookbook pages, handwritten notes, or screenshots</p>
                </button>

                {scanFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{scanFiles.length} image{scanFiles.length > 1 ? 's' : ''} selected</p>
                    <div className="space-y-1">
                      {scanFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-xs">
                          <Camera className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate">{f.name}</span>
                          <button type="button" onClick={() => setScanFiles((p) => p.filter((_, j) => j !== i))}
                            className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {showScanSelect && (
            <div className="shrink-0 border-t bg-card px-4 pt-3 pb-4 space-y-2">
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button className="flex-1 gap-1.5" disabled={scanFiles.length === 0} onClick={scanImages}>
                  <Camera className="h-4 w-4" />Scan Now
                </Button>
              </div>
              <p className="text-center">
                <button type="button"
                  onClick={() => { setMode('paste'); setPastePhase('input'); setPasteText(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                  Paste text instead
                </button>
              </p>
            </div>
          )}

          {/* ── SCAN: animation phase ────────────────────────────────── */}
          {showScanAnimation && (
            <div className="flex-1 flex items-center justify-center">
              <CookingAnimation message="Scanning your recipe…" />
            </div>
          )}

          {/* ── URL: input phase ──────────────────────────────────── */}
          {showUrlInput && (
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="p-6 space-y-4">
                <div className="rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 p-8 text-center">
                  <Link2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">Import from a recipe website</p>
                  <p className="text-xs text-muted-foreground mt-1">Paste the full URL of any recipe page</p>
                </div>
                <div className="space-y-1.5">
                  <Input
                    className={cn('h-10 text-sm', urlError && 'border-destructive focus-visible:ring-destructive')}
                    placeholder="https://example.com/recipe"
                    value={urlInput}
                    onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && importUrl()}
                    autoFocus
                  />
                  {urlError ? (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />{urlError}
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Must start with https:// for security</p>
                  )}
                </div>
              </div>
            </div>
          )}
          {showUrlInput && (
            <div className="shrink-0 border-t bg-card px-4 pt-3 pb-4 space-y-2">
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button className="flex-1 gap-1.5" disabled={!urlInput.trim()} onClick={importUrl}>
                  <Link2 className="h-4 w-4" />Import
                </Button>
              </div>
              <p className="text-center">
                <button type="button"
                  onClick={() => { setMode('paste'); setPastePhase('input'); setPasteText(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                  Paste text instead
                </button>
              </p>
            </div>
          )}

          {/* ── URL: animation phase ──────────────────────────────── */}
          {showUrlAnimation && (
            <div className="flex-1 flex items-center justify-center">
              <CookingAnimation message="Importing recipe from URL…" />
            </div>
          )}

          {/* ── PASTE: input phase ────────────────────────────────── */}
          {showPasteInput && (
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="p-6 space-y-4">
                <div className="text-center pb-1">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Paste your recipe text</p>
                  <p className="text-xs text-muted-foreground mt-1">Copy and paste from anywhere — we'll automatically separate the ingredients from the steps</p>
                </div>
                <Textarea
                  className="resize-none text-sm min-h-[220px]"
                  placeholder="Paste recipe text here…"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}
          {showPasteInput && (
            <div className="shrink-0 flex gap-3 px-4 py-3 border-t bg-card">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1 gap-1.5" disabled={!pasteText.trim()} onClick={extractPaste}>
                <FileText className="h-4 w-4" />Extract Recipe
              </Button>
            </div>
          )}

          {/* ── PASTE: animation phase ────────────────────────────── */}
          {showPasteAnimation && (
            <div className="flex-1 flex items-center justify-center">
              <CookingAnimation message="Extracting recipe from text…" />
            </div>
          )}

          {/* ── NORMAL FORM ──────────────────────────────────────────── */}
          {showForm && (
            <>
              {/* Scan done banner */}
              {mode === 'scan' && scanPhase === 'done' && (
                <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Scanned — review and edit below</p>
                  </div>
                  <button type="button"
                    onClick={() => { setScanPhase('select'); setScanFiles([]); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                    Scan again
                  </button>
                </div>
              )}

              {/* URL done banner */}
              {mode === 'url' && urlPhase === 'done' && (
                <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Imported from URL — review and edit below</p>
                  </div>
                  <button type="button"
                    onClick={() => { setUrlPhase('input'); setUrlInput(''); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                    Try again
                  </button>
                </div>
              )}

              {/* Paste done banner */}
              {mode === 'paste' && pastePhase === 'done' && (
                <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Extracted — review and edit below</p>
                  </div>
                  <button type="button"
                    onClick={() => { setPastePhase('input'); setPasteText(''); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                    Try again
                  </button>
                </div>
              )}

              {/* Form body */}
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                  <div className="p-4 space-y-5">

                    {/* Title */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title *</label>
                      <Input className="h-9" placeholder="e.g. Grandma's Lasagne" value={form.title}
                        onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
                      <Textarea className="resize-none text-sm min-h-[120px]" placeholder="A short description…"
                        value={form.description}
                        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                    </div>

                    {/* Category + Servings */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category *</label>
                        <select
                          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                          value={form.categoryId}
                          onChange={(e) => {
                            if (e.target.value === '__create__') {
                              setNewCatName('');
                              setCreateCatOpen(true);
                            } else {
                              setForm((p) => ({ ...p, categoryId: e.target.value }));
                            }
                          }}>
                          <option value="" disabled>Select a category…</option>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          <option value="__create__">+ Create new category…</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Servings *</label>
                        <Input className="h-9" type="number" min="1" placeholder="4" value={form.baseServings}
                          onChange={(e) => setForm((p) => ({ ...p, baseServings: e.target.value }))} />
                      </div>
                    </div>

                    {/* Photos */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Photos</label>
                        <button type="button" onClick={() => photoInputRef.current?.click()}
                          className="flex items-center gap-1 text-xs text-primary hover:underline transition-colors">
                          <ImagePlus className="h-3.5 w-3.5" />Add photos
                        </button>
                      </div>
                      <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => { addPhotos(Array.from(e.target.files ?? [])); e.target.value = ''; }} />

                      {activeFormImages.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                          {activeFormImages.map((img, idx) => (
                            <div key={img.id ?? img.url} className="relative group aspect-square rounded-lg overflow-hidden border">
                              <img src={img.url} alt="" className="h-full w-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => movePhoto(idx, -1)} disabled={idx === 0}
                                    className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 disabled:opacity-30 transition-colors">
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" onClick={() => movePhoto(idx, 1)} disabled={idx === activeFormImages.length - 1}
                                    className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 disabled:opacity-30 transition-colors">
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <button type="button" onClick={() => removePhoto(idx)}
                                  className="h-7 w-7 rounded-full bg-red-500/70 flex items-center justify-center text-white hover:bg-red-500 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center font-bold">
                                {idx + 1}
                              </span>
                            </div>
                          ))}
                          <button type="button" onClick={() => photoInputRef.current?.click()}
                            className="aspect-square rounded-lg border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-all">
                            <Plus className="h-5 w-5" />
                            <span className="text-[10px]">Add more</span>
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => photoInputRef.current?.click()}
                          className="w-full rounded-xl border-2 border-dashed border-border/60 bg-muted/20 py-6 text-center hover:border-primary/40 hover:bg-primary/5 transition-all">
                          <Camera className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
                          <p className="text-xs text-muted-foreground">Click to upload recipe photos</p>
                        </button>
                      )}
                    </div>

                    {/* Ingredients */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredients *</label>
                      <div className="space-y-2">
                        {form.ingredients.map((ing, idx) => (
                          <div key={idx} className="flex items-start gap-1.5">
                            <div className="flex flex-col gap-0.5 shrink-0 pt-1.5">
                              <button type="button" onClick={() => moveIng(idx, -1)} disabled={idx === 0}
                                className="disabled:opacity-25 hover:text-primary transition-colors">
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button type="button" onClick={() => moveIng(idx, 1)} disabled={idx === form.ingredients.length - 1}
                                className="disabled:opacity-25 hover:text-primary transition-colors">
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                            <Input className="h-8 text-xs w-16 shrink-0" placeholder="Qty" value={ing.quantity}
                              onChange={(e) => setIng(idx, 'quantity', e.target.value)} />
                            <Input className="h-8 text-xs w-16 shrink-0" placeholder="Unit" value={ing.unit}
                              onChange={(e) => setIng(idx, 'unit', e.target.value)} />
                            <Input className="h-8 text-xs flex-1 min-w-0" placeholder="Ingredient name *" value={ing.name}
                              onChange={(e) => setIng(idx, 'name', e.target.value)} />
                            <Input className="h-8 text-xs w-28 shrink-0" placeholder="Note" value={ing.note}
                              onChange={(e) => setIng(idx, 'note', e.target.value)} />
                            <button type="button" onClick={() => removeIng(idx)}
                              className="pt-1.5 shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                              <Minus className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={addIng}>
                        <Plus className="h-3.5 w-3.5" />Add Ingredient
                      </Button>
                    </div>

                    {/* Steps */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Steps *</label>
                      <div className="space-y-3">
                        {form.steps.map((step, idx) => (
                          <div key={idx} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="shrink-0 flex flex-col items-center gap-0.5 pt-2">
                                <span className="text-[10px] font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                                <button type="button" onClick={() => moveStep(idx, -1)} disabled={idx === 0}
                                  className="disabled:opacity-25 hover:text-primary transition-colors">
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button type="button" onClick={() => moveStep(idx, 1)} disabled={idx === form.steps.length - 1}
                                  className="disabled:opacity-25 hover:text-primary transition-colors">
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                              </div>
                              <Textarea className="resize-none text-sm flex-1 min-h-[64px]" placeholder={`Step ${idx + 1}…`}
                                value={step.text} onChange={(e) => setStep(idx, e.target.value)} />
                              <button type="button" onClick={() => removeStep(idx)}
                                className="pt-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                                <Minus className="h-4 w-4" />
                              </button>
                            </div>
                            {/* Sub-steps */}
                            {step.subSteps.length > 0 && (
                              <div className="ml-7 space-y-1.5">
                                {step.subSteps.map((ss, si) => (
                                  <div key={si} className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground shrink-0">{String.fromCharCode(97 + si)}.</span>
                                    <input
                                      className="flex-1 text-sm border rounded px-2 py-1 bg-background"
                                      placeholder={`Sub-step ${String.fromCharCode(97 + si)}…`}
                                      value={ss}
                                      onChange={(e) => setSubStep(idx, si, e.target.value)}
                                    />
                                    <button type="button" onClick={() => removeSubStep(idx, si)}
                                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                                      <Minus className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <button type="button" onClick={() => addSubStep(idx)}
                              className="ml-7 text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                              <Plus className="h-3 w-3" />Add sub-step
                            </button>
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={addStep}>
                        <Plus className="h-3.5 w-3.5" />Add Step
                      </Button>
                    </div>
                  </div>
                </div>

              {/* Footer */}
              <div className="shrink-0 flex gap-3 px-4 py-3 border-t bg-card">
                <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button className="flex-1" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? 'Save Changes' : 'Save Recipe'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create category modal (nested) */}
      <Dialog open={createCatOpen} onOpenChange={setCreateCatOpen}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-sm p-0 gap-0" hideClose>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">New Category</h3>
            <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
          <div className="p-4 space-y-3">
            <Input
              placeholder="Category name…"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newCatName.trim()) createCategoryMutation.mutate(newCatName.trim()); }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCreateCatOpen(false)}>Cancel</Button>
              <Button className="flex-1" disabled={!newCatName.trim() || createCategoryMutation.isPending}
                onClick={() => createCategoryMutation.mutate(newCatName.trim())}>
                {createCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Recipe Detail Modal ──────────────────────────────────────────────────────

function RecipeDetailModal({ recipeId, open, onClose, onEdit, onDelete }: {
  recipeId: string | null; open: boolean; onClose: () => void;
  onEdit: (r: RecipeDetail) => void; onDelete: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [system, setSystem] = useMeasureSystem();
  const [servings, setServings] = useState<number | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Cook session state
  const [cookSession, setCookSession] = useState<CookSession | null>(null);
  const [cookLoading, setCookLoading] = useState(false);
  const [localTicked, setLocalTicked] = useState<Set<string>>(new Set());
  const [localStepsTicked, setLocalStepsTicked] = useState<Set<number>>(new Set());
  const [showComplete, setShowComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiFading, setConfettiFading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // Complete screen: pantryItem.id → PantryChange
  const [pendingStockChanges, setPendingStockChanges] = useState<Record<string, PantryChange>>({});
  const [shoppingAdditions, setShoppingAdditions] = useState<Set<string>>(new Set());
  // pantryItem.id → toggled on/off for shopping list addition
  const [pantryShopToggles, setPantryShopToggles] = useState<Record<string, boolean>>({});
  // pantryItem.id → shopping list entry details
  const [pantryShopDetails, setPantryShopDetails] = useState<Record<string, { qty: string; unit: string; note: string }>>({});
  // Add-to-shopping-list modal for ingredient cart button
  const [shopModal, setShopModal] = useState<{
    name: string; qty: string; unit: string; note: string;
    files: File[];
    pantryItem: PantryItemSummary | null;
  } | null>(null);
  const [shopSubmitting, setShopSubmitting] = useState(false);
  const shopImgRef = useRef<HTMLInputElement>(null);
  const [completing, setCompleting] = useState(false);
  const saveTickRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: recipe, isLoading } = useQuery({
    queryKey: queryKeys.recipeBook.recipe(recipeId ?? ''),
    queryFn: async () => {
      const r = await api.get<RecipeDetail>(`/api/recipe-book/recipes/${recipeId}`);
      return {
        ...r,
        steps: (r.steps as unknown as (RecipeStep | string)[]).map((s) =>
          typeof s === 'string' ? { text: s, subSteps: [] } : s
        ),
      };
    },
    enabled: open && !!recipeId,
  });

  const { data: pantryItems = [] } = useQuery({
    queryKey: queryKeys.pantry.items(),
    queryFn: () => api.get<PantryItemSummary[]>('/api/pantry/items'),
    enabled: open,
  });

  // Check for an active cook session for this recipe
  const { data: activeSession } = useQuery({
    queryKey: ['cook-session', 'active', recipeId ?? ''],
    queryFn: () => api.get<CookSession | null>(`/api/cook-sessions/active?recipeId=${recipeId}`),
    enabled: open && !!recipeId,
  });

  // Hydrate cook session when active session loads
  useEffect(() => {
    if (activeSession) {
      setCookSession(activeSession);
      setLocalTicked(new Set(activeSession.pendingChanges?.ticked ?? []));
      setLocalStepsTicked(new Set(activeSession.pendingChanges?.tickedSteps ?? []));
    }
  }, [activeSession]);

  const pantryMap = new Map(pantryItems.map((p) => [p.ingredientId, p.inStock]));
  const pantryByIngredientId = new Map(pantryItems.map((p) => [p.ingredientId, p]));

  const { data: shoppingListItems = [] } = useQuery({
    queryKey: queryKeys.shoppingList.items(),
    queryFn: () => api.get<{ id: string; name: string }[]>('/api/shopping-list/items'),
    enabled: open,
  });

  const [dupConfirm, setDupConfirm] = useState<{ name: string; quantity: number | null; unit: string | null; note: string | null } | null>(null);

  const addToShoppingList = useMutation({
    mutationFn: ({ name, quantity, unit, note }: { name: string; quantity?: number | null; unit?: string | null; note?: string | null }) =>
      api.post('/api/shopping-list/items', { name, quantity: quantity ?? null, unit: unit ?? null, note: note ?? null, source: 'RECIPE' }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() }); toast.success('Added to shopping list'); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const openAddToShop = (ingName: string) => {
    const simplified = simplifyIngredientName(ingName);
    // Find ingredient by name to get its ingredientId, then look up pantry
    const ing = recipe?.ingredients.find((i) => i.name === ingName || simplifyIngredientName(i.name) === simplified);
    const pantryItem = ing ? (pantryByIngredientId.get(ing.ingredientId) ?? null) : null;
    setShopModal({
      name: simplified,
      qty: pantryItem?.quantity != null ? String(pantryItem.quantity) : '',
      unit: pantryItem?.unit ?? '',
      note: pantryItem?.notes ?? '',
      files: [],
      pantryItem,
    });
  };

  const confirmShopModal = async () => {
    if (!shopModal || shopSubmitting) return;
    const qty = shopModal.qty ? Number(shopModal.qty) : null;
    const unit = shopModal.unit.trim() || null;
    const note = shopModal.note.trim() || null;
    const alreadyOn = shoppingListItems.some((i) => i.name.toLowerCase() === shopModal.name.toLowerCase());
    if (alreadyOn) {
      setDupConfirm({ name: shopModal.name, quantity: qty, unit, note });
      setShopModal(null);
      return;
    }
    setShopSubmitting(true);
    try {
      const created = await api.post<{ id: string }>('/api/shopping-list/items', {
        name: shopModal.name, quantity: qty, unit, note, source: 'RECIPE',
      });
      for (const file of shopModal.files) {
        const form = new FormData();
        form.append('image', file);
        await api.postForm(`/api/shopping-list/items/${created.id}/images`, form).catch(() => {});
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
      toast.success('Added to shopping list');
      setShopModal(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setShopSubmitting(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/recipe-book/recipes/${recipeId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recipe-book'] });
      toast.success('Recipe deleted');
      onDelete(recipeId!);
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  useEffect(() => {
    if (open) {
      setImgIdx(0); setLightboxIdx(null); setExpandedStep(null); setConfirmDelete(false);
      setShowComplete(false); setShowConfetti(false); setConfettiFading(false); setShowSuccess(false); setPendingStockChanges({}); setShoppingAdditions(new Set()); setPantryShopToggles({}); setPantryShopDetails({}); setShopModal(null);
    }
  }, [open, recipeId]);


  useEffect(() => {
    if (!open) {
      setCookSession(null); setLocalTicked(new Set()); setLocalStepsTicked(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (recipe) setServings(recipe.baseServings);
  }, [recipe?.id]);

  // Debounced save of ticked state to backend
  const persistTicked = useCallback((session: CookSession, ticked: Set<string>, steps: Set<number>) => {
    clearTimeout(saveTickRef.current);
    saveTickRef.current = setTimeout(async () => {
      try {
        await api.patch(`/api/cook-sessions/${session.id}/pending-changes`, {
          pendingChanges: {
            ticked: [...ticked],
            tickedSteps: [...steps],
            pantryChanges: session.pendingChanges?.pantryChanges ?? [],
            extraChanges: session.pendingChanges?.extraChanges ?? [],
          },
        });
      } catch {}
    }, 700);
  }, []);

  const toggleIngredient = useCallback((ingredientId: string) => {
    if (!cookSession) return;
    setLocalTicked((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId); else next.add(ingredientId);
      persistTicked(cookSession, next, localStepsTicked);
      return next;
    });
  }, [cookSession, localStepsTicked, persistTicked]);

  const toggleStep = useCallback((idx: number) => {
    if (!cookSession) return;
    setLocalStepsTicked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      persistTicked(cookSession, localTicked, next);
      return next;
    });
  }, [cookSession, localTicked, persistTicked]);

  const tickAllIngredients = useCallback(() => {
    if (!cookSession || !recipe) return;
    setLocalTicked((prev) => {
      const allIds = recipe.ingredients.map((i) => i.ingredientId);
      const allTicked = allIds.every((id) => prev.has(id));
      const next = allTicked ? new Set<string>() : new Set(allIds);
      persistTicked(cookSession, next, localStepsTicked);
      return next;
    });
  }, [cookSession, recipe, localStepsTicked, persistTicked]);

  const tickAllSteps = useCallback(() => {
    if (!cookSession || !recipe) return;
    setLocalStepsTicked((prev) => {
      const allIdxs = recipe.steps.map((_, i) => i);
      const allTicked = allIdxs.every((i) => prev.has(i));
      const next = allTicked ? new Set<number>() : new Set(allIdxs);
      persistTicked(cookSession, localTicked, next);
      return next;
    });
  }, [cookSession, recipe, localTicked, persistTicked]);

  const startCooking = async () => {
    if (!recipe) return;
    setCookLoading(true);
    try {
      const session = await api.post<CookSession>('/api/cook-sessions', { recipeId: recipe.id });
      setCookSession(session);
      setLocalTicked(new Set(session.pendingChanges?.ticked ?? []));
      setLocalStepsTicked(new Set(session.pendingChanges?.tickedSteps ?? []));
      void queryClient.invalidateQueries({ queryKey: ['cook-session', 'active', recipeId ?? ''] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to start cook session');
    } finally {
      setCookLoading(false);
    }
  };

  const cancelCooking = async () => {
    if (!cookSession) return;
    try {
      await api.post(`/api/cook-sessions/${cookSession.id}/cancel`);
      setCookSession(null);
      setLocalTicked(new Set());
      setLocalStepsTicked(new Set());
      setShowComplete(false);
      void queryClient.invalidateQueries({ queryKey: ['cook-session', 'active', recipeId ?? ''] });
      void queryClient.invalidateQueries({ queryKey: ['cook-sessions', 'household-in-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['cook-sessions', 'household-history'] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to cancel');
    }
  };

  const openCompleteScreen = () => {
    if (!recipe) return;
    const initial: Record<string, PantryChange> = {};
    for (const ingId of localTicked) {
      const pi = pantryByIngredientId.get(ingId);
      if (pi) {
        initial[pi.id] = { inStock: pi.inStock, quantity: pi.quantity, unit: pi.unit, notes: pi.notes };
      }
    }
    setPendingStockChanges(initial);
    setShoppingAdditions(new Set());
    setPantryShopToggles({});
    setPantryShopDetails({});
    setShowComplete(true);
  };

  const togglePantryShop = (pi: PantryItemSummary) => {
    const newVal = !pantryShopToggles[pi.id];
    setPantryShopToggles((p) => ({ ...p, [pi.id]: newVal }));
    if (newVal && !pantryShopDetails[pi.id]) {
      setPantryShopDetails((p) => ({
        ...p,
        [pi.id]: {
          qty: pi.quantity != null ? String(pi.quantity) : '',
          unit: pi.unit ?? '',
          note: pi.notes ?? '',
        },
      }));
    }
  };

  const confirmComplete = async () => {
    if (!cookSession) return;
    setCompleting(true);
    try {
      const pantryChanges = Object.entries(pendingStockChanges).map(([itemId, ch]) => ({
        itemId, inStock: ch.inStock, quantity: ch.quantity, unit: ch.unit, notes: ch.notes,
      }));
      await api.post(`/api/cook-sessions/${cookSession.id}/complete`, { pantryChanges });

      // Add pantry-toggled items to shopping list
      if (recipe) {
        for (const ing of recipe.ingredients.filter((i) => localTicked.has(i.ingredientId))) {
          const pi = pantryByIngredientId.get(ing.ingredientId);
          if (!pi || !pantryShopToggles[pi.id]) continue;
          const d = pantryShopDetails[pi.id];
          await api.post('/api/shopping-list/items', {
            name: pi.ingredientName,
            quantity: d?.qty ? Number(d.qty) : null,
            unit: d?.unit.trim() || null,
            note: d?.note.trim() || null,
            source: 'RECIPE',
          }).catch(() => {});
        }
      }
      // Add out-of-stock / not-in-pantry items
      for (const name of shoppingAdditions) {
        await api.post('/api/shopping-list/items', { name, source: 'RECIPE' }).catch(() => {});
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.items() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
      void queryClient.invalidateQueries({ queryKey: ['cook-session', 'active', recipeId ?? ''] });
      void queryClient.invalidateQueries({ queryKey: ['cook-sessions', 'household-in-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['cook-sessions', 'household-history'] });

      setShowComplete(false);
      setCookSession(null);
      setLocalTicked(new Set());
      setLocalStepsTicked(new Set());
      setShowConfetti(true);
      setConfettiFading(false);
      setShowSuccess(true);
      setTimeout(() => setConfettiFading(true), 3500);
      setTimeout(() => setShowConfetti(false), 5500);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to complete');
    } finally {
      setCompleting(false);
    }
  };

  if (!open) return null;

  const base = recipe?.baseServings ?? 1;
  const effective = servings ?? base;
  const images = recipe?.images ? [...recipe.images].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const isCooking = !!cookSession;

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-16px)] max-w-2xl p-0 gap-0 flex flex-col h-[92vh] overflow-hidden" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        {images.length > 0 ? (
          <div className="relative shrink-0 h-48 bg-muted overflow-hidden">
            <img src={images[imgIdx].url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <button type="button"
              onClick={() => setLightboxIdx(imgIdx)}
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-white text-[10px] font-medium hover:bg-black/70 transition-colors z-10">
              <Maximize2 className="h-3 w-3" />Expand
            </button>
            {images.length > 1 && (
              <>
                <button type="button" onClick={(e) => { e.stopPropagation(); setImgIdx((i) => Math.max(0, i - 1)); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); setImgIdx((i) => Math.min(images.length - 1, i + 1)); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setImgIdx(i); }}
                      className={cn('h-1.5 rounded-full transition-all', i === imgIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50')} />
                  ))}
                </div>
              </>
            )}
            <DialogClose className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
              onClick={(e) => e.stopPropagation()}>
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
        ) : (
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
            <div />
            <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
        )}

        {/* ── Title + edit/delete — outside scroll so the Slider can't push it off ── */}
        {!isLoading && recipe && (
          <div className="shrink-0 px-4 pt-4 pb-3 border-b">
            <div className="flex items-start gap-2">
              <h2 className="flex-1 font-bold text-xl leading-tight">{recipe.title}</h2>
              {!isCooking && (
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" onClick={() => onEdit(recipe)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border hover:bg-accent transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            {recipe.categoryName && (
              <Badge variant="secondary" className="mt-1.5 text-[10px]">{recipe.categoryName}</Badge>
            )}
            {recipe.description && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{recipe.description}</p>
            )}
          </div>
        )}

        {/* ── Cook in-progress banner — outside scroll ── */}
        {!isLoading && recipe && isCooking && (
          <div className="shrink-0 mx-4 mt-3 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2">
            <ChefHat className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs font-semibold text-primary flex-1">
              {cookSession?.resumed ? 'Resuming cook session' : 'Cooking in progress'}
            </p>
            <span className="text-[10px] text-primary/70">Tick as you go</span>
          </div>
        )}

        {/* ── Servings + metric — outside scroll, no focusable element inside scroll ── */}
        {!isLoading && recipe && !isCooking && (
          <div className="shrink-0 px-4 pt-3 pb-4 border-b">
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Servings</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setServings((s) => Math.max(1, (s ?? base) - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border hover:bg-accent transition-colors">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{effective}</span>
                  <button type="button" onClick={() => setServings((s) => (s ?? base) + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border hover:bg-accent transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <Slider value={[effective]} min={1} max={Math.max(base * 4, 20)} step={1}
                onValueChange={([v]) => setServings(v)} className="py-0" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Base: {base} servings</span>
                <div className="flex items-center rounded-full border p-0.5 bg-muted/30">
                  <button type="button" onClick={() => setSystem('metric')}
                    className={cn('text-[10px] px-2.5 py-0.5 rounded-full transition-colors font-medium',
                      system === 'metric' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    Metric
                  </button>
                  <button type="button" onClick={() => setSystem('imperial')}
                    className={cn('text-[10px] px-2.5 py-0.5 rounded-full transition-colors font-medium',
                      system === 'imperial' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    Imperial
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
          </div>
        )}

        {/* ── Scrollable content: pantry legend + ingredients + steps + cook button ── */}
        {!isLoading && recipe && (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="p-4 space-y-5">
              {!isCooking && (
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><PantryIcon status="in-stock" />In stock</span>
                  <span className="flex items-center gap-1"><PantryIcon status="missing" />Out of stock</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Ingredients</h3>
                  {isCooking && (
                    <button type="button" onClick={tickAllIngredients}
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors">
                      {recipe.ingredients.every((i) => localTicked.has(i.ingredientId)) ? 'Untick all' : 'Tick all'}
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {recipe.ingredients.map((ing) => {
                    const status = pantryStatus(ing.ingredientId, pantryMap);
                    const scaled = scaleQty(ing.quantity, base, effective);
                    const converted = convertQty(scaled, ing.unit, system);
                    const ticked = localTicked.has(ing.ingredientId);
                    return (
                      <div key={ing.id} className={cn(
                        'flex items-center gap-2 rounded-lg border bg-card px-3 py-2 transition-opacity',
                        ticked && 'opacity-40',
                      )}>
                        {isCooking ? (
                          <button type="button" onClick={() => toggleIngredient(ing.ingredientId)}
                            className="shrink-0 text-primary hover:text-primary/70 transition-colors">
                            {ticked
                              ? <CheckSquare className="h-4 w-4" />
                              : <Square className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        ) : (
                          <PantryIcon status={status} />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className={cn('text-sm', ticked && 'line-through')}>
                            {converted.qty && <span className="font-medium">{converted.qty} {converted.unit} </span>}
                            {ing.name}
                            {ing.note && <span className="text-muted-foreground text-xs"> — {ing.note}</span>}
                          </span>
                        </div>
                        {!isCooking && (
                          <button type="button" title="Add to shopping list"
                            onClick={() => openAddToShop(ing.name)}
                            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground shrink-0">
                            <ShoppingCart className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Method</h3>
                  {isCooking && (
                    <button type="button" onClick={tickAllSteps}
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors">
                      {recipe.steps.every((_, i) => localStepsTicked.has(i)) ? 'Untick all' : 'Tick all'}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {recipe.steps.map((step, i) => {
                    const converted = convertStepText(step.text, system);
                    const hasSubSteps = step.subSteps.length > 0;
                    const isExpanded = expandedStep === i;
                    const stepTicked = localStepsTicked.has(i);
                    return (
                      <div key={i} className={cn('rounded-xl border bg-card transition-opacity', stepTicked && 'opacity-40')}>
                        <div className="flex items-start gap-3 px-3 py-3">
                          {isCooking ? (
                            <button type="button" onClick={() => toggleStep(i)}
                              className="shrink-0 mt-0.5 text-primary hover:text-primary/70 transition-colors">
                              {stepTicked
                                ? <CheckSquare className="h-5 w-5" />
                                : <Square className="h-5 w-5 text-muted-foreground" />}
                            </button>
                          ) : (
                            <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                              {i + 1}
                            </span>
                          )}
                          <p className={cn('flex-1 text-sm leading-relaxed', stepTicked && 'line-through')}>{converted}</p>
                          {hasSubSteps && (
                            <button type="button" onClick={() => setExpandedStep(isExpanded ? null : i)}
                              className="shrink-0 mt-1 text-muted-foreground">
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                        {hasSubSteps && isExpanded && (
                          <div className="px-3 pb-3 ml-9 space-y-1.5">
                            {step.subSteps.map((ss, si) => (
                              <div key={si} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <span className="shrink-0 text-xs font-medium mt-0.5">{String.fromCharCode(97 + si)}.</span>
                                <span>{ss}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cook button — only when not in cook mode */}
              {!isCooking && recipe && (
                <div className="pb-2">
                  <Button className="w-full gap-2" onClick={startCooking} disabled={cookLoading}>
                    {cookLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChefHat className="h-4 w-4" />}
                    Start Cooking
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cook footer — cancel + complete */}
        {isCooking && !confirmDelete && (
          <div className="shrink-0 border-t bg-card px-4 py-3 flex gap-2">
            <Button variant="outline" className="flex-1 text-sm" onClick={cancelCooking}>
              Cancel
            </Button>
            <Button className="flex-1 gap-1.5 text-sm" onClick={openCompleteScreen}>
              <Check className="h-4 w-4" />Complete
            </Button>
          </div>
        )}

        {confirmDelete && (
          <div className="shrink-0 border-t bg-destructive/5 px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-destructive">Delete this recipe?</p>
            <p className="text-xs text-muted-foreground">This cannot be undone.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Complete cook screen overlay ───────────────────────────────── */}
        {showComplete && recipe && (
          <div className="absolute inset-0 z-20 bg-background flex flex-col">
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-base">Finishing Up</h3>
              <button type="button" onClick={() => setShowComplete(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4">
              {/* Pantry stock update — in/out of stock toggles */}
              {(() => {
                const pantryIngredients = recipe.ingredients.filter(
                  (ing) => localTicked.has(ing.ingredientId) && pantryByIngredientId.has(ing.ingredientId)
                );
                if (pantryIngredients.length > 0) return (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Update Pantry</p>
                    <p className="text-[11px] text-muted-foreground">Confirm the stock status after cooking.</p>
                    {pantryIngredients.map((ing) => {
                      const pi = pantryByIngredientId.get(ing.ingredientId)!;
                      const ch = pendingStockChanges[pi.id] ?? { inStock: pi.inStock, quantity: pi.quantity, unit: pi.unit, notes: pi.notes };
                      const set = (patch: Partial<PantryChange>) => setPendingStockChanges((p) => ({ ...p, [pi.id]: { ...ch, ...patch } }));
                      const shopOn = !!pantryShopToggles[pi.id];
                      const sd = pantryShopDetails[pi.id] ?? { qty: '', unit: '', note: '' };
                      const setShopDetail = (patch: Partial<typeof sd>) =>
                        setPantryShopDetails((p) => ({ ...p, [pi.id]: { ...sd, ...patch } }));
                      return (
                        <div key={ing.id} className="rounded-xl border bg-card p-3 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium">{ing.name}</span>
                            <button type="button"
                              onClick={() => togglePantryShop(pi)}
                              title={shopOn ? 'Remove from shopping list' : 'Add to shopping list'}
                              className={cn(
                                'shrink-0 flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                                shopOn ? 'bg-primary text-primary-foreground' : 'border text-muted-foreground hover:text-foreground hover:bg-accent',
                              )}>
                              <ShoppingCart className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 rounded-xl border p-0.5 bg-muted/30 w-fit">
                            <button type="button" onClick={() => set({ inStock: true })}
                              className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                                ch.inStock ? 'bg-green-500 text-white' : 'text-muted-foreground hover:text-foreground')}>
                              In Stock
                            </button>
                            <button type="button" onClick={() => set({ inStock: false })}
                              className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                                !ch.inStock ? 'bg-red-500 text-white' : 'text-muted-foreground hover:text-foreground')}>
                              Out of Stock
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <input type="number" min="1" max="999" placeholder="Qty"
                              value={ch.quantity ?? ''}
                              onChange={(e) => set({ quantity: e.target.value ? Number(e.target.value) : null })}
                              className="h-8 w-16 rounded-md border bg-background px-2 text-xs" />
                            <input type="text" placeholder="Unit (e.g. kg)"
                              value={ch.unit ?? ''}
                              onChange={(e) => set({ unit: e.target.value || null })}
                              className="h-8 flex-1 rounded-md border bg-background px-2 text-xs" />
                          </div>
                          <input type="text" placeholder="Note…"
                            value={ch.notes ?? ''}
                            onChange={(e) => set({ notes: e.target.value || null })}
                            className="h-8 w-full rounded-md border bg-background px-2 text-xs" />
                          {shopOn && (
                            <div className="border-t pt-3 space-y-2">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <ShoppingCart className="h-3 w-3" />Shopping List Entry
                              </p>
                              <div className="flex gap-2">
                                <input type="number" min="1" max="999" placeholder="Qty"
                                  value={sd.qty}
                                  onChange={(e) => setShopDetail({ qty: e.target.value })}
                                  className="h-8 w-16 rounded-md border bg-background px-2 text-xs" />
                                <input type="text" placeholder="Unit"
                                  value={sd.unit}
                                  onChange={(e) => setShopDetail({ unit: e.target.value })}
                                  className="h-8 flex-1 rounded-md border bg-background px-2 text-xs" />
                              </div>
                              <input type="text" placeholder="Note for shopping list…"
                                value={sd.note}
                                onChange={(e) => setShopDetail({ note: e.target.value })}
                                className="h-8 w-full rounded-md border bg-background px-2 text-xs" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
                return null;
              })()}

              {/* Not-in-pantry ticked ingredients → shopping list */}
              {(() => {
                const missing = recipe.ingredients.filter(
                  (ing) => localTicked.has(ing.ingredientId) && !pantryByIngredientId.has(ing.ingredientId)
                );
                if (missing.length > 0) return (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Not in Pantry — Add to Shopping List?</p>
                    {missing.map((ing) => (
                      <button key={ing.id} type="button"
                        onClick={() => setShoppingAdditions((p) => {
                          const n = new Set(p);
                          if (n.has(ing.name)) n.delete(ing.name); else n.add(ing.name);
                          return n;
                        })}
                        className={cn(
                          'w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors text-left',
                          shoppingAdditions.has(ing.name)
                            ? 'border-primary bg-primary/5 text-primary font-medium'
                            : 'border-border hover:bg-accent/40',
                        )}>
                        <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
                        {ing.name}
                        {shoppingAdditions.has(ing.name) && <Check className="h-3.5 w-3.5 ml-auto" />}
                      </button>
                    ))}
                  </div>
                );
                return null;
              })()}

              {localTicked.size === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No ingredients ticked — tap Confirm to mark the recipe as cooked.
                </div>
              )}
            </div>

            <div className="shrink-0 border-t bg-card px-4 py-3 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowComplete(false)}>Go Back</Button>
              <Button className="flex-1 gap-1.5" disabled={completing} onClick={confirmComplete}>
                {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirm & Complete
              </Button>
            </div>
          </div>
        )}

        {/* Image lightbox */}
        {lightboxIdx !== null && (
          <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center">
            <button type="button"
              onClick={() => setLightboxIdx(null)}
              className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
              <X className="h-5 w-5" />
            </button>
            {images.length > 1 && (
              <>
                <button type="button"
                  onClick={() => setLightboxIdx((i) => ((i ?? 0) - 1 + images.length) % images.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                  <ChevronLeft className="h-5 w-5 lg:h-6 lg:w-6" />
                </button>
                <button type="button"
                  onClick={() => setLightboxIdx((i) => ((i ?? 0) + 1) % images.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                  <ChevronRight className="h-5 w-5 lg:h-6 lg:w-6" />
                </button>
              </>
            )}
            <img
              src={images[lightboxIdx].url}
              alt=""
              className="max-h-[60vh] max-w-[80vw] sm:max-h-[70vh] sm:max-w-[85vw] lg:max-h-[90vh] lg:max-w-[90vw] object-contain rounded-xl shadow-2xl"
            />
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {images.map((_, i) => (
                  <button key={i} type="button"
                    onClick={() => setLightboxIdx(i)}
                    className={cn('h-2 rounded-full transition-all', i === lightboxIdx ? 'w-6 bg-foreground' : 'w-2 bg-foreground/30')} />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Confetti overlay */}
    {showConfetti && <Confetti fading={confettiFading} />}

    {/* Recipe complete success modal */}
    <Dialog open={showSuccess} onOpenChange={(o) => !o && setShowSuccess(false)}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm p-0 gap-0" hideClose>
        <div className="flex flex-col items-center gap-5 px-6 py-8 text-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <ChefHat className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 shadow-md">
              <Check className="h-4 w-4 text-white" strokeWidth={3} />
            </div>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold tracking-tight">Recipe Complete!</h2>
            <p className="text-sm text-muted-foreground">
              Great cook! Your pantry has been updated and the session is saved.
            </p>
          </div>
          <Button className="w-full" onClick={() => setShowSuccess(false)}>
            Back to Recipe
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Duplicate shopping list confirm */}
    <Dialog open={!!dupConfirm} onOpenChange={(o) => !o && setDupConfirm(null)}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm p-0 gap-0" hideClose>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Already on Shopping List</h3>
          <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{dupConfirm?.name}</span> is already on your shopping list. Add it again anyway?
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDupConfirm(null)}>Skip</Button>
            <Button className="flex-1" onClick={() => {
              if (dupConfirm) addToShoppingList.mutate({ name: dupConfirm.name, quantity: dupConfirm.quantity, unit: dupConfirm.unit, note: dupConfirm.note });
              setDupConfirm(null);
            }}>Add Again</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {/* Add-to-shopping-list modal (ingredient cart button) */}
    <Dialog open={!!shopModal} onOpenChange={(o) => !o && setShopModal(null)}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-md p-0 gap-0" hideClose>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Add to Shopping List</h3>
          </div>
          <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        {shopModal && (
          <div className="px-4 py-4 space-y-3">
            {shopModal.pantryItem && shopModal.pantryItem.images.length > 0 && (
              <img src={shopModal.pantryItem.images[0].url} alt=""
                className="h-24 w-full object-cover rounded-xl border" />
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Item name</label>
              <input type="text" className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={shopModal.name}
                onChange={(e) => setShopModal((m) => m ? { ...m, name: e.target.value } : m)} />
            </div>
            {shopModal.pantryItem && (
              <p className="text-[11px] text-muted-foreground">
                Current pantry stock: {shopModal.pantryItem.inStock ? 'in stock' : 'out of stock'}
              </p>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Quantity</label>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => setShopModal((m) => m ? { ...m, qty: String(Math.max(1, (Number(m.qty) || 0) - 1)) } : m)}
                  className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md border hover:bg-accent transition-colors text-muted-foreground">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input type="number" min="1" className="h-8 flex-1 rounded-md border bg-background px-3 text-sm text-center"
                  value={shopModal.qty}
                  onChange={(e) => setShopModal((m) => m ? { ...m, qty: e.target.value } : m)} />
                <button type="button"
                  onClick={() => setShopModal((m) => m ? { ...m, qty: String((Number(m.qty) || 0) + 1) } : m)}
                  className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md border hover:bg-accent transition-colors text-muted-foreground">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Unit</label>
              <input type="text" placeholder="e.g. kg, cups…" className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={shopModal.unit}
                onChange={(e) => setShopModal((m) => m ? { ...m, unit: e.target.value } : m)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Note</label>
              <input type="text" placeholder="Add a note…" className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={shopModal.note}
                onChange={(e) => setShopModal((m) => m ? { ...m, note: e.target.value } : m)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Images</label>
              <div className="flex flex-wrap gap-2">
                {shopModal.files.map((file, idx) => (
                  <div key={idx} className="relative group">
                    <img src={URL.createObjectURL(file)} alt="" className="h-16 w-16 rounded-lg object-cover border" />
                    <button type="button"
                      onClick={() => setShopModal((m) => m ? { ...m, files: m.files.filter((_, i) => i !== idx) } : m)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => shopImgRef.current?.click()}
                  className="h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                  <ImagePlus className="h-5 w-5" />
                </button>
                <input ref={shopImgRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) setShopModal((m) => m ? { ...m, files: [...m.files, ...files] } : m);
                    e.target.value = '';
                  }} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShopModal(null)}>Cancel</Button>
              <Button className="flex-1" disabled={!shopModal.name.trim() || shopSubmitting}
                onClick={() => { void confirmShopModal(); }}>
                {shopSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add to List'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

// ─── Category Panel ───────────────────────────────────────────────────────────

interface DeleteFlow {
  cat: Category;
  step: 'choose' | 'create-new';
  targetCategoryId: string;
  newCategoryName: string;
}

function CategoryPanel({ open, onClose, categories }: {
  open: boolean; onClose: () => void; categories: Category[];
}) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [deleteFlow, setDeleteFlow] = useState<DeleteFlow | null>(null);

  useEffect(() => { if (!open) { setNewName(''); setDeleteFlow(null); } }, [open]);

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post<Category>('/api/recipe-book/categories', { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipeBook.categories() });
      setNewName('');
      toast.success('Category created');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ catId, targetCategoryId, newCategoryName }: {
      catId: string; targetCategoryId: string; newCategoryName: string;
    }) => {
      let finalTargetId = targetCategoryId;
      if (targetCategoryId === '__new__') {
        const created = await api.post<Category>('/api/recipe-book/categories', { name: newCategoryName.trim() });
        finalTargetId = created.id;
      }
      const recipesInCat = await api.get<RecipeSummary[]>(`/api/recipe-book/recipes?categoryId=${catId}`);
      for (const r of recipesInCat) {
        await api.patch(`/api/recipe-book/recipes/${r.id}`, { categoryId: finalTargetId });
      }
      await api.delete(`/api/recipe-book/categories/${catId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipeBook.categories() });
      void queryClient.invalidateQueries({ queryKey: ['recipe-book', 'recipes'] });
      setDeleteFlow(null);
      toast.success('Category deleted');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const otherCategories = deleteFlow ? categories.filter((c) => c.id !== deleteFlow.cat.id) : [];

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />}
      <div className={cn(
        'fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-background border-l shadow-2xl flex flex-col transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : 'translate-x-full',
      )}>
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Manage Categories</h2>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-5">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
            </p>
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">No categories yet — create one below.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <div key={cat.id}
                    className="group flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm font-medium hover:border-primary/40 hover:bg-primary/5 transition-all">
                    <span className="truncate max-w-[140px]">{cat.name}</span>
                    <button type="button"
                      onClick={() => setDeleteFlow({ cat, step: 'choose', targetCategoryId: '', newCategoryName: '' })}
                      className="h-4 w-4 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-0.5 shrink-0">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {deleteFlow && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-destructive">Delete "{deleteFlow.cat.name}"?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Move all recipes in this category first.</p>
                </div>
                <button type="button" onClick={() => setDeleteFlow(null)}
                  className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground shrink-0">
                  <X className="h-3 w-3" />
                </button>
              </div>

              {deleteFlow.step === 'choose' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium">Transfer recipes to:</p>
                  <div className="space-y-1.5">
                    {otherCategories.map((cat) => (
                      <button key={cat.id} type="button"
                        onClick={() => setDeleteFlow((f) => f ? { ...f, targetCategoryId: cat.id } : f)}
                        className={cn(
                          'w-full text-left flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                          deleteFlow.targetCategoryId === cat.id
                            ? 'border-primary bg-primary/5 text-primary font-medium'
                            : 'border-border hover:border-primary/40 hover:bg-accent/30',
                        )}>
                        <Tag className="h-3.5 w-3.5 shrink-0 opacity-60" />{cat.name}
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => setDeleteFlow((f) => f ? { ...f, targetCategoryId: '__new__', step: 'create-new' } : f)}
                      className={cn(
                        'w-full text-left flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                        deleteFlow.targetCategoryId === '__new__'
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-dashed border-border hover:border-primary/40 hover:bg-accent/30 text-muted-foreground',
                      )}>
                      <Plus className="h-3.5 w-3.5 shrink-0" />Create new category
                    </button>
                  </div>
                  {deleteFlow.targetCategoryId && deleteFlow.targetCategoryId !== '__new__' && (
                    <Button size="sm" className="w-full h-8 text-xs gap-1.5 bg-destructive hover:bg-destructive/90 mt-1"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate({ catId: deleteFlow.cat.id, targetCategoryId: deleteFlow.targetCategoryId, newCategoryName: '' })}>
                      {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Move &amp; Delete<ArrowRight className="h-3.5 w-3.5" /></>}
                    </Button>
                  )}
                </div>
              )}

              {deleteFlow.step === 'create-new' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium">New category name:</p>
                  <Input className="h-8 text-xs" placeholder="e.g. Other"
                    value={deleteFlow.newCategoryName}
                    onChange={(e) => setDeleteFlow((f) => f ? { ...f, newCategoryName: e.target.value } : f)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setDeleteFlow((f) => f ? { ...f, step: 'choose', targetCategoryId: '' } : f); }}
                    autoFocus />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs flex-1"
                      onClick={() => setDeleteFlow((f) => f ? { ...f, step: 'choose', targetCategoryId: '' } : f)}>
                      Back
                    </Button>
                    <Button size="sm" className="h-8 text-xs flex-1 gap-1 bg-destructive hover:bg-destructive/90"
                      disabled={!deleteFlow.newCategoryName.trim() || deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate({ catId: deleteFlow.cat.id, targetCategoryId: '__new__', newCategoryName: deleteFlow.newCategoryName })}>
                      {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Create &amp; Move<ArrowRight className="h-3.5 w-3.5" /></>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Add a category</p>
            <div className="flex gap-2">
              <Input className="h-9 text-sm flex-1" placeholder="Category name…"
                value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) createMutation.mutate(newName.trim()); }} />
              <Button size="sm" className="h-9 text-xs gap-1" disabled={!newName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(newName.trim())}>
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5" />Add</>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Recipe Card ──────────────────────────────────────────────────────────────

function RecipeCard({ recipe, onClick }: { recipe: RecipeSummary; onClick: () => void }) {
  const [imgIdx, setImgIdx] = useState(0);
  const imgs = recipe.images;

  return (
    <div className="group text-left rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-all hover:border-primary/30 cursor-pointer"
      onClick={onClick}>
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {imgs.length > 0 ? (
          <>
            <img src={imgs[imgIdx]} alt={recipe.title}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
            {imgs.length > 1 && (
              <>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); setImgIdx((i) => (i - 1 + imgs.length) % imgs.length); }}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); setImgIdx((i) => (i + 1) % imgs.length); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                  {imgs.map((_, i) => (
                    <span key={i} className={cn('h-1 rounded-full transition-all', i === imgIdx ? 'w-3 bg-white' : 'w-1 bg-white/50')} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <UtensilsCrossed className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="font-semibold text-sm leading-tight line-clamp-2">{recipe.title}</p>
        {recipe.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{recipe.description}</p>
        )}
      </div>
    </div>
  );
}

// ─── Sort type ────────────────────────────────────────────────────────────────

type SortBy = 'alpha' | 'z-alpha' | 'newest' | 'oldest';

// ─── Cooking History Tab ──────────────────────────────────────────────────────

function CookingHistoryTab({ entries, inProgressEntries, isLoading, onViewUser, onViewRecipe }: {
  entries: CookHistoryEntry[];
  inProgressEntries: InProgressSession[];
  isLoading: boolean;
  onViewUser: (u: { id: string; name: string | null; handle: string | null; image: string | null }) => void;
  onViewRecipe: (recipeId: string) => void;
}) {
  const [subTab, setSubTab] = useState<'in-progress' | 'completed'>('completed');
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: (sessionId: string) => api.post(`/api/cook-sessions/${sessionId}/cancel`),
    onSuccess: () => {
      setConfirmingCancelId(null);
      void queryClient.invalidateQueries({ queryKey: ['cook-sessions', 'household-in-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['cook-sessions', 'household-history'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to cancel session'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex rounded-xl border border-border/50 bg-muted/30 p-0.5 gap-0.5">
        {([
          { id: 'in-progress' as const, label: 'In Progress', count: inProgressEntries.length },
          { id: 'completed' as const, label: 'Completed', count: entries.length },
        ]).map(({ id, label, count }) => (
          <button key={id} type="button"
            onClick={() => setSubTab(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all',
              subTab === id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}>
            {label}
            {count > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                subTab === id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {subTab === 'in-progress' ? (
        inProgressEntries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <ChefHat className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">No active cook sessions</p>
              <p className="text-xs text-muted-foreground mt-1">Active sessions will appear here while cooking.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {inProgressEntries.map((entry) => (
              <div key={entry.id} className="rounded-xl border bg-card overflow-hidden flex gap-3 p-3">
                {entry.recipeImage ? (
                  <img src={entry.recipeImage} alt={entry.recipeTitle ?? ''} className="h-16 w-16 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                    <ChefHat className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{entry.recipeTitle ?? 'Deleted recipe'}</p>
                    {entry.recipeId && (
                      <button type="button" onClick={() => onViewRecipe(entry.recipeId!)}
                        className="shrink-0 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-full border border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10">
                        Continue
                      </button>
                    )}
                  </div>
                  <button type="button"
                    onClick={() => onViewUser({ id: entry.userId, name: entry.userName, handle: entry.userHandle, image: entry.userImage })}
                    className="flex items-center gap-1.5 mt-0.5 hover:opacity-70 transition-opacity">
                    {entry.userImage ? (
                      <img src={entry.userImage} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-muted-foreground">
                          {(entry.userName ?? entry.userHandle ?? '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground truncate">
                      {entry.userName ?? entry.userHandle ?? 'Unknown'}
                    </span>
                  </button>
                  {confirmingCancelId === entry.id ? (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[11px] text-muted-foreground">Cancel session?</span>
                      <button type="button"
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(entry.id)}
                        className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 transition-colors disabled:opacity-50">
                        Yes
                      </button>
                      <span className="text-muted-foreground opacity-40">·</span>
                      <button type="button" onClick={() => setConfirmingCancelId(null)}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">Cooking</span>
                      <span className="text-muted-foreground opacity-40">·</span>
                      <span className="text-[11px] text-muted-foreground">
                        Started {new Date(entry.startedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-muted-foreground opacity-40">·</span>
                      <button type="button" onClick={() => setConfirmingCancelId(entry.id)}
                        className="text-[11px] font-medium text-rose-500 hover:text-rose-600 transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">No cooking history yet</p>
              <p className="text-xs text-muted-foreground mt-1">Completed cook sessions will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-xl border bg-card overflow-hidden flex gap-3 p-3">
                {entry.recipeImage ? (
                  <img src={entry.recipeImage} alt={entry.recipeTitle ?? ''} className="h-16 w-16 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                    <ChefHat className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{entry.recipeTitle ?? 'Deleted recipe'}</p>
                    {entry.recipeId && (
                      <button type="button" onClick={() => onViewRecipe(entry.recipeId!)}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <button type="button"
                    onClick={() => onViewUser({ id: entry.userId, name: entry.userName, handle: entry.userHandle, image: entry.userImage })}
                    className="flex items-center gap-1.5 mt-0.5 hover:opacity-70 transition-opacity">
                    {entry.userImage ? (
                      <img src={entry.userImage} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-muted-foreground">
                          {(entry.userName ?? entry.userHandle ?? '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground truncate">
                      {entry.userName ?? entry.userHandle ?? 'Unknown'}
                    </span>
                  </button>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                    <span>Completed {new Date(entry.cookedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {entry.servings && (
                      <>
                        <span className="opacity-40">·</span>
                        <span>{entry.servings} serving{entry.servings !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                  {entry.note && <p className="mt-1 text-xs text-muted-foreground italic truncate">"{entry.note}"</p>}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ─── History User Modal ───────────────────────────────────────────────────────

function HistoryUserModal({ user, onClose, onViewRecipe }: {
  user: { id: string; name: string | null; handle: string | null; image: string | null } | null;
  onClose: () => void;
  onViewRecipe: (recipeId: string) => void;
}) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', user?.handle],
    queryFn: () => api.get<UserProfile>(`/api/users/${user!.handle}`),
    enabled: !!user?.handle,
  });

  const displayName = profile?.name ?? user?.name ?? user?.handle ?? 'Unknown';
  const displayHandle = profile?.handle ?? user?.handle;
  const displayImage = profile?.image ?? user?.image;
  const initial = displayName[0]?.toUpperCase() ?? '?';
  const activePins = (profile?.pins ?? []).filter((p) => p.recipeId !== null);

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]" hideClose>
        <DialogClose className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 border border-border/60 shadow-md text-foreground hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </DialogClose>

        {/* Banner with overlapping avatar */}
        <div className="relative h-16 bg-muted/40 border-b shrink-0">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <div className="rounded-full p-1 bg-background shadow-md ring-4 ring-background">
              {displayImage ? (
                <img src={displayImage} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-2xl font-bold text-muted-foreground">{initial}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="scrollbar-hide overflow-y-auto flex-1 pt-10 pb-5 px-5 space-y-4">
          {/* Name + handle */}
          <div className="text-center space-y-0.5">
            <p className="font-bold text-base">{displayName}</p>
            {displayHandle && <p className="text-muted-foreground text-sm">@{displayHandle}</p>}
          </div>

          {isLoading && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
            </div>
          )}

          {/* Bio */}
          {profile?.bio ? (
            <div className="rounded-xl bg-muted/50 border border-border/40 px-3 py-2.5">
              <p className="text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
            </div>
          ) : profile && (
            <p className="text-center text-xs text-muted-foreground italic">No bio yet.</p>
          )}

          {/* Pinned recipes */}
          {activePins.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Pinned Recipes</p>
              <div className="space-y-2.5">
                {activePins.map((pin) => (
                  <div key={pin.position} className="relative flex items-center gap-3 rounded-xl border bg-card p-2.5">
                    <span className="absolute -top-2 -left-2 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow-sm leading-none">
                      {pin.position}
                    </span>
                    {pin.recipeImage
                      ? <img src={pin.recipeImage} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
                      : <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <UtensilsCrossed className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                    }
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-semibold truncate">
                        {pin.recipeTitle ?? <span className="italic text-muted-foreground">Recipe no longer available</span>}
                      </p>
                      {pin.recipeDescription && (
                        <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">{pin.recipeDescription}</p>
                      )}
                      {pin.recipeRating && pin.recipeRating.count > 0 && (
                        <StarDisplay rating={pin.recipeRating.avg} />
                      )}
                    </div>
                    {pin.recipeId && (
                      <button type="button"
                        onClick={() => { onViewRecipe(pin.recipeId!); onClose(); }}
                        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!user?.handle && (
            <p className="text-xs text-muted-foreground text-center italic">No public profile available.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function RecipesPage() {
  const navigate = useNavigate();
  const { openRecipeId } = Route.useSearch();
  const [activeTab, setActiveTab] = useState<'recipes' | 'history'>('recipes');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('alpha');
  const [canMakeFilter, setCanMakeFilter] = useState<'all' | 'can-make'>('all');
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'idle' | 'scan' | 'url'>('idle');
  const [addRecipeOpen, setAddRecipeOpen] = useState(false);
  const [historyUser, setHistoryUser] = useState<{ id: string; name: string | null; handle: string | null; image: string | null } | null>(null);
  const [editRecipe, setEditRecipe] = useState<RecipeDetail | null>(null);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.recipeBook.categories(),
    queryFn: () => api.get<Category[]>('/api/recipe-book/categories'),
  });

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: queryKeys.recipeBook.recipes(debouncedSearch, activeCategoryId ?? undefined),
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (activeCategoryId) params.set('categoryId', activeCategoryId);
      return api.get<RecipeSummary[]>(`/api/recipe-book/recipes?${params}`);
    },
  });

  const { data: canMake } = useQuery({
    queryKey: queryKeys.recipeBook.canMake(),
    queryFn: () => api.get<CanMakeResponse>('/api/recipe-book/can-make'),
    enabled: canMakeFilter === 'can-make',
  });

  const { data: cookHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['cook-sessions', 'household-history'],
    queryFn: () => api.get<CookHistoryEntry[]>('/api/cook-sessions/household-history'),
    enabled: activeTab === 'history',
  });

  const { data: inProgressSessions = [] } = useQuery({
    queryKey: ['cook-sessions', 'household-in-progress'],
    queryFn: () => api.get<InProgressSession[]>('/api/cook-sessions/household-in-progress'),
    enabled: activeTab === 'history',
    refetchInterval: 30000,
  });

  const canMakeIds = canMake
    ? new Set([...canMake.ready.map((r) => r.id), ...canMake.almost.map((r) => r.id)])
    : null;

  const sortedRecipes = [...recipes].sort((a, b) => {
    if (sortBy === 'z-alpha') return b.title.localeCompare(a.title);
    if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return a.title.localeCompare(b.title);
  });

  const displayedRecipes = sortedRecipes.filter((r) => {
    if (letterFilter && !r.title.toUpperCase().startsWith(letterFilter)) return false;
    if (canMakeFilter === 'can-make' && canMakeIds && !canMakeIds.has(r.id)) return false;
    return true;
  });

  const hasActiveFilters = activeCategoryId !== null || sortBy !== 'alpha' || canMakeFilter !== 'all';

  // Open a specific recipe modal when navigated here with ?openRecipeId=...
  useEffect(() => {
    if (openRecipeId) {
      setSelectedRecipeId(openRecipeId);
      void navigate({ to: '/recipes', search: {}, replace: true });
    }
  }, [openRecipeId]);

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(val.trim()), 300);
  };

  const openAddRecipe = (mode: 'idle' | 'scan' | 'url') => {
    setFormMode(mode);
    setEditRecipe(null);
    setAddRecipeOpen(false);
    setFormOpen(true);
  };

  const openEdit = (r: RecipeDetail) => {
    setEditRecipe(r);
    setSelectedRecipeId(null);
    setFormOpen(true);
  };

  const formInitial: Partial<RecipeFormState> | undefined = editRecipe
    ? {
        title: editRecipe.title,
        description: editRecipe.description ?? '',
        baseServings: String(editRecipe.baseServings),
        categoryId: editRecipe.categoryId ?? '',
        steps: editRecipe.steps,
        ingredients: editRecipe.ingredients.map((ing, i) => ({
          quantity: ing.quantity ?? '',
          unit: ing.unit ?? '',
          name: ing.name,
          note: ing.note ?? '',
          sortOrder: i,
        })),
      }
    : undefined;

  return (
    <div className="flex flex-col items-center px-4 pb-24 pt-6">
      <div className="w-full max-w-md sm:max-w-xl lg:max-w-3xl xl:max-w-5xl">

        {/* Header */}
        <div className="mb-1 flex items-center gap-2">
          <BookOpenText className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-xl font-bold">Recipe Book</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Your household's shared collection. Browse, search, and filter everything your household has saved.
        </p>

        {/* Tabs */}
        <div className="flex rounded-xl border border-border/60 bg-muted/40 p-1 gap-1 mb-5">
          {([
            { id: 'recipes' as const, label: 'Recipe Book', icon: BookOpenText },
            { id: 'history' as const, label: 'Cooking History', icon: History },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all',
                activeTab === id
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>

        {activeTab === 'history' ? (
          <CookingHistoryTab
            entries={cookHistory}
            inProgressEntries={inProgressSessions}
            isLoading={historyLoading}
            onViewUser={setHistoryUser}
            onViewRecipe={(id) => { setSelectedRecipeId(id); setActiveTab('recipes'); }}
          />
        ) : (<>

        {/* Action buttons — 50/50 */}
        <div className="flex gap-2 mb-2">
          <div className="w-1/2">
            <Button className="w-full gap-1.5 h-9 text-sm" onClick={() => setAddRecipeOpen((v) => !v)}>
              <Plus className="h-4 w-4" />Add Recipe
              <ChevronDown className={cn('h-3.5 w-3.5 ml-auto transition-transform duration-200', addRecipeOpen && 'rotate-180')} />
            </Button>
          </div>
          <div className="w-1/2">
            <Button variant="outline" className="w-full gap-1.5 h-9 text-sm" onClick={() => setCategoryPanelOpen(true)}>
              <Tag className="h-4 w-4" />Manage Categories
            </Button>
          </div>
        </div>

        {/* Add recipe option cards — full container width */}
        {addRecipeOpen && (
          <div className="grid grid-cols-3 gap-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {([
              { mode: 'idle' as const, icon: FileText, label: 'Manual', desc: 'Fill in the recipe yourself' },
              { mode: 'scan' as const, icon: Camera, label: 'Screenshot', desc: 'Upload a photo of a recipe' },
              { mode: 'url' as const, icon: Link2, label: 'URL Import', desc: 'Import from a recipe website' },
            ]).map(({ mode, icon: Icon, label, desc }) => (
              <button key={mode} type="button" onClick={() => openAddRecipe(mode)}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center hover:border-primary/40 hover:bg-primary/5 transition-all">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-semibold leading-tight">{label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Search + Filter — 50/50 */}
        <div className="flex gap-2 mb-2">
          <div className="w-1/2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input className="h-9 pl-9 pr-8 text-sm w-full" placeholder="Search recipes…"
              value={search} onChange={(e) => handleSearch(e.target.value)} autoComplete="off" />
            {search && (
              <button type="button" onClick={() => handleSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="w-1/2">
            <button type="button" onClick={() => setFiltersOpen((v) => !v)}
              className="w-full h-9 flex items-center gap-2 px-3 rounded-xl border border-border/60 bg-card/50 text-left hover:bg-accent/30 transition-colors">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium flex-1">Filters</span>
              {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
              <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0', filtersOpen && 'rotate-180')} />
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="px-4 pt-3 pb-4 space-y-3">
              {/* Sort By */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sort By</p>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { id: 'alpha' as const, label: 'A–Z' },
                    { id: 'z-alpha' as const, label: 'Z–A' },
                    { id: 'newest' as const, label: 'Latest Recipes' },
                    { id: 'oldest' as const, label: 'Older Recipes' },
                  ] as { id: SortBy; label: string }[]).map(({ id, label }) => (
                    <button key={id} type="button" onClick={() => setSortBy(id)}
                      className={cn('rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                        sortBy === id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              {categories.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setActiveCategoryId(null)}
                      className={cn('rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                        activeCategoryId === null ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                      All
                    </button>
                    {categories.map((c) => (
                      <button key={c.id} type="button" onClick={() => setActiveCategoryId(c.id)}
                        className={cn('rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                          activeCategoryId === c.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pantry Match */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pantry Match</p>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { id: 'all' as const, label: 'All Recipes' },
                    { id: 'can-make' as const, label: 'What Can I Make?' },
                  ]).map(({ id, label }) => (
                    <button key={id} type="button" onClick={() => setCanMakeFilter(id)}
                      className={cn('rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                        canMakeFilter === id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                      {label}
                    </button>
                  ))}
                </div>
                {canMakeFilter === 'can-make' && (
                  <p className="text-[10px] text-muted-foreground">Recipes you can cook based on your pantry stock.</p>
                )}
              </div>

              {hasActiveFilters && (
                <button type="button"
                  onClick={() => { setActiveCategoryId(null); setSortBy('alpha'); setCanMakeFilter('all'); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* A–Z letter index */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Recipes</p>
        <div className="mb-3">
          <AlphabetBar filter={letterFilter} onChange={setLetterFilter} />
        </div>

        {/* Recipe grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
          </div>
        ) : displayedRecipes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {debouncedSearch || activeCategoryId || canMakeFilter !== 'all' || letterFilter ? 'No recipes found' : 'No recipes yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {debouncedSearch || activeCategoryId || canMakeFilter !== 'all' || letterFilter
                  ? 'Try adjusting your search or filters'
                  : 'Click "Add Recipe" above to get started'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {displayedRecipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} onClick={() => setSelectedRecipeId(r.id)} />
            ))}
          </div>
        )}
        </>)}
      </div>

      <RecipeDetailModal
        recipeId={selectedRecipeId}
        open={!!selectedRecipeId}
        onClose={() => setSelectedRecipeId(null)}
        onEdit={openEdit}
        onDelete={() => setSelectedRecipeId(null)}
      />

      <RecipeForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditRecipe(null); }}
        categories={categories}
        initial={formInitial}
        editId={editRecipe?.id}
        initialMode={editRecipe ? 'idle' : formMode}
        existingImages={editRecipe?.images}
      />

      <CategoryPanel
        open={categoryPanelOpen}
        onClose={() => setCategoryPanelOpen(false)}
        categories={categories}
      />

      {/* History user card modal */}
      <HistoryUserModal
        user={historyUser}
        onClose={() => setHistoryUser(null)}
        onViewRecipe={(id) => { setHistoryUser(null); setSelectedRecipeId(id); }}
      />
    </div>
  );
}
