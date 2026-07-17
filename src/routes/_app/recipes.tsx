import { createFileRoute } from '@tanstack/react-router';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpenText, Plus, Search, X, ChevronLeft, ChevronRight,
  Star, Pencil, Trash2, ArrowUp, ArrowDown, Minus, Camera,
  Link2, UtensilsCrossed, ShoppingCart, Refrigerator, AlertCircle,
  Check, ChefHat, ChevronDown, ChevronUp, Loader2,
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
  component: RecipesPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category { id: string; name: string; recipeBookId: string; }

interface RecipeSummary {
  id: string; title: string; description: string | null; baseServings: number;
  categoryId: string | null; categoryName: string | null;
  image: string | null; createdAt: string; updatedAt: string;
}

interface Ingredient {
  id: string; ingredientId: string; name: string;
  quantity: string | null; unit: string | null; note: string | null; sortOrder: number;
}

interface RecipeImage { id: string; url: string; sortOrder: number; }

interface RecipeDetail extends RecipeSummary {
  steps: string[]; sharedByUserId: string | null; originalRecipeId: string | null;
  ingredients: Ingredient[]; images: RecipeImage[];
}

interface PantryItemSummary {
  id: string; ingredientId: string; ingredientName: string; effectiveStock: number;
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

function pantryStatus(ingredientId: string, pantryMap: Map<string, number>): 'in-stock' | 'low' | 'missing' {
  if (!pantryMap.has(ingredientId)) return 'missing';
  const stock = pantryMap.get(ingredientId)!;
  if (stock === 0) return 'missing';
  if (stock <= 25) return 'low';
  return 'in-stock';
}

function PantryDot({ status }: { status: 'in-stock' | 'low' | 'missing' }) {
  return (
    <span className={cn(
      'inline-block h-2 w-2 rounded-full shrink-0',
      status === 'in-stock' && 'bg-emerald-500',
      status === 'low' && 'bg-amber-400',
      status === 'missing' && 'bg-rose-500',
    )} />
  );
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

// ─── Recipe Form ──────────────────────────────────────────────────────────────

interface RecipeFormProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  initial?: Partial<RecipeFormState>;
  editId?: string;
}

interface RecipeFormState {
  title: string;
  description: string;
  baseServings: string;
  categoryId: string;
  steps: string[];
  ingredients: Array<IngredientRow & { sortOrder: number }>;
}

function RecipeForm({ open, onClose, categories, initial, editId }: RecipeFormProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'idle' | 'scan' | 'url'>('idle');
  const [urlInput, setUrlInput] = useState('');
  const [scanFiles, setScanFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<RecipeFormState>(() => ({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    baseServings: initial?.baseServings ?? '4',
    categoryId: initial?.categoryId ?? '',
    steps: initial?.steps?.length ? initial.steps : [''],
    ingredients: initial?.ingredients?.length ? initial.ingredients : [emptyRow(0)],
  }));

  useEffect(() => {
    if (open) {
      setForm({
        title: initial?.title ?? '',
        description: initial?.description ?? '',
        baseServings: initial?.baseServings ?? '4',
        categoryId: initial?.categoryId ?? '',
        steps: initial?.steps?.length ? initial.steps : [''],
        ingredients: initial?.ingredients?.length ? initial.ingredients : [emptyRow(0)],
      });
      setMode('idle');
      setUrlInput('');
      setScanFiles([]);
    }
  }, [open]);

  const prefill = useCallback((extracted: ExtractedRecipe) => {
    setForm((prev) => ({
      ...prev,
      title: extracted.title || prev.title,
      description: extracted.description ?? prev.description,
      baseServings: String(extracted.baseServings),
      steps: extracted.steps.length ? extracted.steps : prev.steps,
      ingredients: extracted.ingredients.length ? extractedToRows(extracted.ingredients) : prev.ingredients,
    }));
    setMode('idle');
  }, []);

  const importUrl = async () => {
    if (!urlInput.trim()) return;
    setImporting(true);
    try {
      const data = await api.post<ExtractedRecipe>('/api/recipe-book/import-url', { url: urlInput.trim() });
      prefill(data);
      toast.success('Recipe imported');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const scanImages = async () => {
    if (scanFiles.length === 0) return;
    setImporting(true);
    try {
      const fd = new FormData();
      scanFiles.forEach((f) => fd.append('images', f));
      const data = await api.postForm<ExtractedRecipe>('/api/recipe-book/scan', fd);
      prefill(data);
      toast.success('Recipe scanned');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Scan failed');
    } finally {
      setImporting(false);
      setScanFiles([]);
    }
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
      const steps = form.steps.filter((s) => s.trim());
      if (steps.length === 0) throw new Error('At least one step is required');

      const body = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        baseServings: servings,
        categoryId: form.categoryId || null,
        steps,
        ingredients,
      };

      if (editId) {
        return api.patch(`/api/recipe-book/recipes/${editId}`, body);
      }
      return api.post('/api/recipe-book/recipes', body);
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

  const setStep = (idx: number, val: string) => {
    setForm((p) => { const s = [...p.steps]; s[idx] = val; return { ...p, steps: s }; });
  };

  const addStep = () => setForm((p) => ({ ...p, steps: [...p.steps, ''] }));

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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-16px)] max-w-2xl p-0 gap-0 flex flex-col max-h-[95vh] overflow-hidden" hideClose>
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b bg-card">
          <h2 className="font-semibold text-base">{editId ? 'Edit Recipe' : 'New Recipe'}</h2>
          <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>

        {/* Import strip */}
        {!editId && mode === 'idle' && (
          <div className="shrink-0 flex gap-2 px-4 py-2.5 border-b bg-muted/30">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"
              onClick={() => setMode('url')}>
              <Link2 className="h-3.5 w-3.5" />Import URL
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"
              onClick={() => setMode('scan')}>
              <Camera className="h-3.5 w-3.5" />Scan Images
            </Button>
          </div>
        )}

        {!editId && mode === 'url' && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
            <Input className="h-8 text-xs flex-1" placeholder="https://…" value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)} disabled={importing} />
            <Button size="sm" className="h-8 text-xs gap-1" onClick={importUrl} disabled={importing || !urlInput.trim()}>
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Import'}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setMode('idle'); setUrlInput(''); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {!editId && mode === 'scan' && (
          <div className="shrink-0 flex flex-col gap-2 px-4 py-2.5 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => setScanFiles(Array.from(e.target.files ?? []).slice(0, 10))} />
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
                onClick={() => fileInputRef.current?.click()} disabled={importing}>
                <Camera className="h-3.5 w-3.5" />
                {scanFiles.length > 0 ? `${scanFiles.length} image${scanFiles.length > 1 ? 's' : ''} selected` : 'Choose images (max 10)'}
              </Button>
              {scanFiles.length > 0 && (
                <Button size="sm" className="h-8 text-xs gap-1" onClick={scanImages} disabled={importing}>
                  {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Scan'}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-auto" onClick={() => { setMode('idle'); setScanFiles([]); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Upload cookbook pages, handwritten notes, or screenshots. Multiple pages supported.</p>
          </div>
        )}

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
              <Textarea className="resize-none text-sm min-h-[72px]" placeholder="A short description…"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>

            {/* Category + Servings */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
                <select className="h-9 w-full rounded-md border bg-input px-3 text-sm"
                  value={form.categoryId}
                  onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}>
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Servings *</label>
                <Input className="h-9" type="number" min="1" placeholder="4" value={form.baseServings}
                  onChange={(e) => setForm((p) => ({ ...p, baseServings: e.target.value }))} />
              </div>
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
              <div className="space-y-2">
                {form.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2">
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
                      value={step} onChange={(e) => setStep(idx, e.target.value)} />
                    <button type="button" onClick={() => removeStep(idx)}
                      className="pt-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                      <Minus className="h-4 w-4" />
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

        <div className="shrink-0 flex gap-3 px-4 py-3 border-t bg-card">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? 'Save Changes' : 'Save Recipe'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: recipe, isLoading } = useQuery({
    queryKey: queryKeys.recipeBook.recipe(recipeId ?? ''),
    queryFn: () => api.get<RecipeDetail>(`/api/recipe-book/recipes/${recipeId}`),
    enabled: open && !!recipeId,
  });

  const { data: pantryItems = [] } = useQuery({
    queryKey: queryKeys.pantry.items(),
    queryFn: () => api.get<PantryItemSummary[]>('/api/pantry/items'),
    enabled: open,
  });

  const pantryMap = new Map(pantryItems.map((p) => [p.ingredientId, p.effectiveStock]));

  const addToShoppingList = useMutation({
    mutationFn: ({ name, quantity, unit }: { name: string; quantity: string | null; unit: string | null }) =>
      api.post('/api/shopping-list/items', {
        name,
        quantity: quantity ? parseFloat(quantity) : null,
        unit: unit || null,
        source: 'RECIPE',
      }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() }); toast.success('Added to shopping list'); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

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
    if (open) { setImgIdx(0); setExpandedStep(null); setConfirmDelete(false); }
  }, [open, recipeId]);

  useEffect(() => {
    if (recipe) setServings(recipe.baseServings);
  }, [recipe?.id]);

  if (!open) return null;

  const base = recipe?.baseServings ?? 1;
  const effective = servings ?? base;
  const images = recipe?.images ? [...recipe.images].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-16px)] max-w-2xl p-0 gap-0 flex flex-col max-h-[95vh] overflow-hidden" hideClose>
        {/* Image carousel */}
        {images.length > 0 ? (
          <div className="relative shrink-0 h-48 bg-muted overflow-hidden">
            <img src={images[imgIdx].url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => setImgIdx((i) => Math.max(0, i - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setImgIdx((i) => Math.min(images.length - 1, i + 1))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <button key={i} type="button" onClick={() => setImgIdx(i)}
                      className={cn('h-1.5 rounded-full transition-all', i === imgIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50')} />
                  ))}
                </div>
              </>
            )}
            <DialogClose className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors">
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

        {isLoading || !recipe ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="p-4 space-y-5">
              {/* Header */}
              <div>
                <div className="flex items-start gap-2">
                  <h2 className="flex-1 font-bold text-xl leading-tight">{recipe.title}</h2>
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
                </div>
                {recipe.categoryName && (
                  <Badge variant="secondary" className="mt-1.5 text-[10px]">{recipe.categoryName}</Badge>
                )}
                {recipe.description && (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{recipe.description}</p>
                )}
              </div>

              {/* Serving scaler */}
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
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setSystem('metric')}
                      className={cn('text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                        system === 'metric' ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground')}>
                      Metric
                    </button>
                    <button type="button" onClick={() => setSystem('imperial')}
                      className={cn('text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                        system === 'imperial' ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground')}>
                      Imperial
                    </button>
                  </div>
                </div>
              </div>

              {/* Pantry legend */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><PantryDot status="in-stock" />In stock</span>
                <span className="flex items-center gap-1"><PantryDot status="low" />Running low</span>
                <span className="flex items-center gap-1"><PantryDot status="missing" />Not in pantry</span>
              </div>

              {/* Ingredients */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Ingredients</h3>
                <div className="space-y-1.5">
                  {recipe.ingredients.map((ing) => {
                    const status = ing.quantity ? pantryStatus(ing.ingredientId, pantryMap) : null;
                    const scaled = scaleQty(ing.quantity, base, effective);
                    const converted = convertQty(scaled, ing.unit, system);
                    return (
                      <div key={ing.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                        {status && <PantryDot status={status} />}
                        {!status && <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/20 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm">
                            {converted.qty && <span className="font-medium">{converted.qty} {converted.unit} </span>}
                            {ing.name}
                            {ing.note && <span className="text-muted-foreground text-xs"> — {ing.note}</span>}
                          </span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button type="button" title="Add to shopping list"
                            onClick={() => addToShoppingList.mutate({ name: ing.name, quantity: scaled, unit: ing.unit })}
                            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                            <ShoppingCart className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Method</h3>
                <div className="space-y-2">
                  {recipe.steps.map((step, i) => {
                    const converted = convertStepText(step, system);
                    const isExpanded = expandedStep === i;
                    return (
                      <button key={i} type="button"
                        className="w-full text-left flex items-start gap-3 rounded-xl border bg-card px-3 py-3 hover:bg-accent/30 transition-colors"
                        onClick={() => setExpandedStep(isExpanded ? null : i)}>
                        <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <p className={cn('text-sm leading-relaxed flex-1', !isExpanded && 'line-clamp-2')}>{converted}</p>
                        {converted.length > 80 && (
                          <span className="shrink-0 mt-1 text-muted-foreground">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
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
      </DialogContent>
    </Dialog>
  );
}

// ─── Category Manager ─────────────────────────────────────────────────────────

function CategoryManager({ open, onClose, categories }: {
  open: boolean; onClose: () => void; categories: Category[];
}) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: () => api.post<Category>('/api/recipe-book/categories', { name: newName.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipeBook.categories() });
      setNewName('');
      toast.success('Category created');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`/api/recipe-book/categories/${id}`, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipeBook.categories() });
      void queryClient.invalidateQueries({ queryKey: ['recipe-book', 'recipes'] });
      setEditing(null);
      toast.success('Category renamed');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/recipe-book/categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipeBook.categories() });
      void queryClient.invalidateQueries({ queryKey: ['recipe-book', 'recipes'] });
      toast.success('Category deleted');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm p-0 gap-0" hideClose>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Manage Categories</h2>
          <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <Input className="h-8 text-sm flex-1" placeholder="New category name…" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) createMutation.mutate(); }} />
            <Button size="sm" className="h-8 text-xs" disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}>Add</Button>
          </div>
          <div className="space-y-1.5">
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No categories yet.</p>
            )}
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                {editing?.id === cat.id ? (
                  <>
                    <Input className="h-7 text-xs flex-1" value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter' && editing.name.trim()) renameMutation.mutate({ id: cat.id, name: editing.name.trim() }); if (e.key === 'Escape') setEditing(null); }} />
                    <Button size="sm" className="h-7 text-xs" disabled={!editing.name.trim() || renameMutation.isPending}
                      onClick={() => renameMutation.mutate({ id: cat.id, name: editing.name.trim() })}>Save</Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(null)}><X className="h-3 w-3" /></Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm flex-1 truncate">{cat.name}</span>
                    <button type="button" onClick={() => setEditing({ id: cat.id, name: cat.name })}
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => deleteMutation.mutate(cat.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Recipe Card ──────────────────────────────────────────────────────────────

function RecipeCard({ recipe, onClick }: { recipe: RecipeSummary; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="group text-left rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-all hover:border-primary/30">
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {recipe.image ? (
          <img src={recipe.image} alt={recipe.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <UtensilsCrossed className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {recipe.categoryName && (
          <div className="absolute bottom-1.5 left-1.5">
            <Badge className="text-[9px] px-1.5 py-0 bg-black/60 text-white border-0 backdrop-blur-sm">
              {recipe.categoryName}
            </Badge>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="font-semibold text-sm leading-tight line-clamp-2">{recipe.title}</p>
        {recipe.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{recipe.description}</p>
        )}
      </div>
    </button>
  );
}

// ─── Can Make View ────────────────────────────────────────────────────────────

function CanMakeView({ onViewRecipe }: { onViewRecipe: (id: string) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.recipeBook.canMake(),
    queryFn: () => api.get<CanMakeResponse>('/api/recipe-book/can-make'),
  });

  const addMissing = useMutation({
    mutationFn: (items: Array<{ name: string }>) =>
      Promise.all(items.map((item) => api.post('/api/shopping-list/items', { name: item.name, source: 'RECIPE' }))),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() }); toast.success('Added to shopping list'); },
    onError: () => toast.error('Failed'),
  });

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" /></div>;
  }

  if (!data) return null;

  const total = data.ready.length + data.almost.length + data.rest.length;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Refrigerator className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Add recipes and stock your pantry to see what you can cook.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      {data.ready.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-semibold">Ready to Cook ({data.ready.length})</h3>
          </div>
          <div className="space-y-1.5">
            {data.ready.map((r) => (
              <button key={r.id} type="button" onClick={() => onViewRecipe(r.id)}
                className="w-full text-left flex items-center justify-between rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40 px-3 py-2.5 hover:bg-emerald-100/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  {r.runningLowItems.length > 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                      Running low: {r.runningLowItems.map((i) => i.name).join(', ')}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {data.almost.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Almost There ({data.almost.length})</h3>
          </div>
          <div className="space-y-1.5">
            {data.almost.map((r) => (
              <div key={r.id} className="rounded-xl border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => onViewRecipe(r.id)}
                    className="text-sm font-medium hover:text-primary transition-colors text-left">
                    {r.title}
                  </button>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{r.matchPct}%</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-xs text-muted-foreground flex-1">
                    Missing: {r.missingIngredients.map((i) => i.name).join(', ')}
                  </p>
                  <button type="button"
                    onClick={() => addMissing.mutate(r.missingIngredients)}
                    className="shrink-0 text-[10px] text-primary hover:underline flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" />Add missing
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.rest.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground">Other Recipes</h3>
          </div>
          <div className="space-y-1.5">
            {data.rest.map((r) => (
              <button key={r.id} type="button" onClick={() => onViewRecipe(r.id)}
                className="w-full text-left flex items-center justify-between rounded-xl border bg-card px-3 py-2 hover:bg-accent/30 transition-colors">
                <div>
                  <p className="text-sm">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground">Missing {r.missingCount} ingredient{r.missingCount !== 1 ? 's' : ''} · {r.matchPct}% match</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function RecipesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'recipes' | 'can-make'>('recipes');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editRecipe, setEditRecipe] = useState<RecipeDetail | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
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

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(val.trim()), 300);
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

  const viewCanMakeRecipe = (id: string) => {
    setSelectedRecipeId(id);
    setActiveView('recipes');
  };

  return (
    <div className="flex flex-col items-center px-4 pb-24 pt-6">
      <div className="w-full max-w-md sm:max-w-xl lg:max-w-3xl xl:max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpenText className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-xl font-bold">Recipe Book</h1>
          </div>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => { setEditRecipe(null); setFormOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />Add Recipe
          </Button>
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl border bg-card overflow-hidden mb-4">
          {([['recipes', 'Recipes'], ['can-make', "What Can I Make?"]] as const).map(([v, label]) => (
            <button key={v} type="button"
              className={cn('flex-1 py-2.5 text-xs font-medium transition-colors',
                activeView === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setActiveView(v)}>
              {label}
            </button>
          ))}
        </div>

        {activeView === 'can-make' ? (
          <CanMakeView onViewRecipe={viewCanMakeRecipe} />
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="h-9 pl-9 pr-9" placeholder="Search recipes…"
                value={search} onChange={(e) => handleSearch(e.target.value)} />
              {search && (
                <button type="button" onClick={() => handleSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1 mb-4">
              <button type="button"
                className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                  activeCategoryId === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground')}
                onClick={() => setActiveCategoryId(null)}>
                All
              </button>
              {categories.map((cat) => (
                <button key={cat.id} type="button"
                  className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                    activeCategoryId === cat.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground')}
                  onClick={() => setActiveCategoryId(cat.id === activeCategoryId ? null : cat.id)}>
                  {cat.name}
                </button>
              ))}
              <button type="button"
                onClick={() => setCategoryManagerOpen(true)}
                className="shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground border border-dashed border-border hover:text-foreground hover:border-primary transition-colors">
                <Pencil className="h-3 w-3" />Categories
              </button>
            </div>

            {/* Recipe grid */}
            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
              </div>
            ) : recipes.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {debouncedSearch || activeCategoryId ? 'No recipes found' : 'No recipes yet'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {debouncedSearch || activeCategoryId
                      ? 'Try a different search or category'
                      : 'Add your first recipe using the button above'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {recipes.map((r) => (
                  <RecipeCard key={r.id} recipe={r} onClick={() => setSelectedRecipeId(r.id)} />
                ))}
              </div>
            )}
          </>
        )}
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
      />

      <CategoryManager
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
        categories={categories}
      />
    </div>
  );
}
