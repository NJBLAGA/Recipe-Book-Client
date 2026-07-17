import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Refrigerator, Plus, Pencil, Trash2, X, ShoppingCart,
  ChevronDown, ChevronUp, Loader2, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export const Route = createFileRoute('/_app/pantry')({
  component: PantryPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type FillLevel = 0 | 25 | 50 | 75 | 100;

interface PantryCategory { id: string; name: string; pantryId: string; }

interface PantryBatch {
  id: string; pantryItemId: string; fillLevel: FillLevel; createdAt: string;
}

interface PantryItem {
  id: string; pantryId: string; ingredientId: string; ingredientName: string;
  categoryId: string | null; categoryName: string | null;
  effectiveStock: number; batches: PantryBatch[];
  images: Array<{ id: string; url: string; sortOrder: number }>;
}

// ─── Fill Level Helpers ───────────────────────────────────────────────────────

const FILL_LEVELS: FillLevel[] = [100, 75, 50, 25, 0];

function effectiveColor(stock: number) {
  if (stock === 0) return 'bg-rose-500';
  if (stock <= 25) return 'bg-amber-400';
  if (stock <= 50) return 'bg-yellow-400';
  if (stock <= 75) return 'bg-lime-400';
  return 'bg-emerald-500';
}

function FillBar({ level }: { level: FillLevel }) {
  const segments = 4;
  const filled = Math.round((level / 100) * segments);
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: segments }).map((_, i) => (
        <div key={i} className={cn(
          'h-2 w-5 rounded-sm transition-colors',
          i < filled
            ? level >= 75 ? 'bg-emerald-500' : level >= 50 ? 'bg-lime-400' : level >= 25 ? 'bg-amber-400' : 'bg-rose-500'
            : 'bg-muted-foreground/15',
        )} />
      ))}
      <span className="text-[10px] text-muted-foreground ml-1">{level}%</span>
    </div>
  );
}

// ─── Batch Fill Picker ────────────────────────────────────────────────────────

function FillPicker({ value, onChange }: { value: FillLevel; onChange: (v: FillLevel) => void }) {
  return (
    <div className="flex gap-1.5">
      {FILL_LEVELS.map((l) => (
        <button key={l} type="button"
          onClick={() => onChange(l)}
          className={cn(
            'flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors',
            value === l
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}>
          {l}%
        </button>
      ))}
    </div>
  );
}

// ─── Category Manager ─────────────────────────────────────────────────────────

function PantryCategoryManager({ open, onClose, categories }: {
  open: boolean; onClose: () => void; categories: PantryCategory[];
}) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: () => api.post<PantryCategory>('/api/pantry/categories', { name: newName.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.categories() });
      setNewName('');
      toast.success('Category created');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`/api/pantry/categories/${id}`, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.categories() });
      void queryClient.invalidateQueries({ queryKey: ['pantry', 'items'] });
      setEditing(null);
      toast.success('Category renamed');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/pantry/categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.categories() });
      void queryClient.invalidateQueries({ queryKey: ['pantry', 'items'] });
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editing.name.trim()) renameMutation.mutate({ id: cat.id, name: editing.name.trim() });
                        if (e.key === 'Escape') setEditing(null);
                      }} />
                    <Button size="sm" className="h-7 text-xs" disabled={!editing.name.trim() || renameMutation.isPending}
                      onClick={() => renameMutation.mutate({ id: cat.id, name: editing.name.trim() })}>Save</Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(null)}>
                      <X className="h-3 w-3" />
                    </Button>
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

// ─── Add / Edit Item Modal ────────────────────────────────────────────────────

function AddItemModal({ open, onClose, categories, editItem }: {
  open: boolean; onClose: () => void; categories: PantryCategory[]; editItem?: PantryItem | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [fillLevel, setFillLevel] = useState<FillLevel>(100);

  useEffect(() => {
    if (open) {
      if (editItem) {
        setName(editItem.ingredientName);
        setCategoryId(editItem.categoryId ?? '');
        setFillLevel((editItem.batches[0]?.fillLevel as FillLevel) ?? 100);
      } else {
        setName('');
        setCategoryId('');
        setFillLevel(100);
      }
    }
  }, [open, editItem?.id]);

  const addMutation = useMutation({
    mutationFn: () => api.post('/api/pantry/items', {
      name: name.trim(),
      categoryId: categoryId || null,
      fillLevel,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pantry', 'items'] });
      toast.success('Item added');
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/api/pantry/items/${editItem!.id}`, {
      categoryId: categoryId || null,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pantry', 'items'] });
      toast.success('Item updated');
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const pending = addMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm p-0 gap-0" hideClose>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">{editItem ? 'Edit Item' : 'Add to Pantry'}</h2>
          <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        <div className="p-4 space-y-4">
          {!editItem && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredient *</label>
              <Input className="h-9" placeholder="e.g. Sugar" value={name}
                onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
            <select className="h-9 w-full rounded-md border bg-input px-3 text-sm"
              value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {!editItem && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Initial Fill Level</label>
              <FillPicker value={fillLevel} onChange={setFillLevel} />
            </div>
          )}
        </div>
        <div className="flex gap-3 px-4 pb-4">
          <Button variant="outline" className="flex-1 h-9" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 h-9" disabled={pending || (!editItem && !name.trim())}
            onClick={() => editItem ? updateMutation.mutate() : addMutation.mutate()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : editItem ? 'Save' : 'Add'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Batch Manager ────────────────────────────────────────────────────────────

function BatchManager({ item }: { item: PantryItem }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newLevel, setNewLevel] = useState<FillLevel>(100);
  const [editing, setEditing] = useState<{ id: string; level: FillLevel } | null>(null);

  const addBatch = useMutation({
    mutationFn: () => api.post(`/api/pantry/items/${item.id}/batches`, { fillLevel: newLevel }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pantry', 'items'] });
      setAdding(false);
      setNewLevel(100);
      toast.success('Batch added');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const updateBatch = useMutation({
    mutationFn: ({ batchId, fillLevel }: { batchId: string; fillLevel: FillLevel }) =>
      api.patch(`/api/pantry/batches/${batchId}`, { fillLevel }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pantry', 'items'] });
      setEditing(null);
      toast.success('Batch updated');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const deleteBatch = useMutation({
    mutationFn: (batchId: string) => api.delete(`/api/pantry/batches/${batchId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pantry', 'items'] });
      toast.success('Batch removed');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Batches ({item.batches.length})
        </span>
        <button type="button" onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1 text-xs text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" />Add batch
        </button>
      </div>

      {adding && (
        <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
          <FillPicker value={newLevel} onChange={setNewLevel} />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs"
              onClick={() => { setAdding(false); setNewLevel(100); }}>Cancel</Button>
            <Button size="sm" className="flex-1 h-8 text-xs" disabled={addBatch.isPending}
              onClick={() => addBatch.mutate()}>
              {addBatch.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {item.batches.map((batch, i) => (
          <div key={batch.id} className="rounded-lg border bg-card px-3 py-2 flex items-center gap-3">
            <span className="text-xs text-muted-foreground shrink-0">#{i + 1}</span>
            {editing?.id === batch.id ? (
              <>
                <div className="flex-1">
                  <FillPicker value={editing.level} onChange={(l) => setEditing({ ...editing, level: l })} />
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" className="h-7 text-xs" disabled={updateBatch.isPending}
                    onClick={() => updateBatch.mutate({ batchId: batch.id, fillLevel: editing.level })}>
                    {updateBatch.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <FillBar level={batch.fillLevel} />
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" onClick={() => setEditing({ id: batch.id, level: batch.fillLevel })}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => deleteBatch.mutate(batch.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Item Detail Modal ────────────────────────────────────────────────────────

function ItemDetailModal({ item, open, onClose, categories, onEdit }: {
  item: PantryItem | null; open: boolean; onClose: () => void;
  categories: PantryCategory[]; onEdit: (item: PantryItem) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) setConfirmDelete(false);
  }, [open, item?.id]);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/pantry/items/${item!.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pantry', 'items'] });
      toast.success('Item removed');
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const pushToShoppingList = useMutation({
    mutationFn: () => api.post('/api/shopping-list/items', {
      name: item!.ingredientName,
      source: 'PANTRY',
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
      toast.success('Added to shopping list');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-16px)] max-w-md p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden" hideClose>
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
          <div>
            {item && <h2 className="font-bold text-base">{item.ingredientName}</h2>}
            {item?.categoryName && <p className="text-xs text-muted-foreground">{item.categoryName}</p>}
          </div>
          <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>

        {item && (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="p-4 space-y-5">
              {/* Effective stock summary */}
              <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Effective Stock</span>
                  <span className={cn(
                    'text-xs font-bold',
                    item.effectiveStock === 0 ? 'text-rose-500' : item.effectiveStock <= 25 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400',
                  )}>
                    {item.effectiveStock}% across {item.batches.length} batch{item.batches.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-2 rounded-full transition-all', effectiveColor(item.effectiveStock))}
                    style={{ width: `${Math.min(100, item.effectiveStock)}%` }}
                  />
                </div>
              </div>

              {/* Batch manager */}
              <BatchManager item={item} />
            </div>
          </div>
        )}

        {item && !confirmDelete && (
          <div className="shrink-0 border-t px-4 py-3 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5"
              onClick={() => pushToShoppingList.mutate()} disabled={pushToShoppingList.isPending}>
              <ShoppingCart className="h-3.5 w-3.5" />Shopping List
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5"
              onClick={() => onEdit(item)}>
              <Pencil className="h-3.5 w-3.5" />Edit
            </Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
              onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {item && confirmDelete && (
          <div className="shrink-0 border-t bg-destructive/5 px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-destructive">Remove from pantry?</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Pantry Item Card ─────────────────────────────────────────────────────────

function PantryItemCard({ item, onClick }: { item: PantryItem; onClick: () => void }) {
  const effectiveLevel = Math.min(100, item.effectiveStock) as FillLevel;

  return (
    <button type="button" onClick={onClick}
      className="group w-full text-left rounded-2xl border bg-card px-4 py-3 hover:shadow-md hover:border-primary/30 transition-all flex items-center gap-3">
      <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
        {item.images[0] ? (
          <img src={item.images[0].url} alt="" className="h-10 w-10 rounded-xl object-cover" />
        ) : (
          <Package className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{item.ingredientName}</p>
        <div className="mt-1">
          <FillBar level={effectiveLevel} />
        </div>
        {item.batches.length > 1 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{item.batches.length} batches</p>
        )}
      </div>
      <div className={cn(
        'shrink-0 h-2.5 w-2.5 rounded-full',
        item.effectiveStock === 0 ? 'bg-rose-500' : item.effectiveStock <= 25 ? 'bg-amber-400' : 'bg-emerald-500',
      )} />
    </button>
  );
}

// ─── Category Group ───────────────────────────────────────────────────────────

function CategoryGroup({ label, items, onItemClick }: {
  label: string; items: PantryItem[]; onItemClick: (item: PantryItem) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 text-left">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">({items.length})</span>
        <span className="flex-1 h-px bg-border" />
        {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((item) => (
            <PantryItemCard key={item.id} item={item} onClick={() => onItemClick(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function PantryPage() {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PantryItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<PantryItem | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.pantry.categories(),
    queryFn: () => api.get<PantryCategory[]>('/api/pantry/categories'),
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.pantry.items(activeCategoryId ?? undefined),
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeCategoryId) params.set('categoryId', activeCategoryId);
      return api.get<PantryItem[]>(`/api/pantry/items?${params}`);
    },
  });

  // Group items by category
  const grouped = new Map<string, { label: string; items: PantryItem[] }>();
  const uncategorised: PantryItem[] = [];

  for (const item of items) {
    if (item.categoryId && item.categoryName) {
      if (!grouped.has(item.categoryId)) grouped.set(item.categoryId, { label: item.categoryName, items: [] });
      grouped.get(item.categoryId)!.items.push(item);
    } else {
      uncategorised.push(item);
    }
  }

  const handleOpenEdit = (item: PantryItem) => {
    setSelectedItem(null);
    setEditItem(item);
    setAddOpen(true);
  };

  return (
    <div className="flex flex-col items-center px-4 pb-24 pt-6">
      <div className="w-full max-w-md sm:max-w-xl lg:max-w-3xl xl:max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Refrigerator className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-xl font-bold">Pantry</h1>
          </div>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => { setEditItem(null); setAddOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />Add Item
          </Button>
        </div>

        {/* Category chip bar */}
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
          <button type="button" onClick={() => setCategoryManagerOpen(true)}
            className="shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground border border-dashed border-border hover:text-foreground hover:border-primary transition-colors">
            <Pencil className="h-3 w-3" />Categories
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Refrigerator className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">Pantry is empty</p>
              <p className="text-xs text-muted-foreground mt-1">Add ingredients to track your stock levels.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {activeCategoryId ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map((item) => (
                  <PantryItemCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
                ))}
              </div>
            ) : (
              <>
                {[...grouped.entries()].map(([id, { label, items: groupItems }]) => (
                  <CategoryGroup key={id} label={label} items={groupItems}
                    onItemClick={(item) => setSelectedItem(item)} />
                ))}
                {uncategorised.length > 0 && (
                  <CategoryGroup label="Uncategorised" items={uncategorised}
                    onItemClick={(item) => setSelectedItem(item)} />
                )}
              </>
            )}
          </div>
        )}
      </div>

      <ItemDetailModal
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        categories={categories}
        onEdit={handleOpenEdit}
      />

      <AddItemModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setEditItem(null); }}
        categories={categories}
        editItem={editItem}
      />

      <PantryCategoryManager
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
        categories={categories}
      />
    </div>
  );
}
