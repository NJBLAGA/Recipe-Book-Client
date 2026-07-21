import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Plus, Pencil, Trash2, X, Check, Loader2, Search,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Tag, ArrowUp, ArrowDown,
  ImagePlus, Maximize2, SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export const Route = createFileRoute('/_app/shopping-list')({
  component: ShoppingListPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShoppingCategory { id: string; name: string; shoppingListId: string; }

interface ShoppingItemImage { id: string; url: string; sortOrder: number; }

interface ShoppingItem {
  id: string; name: string;
  quantity: number | null; unit: string | null; note: string | null;
  isChecked: boolean; categoryId: string | null; categoryName: string | null;
  source: 'RECIPE' | 'PANTRY' | 'DIRECT'; sortOrder: number;
  addedByUserId: string | null; addedByUserName: string | null;
  createdAt: string;
  images: ShoppingItemImage[];
}

// ─── Category Sidebar Panel ───────────────────────────────────────────────────

function CategoryPanel({ open, onClose, categories }: {
  open: boolean; onClose: () => void; categories: ShoppingCategory[];
}) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState('');

  const createMutation = useMutation({
    mutationFn: () => api.post<ShoppingCategory>('/api/shopping-list/categories', { name: newName.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.categories() });
      setNewName('');
      toast.success('Category created');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`/api/shopping-list/categories/${id}`, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.categories() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
      setEditing(null);
      toast.success('Category renamed');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, target }: { id: string; target: string | null }) =>
      api.delete(`/api/shopping-list/categories/${id}`, { targetCategoryId: target || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.categories() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
      setDeletingId(null);
      setTargetCategoryId('');
      toast.success('Category deleted — items moved to Misc');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  if (!open) return null;

  const deletingCat = categories.find((c) => c.id === deletingId);
  const otherCategories = categories.filter((c) => c.id !== deletingId);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto h-full w-80 max-w-[90vw] bg-card shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Shopping Categories</h2>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex gap-2">
            <Input className="h-8 text-sm flex-1" placeholder="New category…" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) createMutation.mutate(); }} />
            <Button size="sm" className="h-8 text-xs shrink-0"
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}>Add</Button>
          </div>
          <div className="space-y-1.5">
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No categories yet.</p>
            )}
            {categories.map((cat) => (
              <div key={cat.id}>
                {deletingId === cat.id ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-3">
                    <p className="text-xs font-semibold text-destructive">Delete "{deletingCat?.name}"?</p>
                    <p className="text-[10px] text-muted-foreground">Items will be moved to Misc automatically.</p>
                    {otherCategories.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">Or move to a specific category:</p>
                        <Select
                          value={targetCategoryId || '__misc__'}
                          onValueChange={(v) => setTargetCategoryId(v === '__misc__' ? '' : v)}>
                          <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__misc__">Move to Misc</SelectItem>
                            {otherCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 h-7 text-xs"
                        onClick={() => { setDeletingId(null); setTargetCategoryId(''); }}>Cancel</Button>
                      <Button size="sm" className="flex-1 h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate({ id: cat.id, target: targetCategoryId || null })}>
                        {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
                      </Button>
                    </div>
                  </div>
                ) : editing?.id === cat.id ? (
                  <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
                    <Input className="h-7 text-xs flex-1" value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editing.name.trim()) renameMutation.mutate({ id: cat.id, name: editing.name.trim() });
                        if (e.key === 'Escape') setEditing(null);
                      }} autoFocus />
                    <Button size="sm" className="h-7 text-xs shrink-0"
                      disabled={!editing.name.trim() || renameMutation.isPending}
                      onClick={() => renameMutation.mutate({ id: cat.id, name: editing.name.trim() })}>Save</Button>
                    <button type="button" onClick={() => setEditing(null)}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-accent/30 transition-colors group">
                    <span className="text-sm flex-1 truncate">{cat.name}</span>
                    <button type="button" onClick={() => setEditing({ id: cat.id, name: cat.name })}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setDeletingId(cat.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Item Form ─────────────────────────────────────────────────────────────


// ─── Shopping Item Card (PinCard style) ───────────────────────────────────────

function ShoppingItemRow({ item, isFirst, isLast, onToggle, onMove, onView }: {
  item: ShoppingItem; isFirst: boolean; isLast: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
  onView: (item: ShoppingItem) => void;
}) {
  const qtyLabel = item.quantity != null
    ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
    : item.unit || null;

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 rounded-xl border bg-card px-3 py-3 transition-all hover:bg-accent/40 hover:border-primary/30 cursor-pointer',
        item.isChecked && 'opacity-60',
      )}
      onClick={() => onView(item)}>
      {/* Checkbox */}
      <button type="button"
        className={cn(
          'shrink-0 flex h-4 w-4 items-center justify-center rounded border-2 transition-colors',
          item.isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary/50',
        )}
        onClick={(e) => { e.stopPropagation(); onToggle(item.id, !item.isChecked); }}>
        {item.isChecked && <Check className="h-2.5 w-2.5" />}
      </button>
      {/* Content */}
      <div className={cn('min-w-0 flex-1 space-y-0.5', item.isChecked && 'line-through')}>
        <p className={cn('text-sm font-semibold leading-snug line-clamp-2', item.isChecked && 'text-muted-foreground')}>
          {item.name}
        </p>
        {qtyLabel && <p className="text-xs text-muted-foreground truncate">{qtyLabel}</p>}
      </div>
      {/* Move arrows */}
      <div className="shrink-0 flex flex-col items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <button type="button" disabled={isFirst} onClick={() => onMove(item.id, 'up')}
          className="disabled:opacity-20 text-muted-foreground hover:text-foreground transition-colors p-0.5">
          <ArrowUp className="h-3 w-3" />
        </button>
        <button type="button" disabled={isLast} onClick={() => onMove(item.id, 'down')}
          className="disabled:opacity-20 text-muted-foreground hover:text-foreground transition-colors p-0.5">
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Category Section ──────────────────────────────────────────────────────────

// ─── Add Item Modal ───────────────────────────────────────────────────────────

function AddItemModal({ open, onClose, categories }: {
  open: boolean; onClose: () => void; categories: ShoppingCategory[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [adding, setAdding] = useState(false);
  const addImgRef = useRef<HTMLInputElement>(null);

  const reset = () => { setName(''); setCategoryId(''); setQuantity(''); setUnit(''); setNote(''); setFiles([]); };

  useEffect(() => { if (!open) reset(); }, [open]);

  const handleAdd = async () => {
    if (!name.trim() || adding) return;
    setAdding(true);
    try {
      const created = await api.post<{ id: string }>('/api/shopping-list/items', {
        name: name.trim(),
        categoryId: categoryId || null,
        quantity: quantity ? Number(quantity) : null,
        unit: unit.trim() || null,
        note: note.trim() || null,
        source: 'DIRECT',
      });
      for (const file of files) {
        const form = new FormData();
        form.append('image', file);
        await api.postForm(`/api/shopping-list/items/${created.id}/images`, form).catch(() => {});
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm p-0 gap-0" hideClose>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Add Item</h3>
          <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        <div className="px-4 py-4 space-y-3 overflow-y-auto max-h-[70vh]">
          {/* Required */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <Input className="h-9 text-sm" placeholder="e.g. Oat milk"
              value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) void handleAdd(); }} />
          </div>
          {/* Optional */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Quantity</label>
              <input type="number" min="0" step="any" placeholder="e.g. 2"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Unit</label>
              <Input className="h-9 text-sm" placeholder="e.g. kg, cups"
                value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Note</label>
            <Input className="h-9 text-sm" placeholder="e.g. organic, no sugar"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <Select
              value={categoryId || '__none__'}
              onValueChange={(v) => setCategoryId(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No category</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Images</label>
            <div className="flex flex-wrap gap-2">
              {files.map((file, idx) => (
                <div key={idx} className="relative group">
                  <img src={URL.createObjectURL(file)} alt="" className="h-16 w-16 rounded-lg object-cover border" />
                  <button type="button"
                    onClick={() => setFiles((fs) => fs.filter((_, i) => i !== idx))}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => addImgRef.current?.click()}
                className="h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                <ImagePlus className="h-5 w-5" />
              </button>
              <input ref={addImgRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  if (picked.length) setFiles((fs) => [...fs, ...picked]);
                  e.target.value = '';
                }} />
            </div>
          </div>
        </div>
        <div className="border-t px-4 py-3 flex gap-2">
          <Button variant="outline" className="flex-1 h-9" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 h-9" disabled={!name.trim() || adding} onClick={() => void handleAdd()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add to List'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SHOP_CAT_PAGE_SIZE = 8;

function CategorySection({ label, items, onToggle, onMove, onView }: {
  label: string; items: ShoppingItem[];
  onToggle: (id: string, checked: boolean) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
  onView: (item: ShoppingItem) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [catPage, setCatPage] = useState(1);
  const checkedCount = items.filter((i) => i.isChecked).length;
  const totalPages = Math.max(1, Math.ceil(items.length / SHOP_CAT_PAGE_SIZE));
  const safePage = Math.min(catPage, totalPages);
  const pageItems = items.slice((safePage - 1) * SHOP_CAT_PAGE_SIZE, safePage * SHOP_CAT_PAGE_SIZE);

  return (
    <div className="space-y-1.5">
      <button type="button" onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 text-left py-0.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">{checkedCount}/{items.length}</span>
        <span className="flex-1 h-px bg-border" />
        {collapsed
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>
      {!collapsed && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {items.length === 0 ? (
              <p className="col-span-full text-xs text-muted-foreground text-center py-3 italic">No items in this category</p>
            ) : pageItems.map((item, idx) => {
              const globalIdx = (safePage - 1) * SHOP_CAT_PAGE_SIZE + idx;
              return (
                <ShoppingItemRow key={item.id} item={item}
                  isFirst={globalIdx === 0} isLast={globalIdx === items.length - 1}
                  onToggle={onToggle} onMove={onMove} onView={onView} />
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button type="button" disabled={safePage === 1}
                onClick={() => setCatPage((p) => p - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border bg-card text-muted-foreground disabled:opacity-30 hover:bg-accent transition-colors">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[11px] text-muted-foreground">{safePage} / {totalPages}</span>
              <button type="button" disabled={safePage === totalPages}
                onClick={() => setCatPage((p) => p + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border bg-card text-muted-foreground disabled:opacity-30 hover:bg-accent transition-colors">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ShoppingListPage() {
  const queryClient = useQueryClient();
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'az' | 'za' | 'newest' | 'oldest'>('default');
  const [viewItem, setViewItem] = useState<ShoppingItem | null>(null);
  const [editItem, setEditItem] = useState<ShoppingItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editImages, setEditImages] = useState<ShoppingItemImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [editLbIdx, setEditLbIdx] = useState<number | null>(null);
  const [viewCarouselIdx, setViewCarouselIdx] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.shoppingList.categories(),
    queryFn: () => api.get<ShoppingCategory[]>('/api/shopping-list/categories'),
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.shoppingList.items(),
    queryFn: () => api.get<ShoppingItem[]>('/api/shopping-list/items'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isChecked }: { id: string; isChecked: boolean }) =>
      api.patch(`/api/shopping-list/items/${id}`, { isChecked }),
    onMutate: async ({ id, isChecked }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.shoppingList.items() });
      const prev = queryClient.getQueryData<ShoppingItem[]>(queryKeys.shoppingList.items());
      queryClient.setQueryData<ShoppingItem[]>(queryKeys.shoppingList.items(), (old) =>
        old?.map((i) => i.id === id ? { ...i, isChecked } : i) ?? [],
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      queryClient.setQueryData(queryKeys.shoppingList.items(), ctx?.prev);
      toast.error('Failed to update');
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/shopping-list/items/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.shoppingList.items() });
      const prev = queryClient.getQueryData<ShoppingItem[]>(queryKeys.shoppingList.items());
      queryClient.setQueryData<ShoppingItem[]>(queryKeys.shoppingList.items(), (old) =>
        old?.filter((i) => i.id !== id) ?? [],
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      queryClient.setQueryData(queryKeys.shoppingList.items(), ctx?.prev);
      toast.error('Failed to delete');
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      api.patch(`/api/shopping-list/items/${id}/move`, { direction }),
    onMutate: async ({ id, direction }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.shoppingList.items() });
      const prev = queryClient.getQueryData<ShoppingItem[]>(queryKeys.shoppingList.items());
      queryClient.setQueryData<ShoppingItem[]>(queryKeys.shoppingList.items(), (old) => {
        if (!old) return old;
        const item = old.find((i) => i.id === id);
        if (!item) return old;
        const siblings = old
          .filter((i) => i.categoryId === item.categoryId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const idx = siblings.findIndex((i) => i.id === id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= siblings.length) return old;
        const swapItem = siblings[swapIdx];
        return old.map((i) => {
          if (i.id === id) return { ...i, sortOrder: swapItem.sortOrder };
          if (i.id === swapItem.id) return { ...i, sortOrder: item.sortOrder };
          return i;
        });
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      queryClient.setQueryData(queryKeys.shoppingList.items(), ctx?.prev);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() }),
  });

  const clearCheckedMutation = useMutation({
    mutationFn: () => api.delete('/api/shopping-list/items/checked'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
      toast.success('Cleared checked items');
    },
    onError: () => toast.error('Failed'),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; quantity?: number | null; unit?: string | null; note?: string | null } }) =>
      api.patch(`/api/shopping-list/items/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
      setEditItem(null);
      toast.success('Item updated');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const deleteImageMutation = useMutation({
    mutationFn: ({ itemId, imageId }: { itemId: string; imageId: string }) =>
      api.delete(`/api/shopping-list/items/${itemId}/images/${imageId}`),
    onSuccess: (_, { imageId }) => {
      setEditImages((imgs) => imgs.filter((i) => i.id !== imageId));
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
    },
    onError: () => toast.error('Failed to delete image'),
  });

  const openEdit = (item: ShoppingItem) => {
    setEditItem(item);
    setEditName(item.name);
    setEditQty(item.quantity != null ? String(item.quantity) : '');
    setEditUnit(item.unit ?? '');
    setEditNote(item.note ?? '');
    setEditImages([...item.images]);
  };

  const saveEdit = () => {
    if (!editItem) return;
    updateItemMutation.mutate({
      id: editItem.id,
      data: {
        name: editName.trim() || editItem.name,
        quantity: editQty ? Number(editQty) : null,
        unit: editUnit.trim() || null,
        note: editNote.trim() || null,
      },
    });
  };

  const uploadItemImage = async (file: File) => {
    if (!editItem) return;
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const img = await api.postForm<ShoppingItemImage>(`/api/shopping-list/items/${editItem.id}/images`, form);
      setEditImages((imgs) => [...imgs, img]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  // Unique users for filter dropdown
  // Apply search filter
  const displayItems = items.filter((item) => {
    if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())) return false;
    return true;
  });

  // Build a map of items by categoryId (including uncategorised under null key)
  const itemsByCategoryId = new Map<string | null, ShoppingItem[]>();
  itemsByCategoryId.set(null, []);
  for (const cat of categories) itemsByCategoryId.set(cat.id, []);
  for (const item of displayItems) {
    const key = item.categoryId ?? null;
    if (!itemsByCategoryId.has(key)) itemsByCategoryId.set(key, []);
    itemsByCategoryId.get(key)!.push(item);
  }
  // Sort items within each category
  for (const [, arr] of itemsByCategoryId) {
    if (sortBy === 'az') arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'za') arr.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortBy === 'newest') arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sortBy === 'oldest') arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else arr.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const uncategorised = itemsByCategoryId.get(null) ?? [];
  const checkedCount = items.filter((i) => i.isChecked).length;
  const hasActiveFilters = !!(sortBy !== 'default' || searchQuery.trim());

  const handleToggle = (id: string, checked: boolean) => toggleMutation.mutate({ id, isChecked: checked });
  const handleDelete = (id: string) => deleteMutation.mutate(id);
  const handleMove = (id: string, direction: 'up' | 'down') => moveMutation.mutate({ id, direction });
  const handleView = (item: ShoppingItem) => { setViewItem(item); setViewCarouselIdx(0); };
  const handleEdit = (item: ShoppingItem) => openEdit(item);

  return (
    <div className="flex flex-col items-center px-4 pb-24 pt-6">
      <div data-timer-align className="w-full max-w-3xl lg:max-w-5xl xl:max-w-6xl">

        {/* Header */}
        <div className="mb-1 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-xl font-bold">Shopping List</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Shared household list. Items added from recipes and pantry appear here automatically.
        </p>

        {/* Row 1: Add Item + Manage Categories */}
        <div className="flex gap-2 mb-2">
          <Button className="flex-1 gap-1.5 h-9 text-sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4" />Add Item
          </Button>
          <Button variant="outline" className="flex-1 gap-1.5 h-9 text-sm" onClick={() => setCategoryPanelOpen(true)}>
            <Tag className="h-4 w-4" />Manage Categories
          </Button>
        </div>

        {/* Row 2: Search + Filters — 50/50 matching recipe page style */}
        <div className="flex gap-2 mb-2">
          <div className="w-1/2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="h-9 pl-9 pr-8 text-sm w-full"
              placeholder="Search shopping list…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
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
        {checkedCount > 0 && (
          <div className="mb-2">
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 w-full"
              disabled={clearCheckedMutation.isPending}
              onClick={() => clearCheckedMutation.mutate()}>
              {clearCheckedMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Clear checked items
            </Button>
          </div>
        )}

        {/* Filter panel */}
        {filtersOpen && (
          <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="px-4 pt-3 pb-4 space-y-3">
              {/* Sort */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sort</p>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { id: 'az' as const, label: 'A–Z' },
                    { id: 'za' as const, label: 'Z–A' },
                    { id: 'newest' as const, label: 'Newest item' },
                    { id: 'oldest' as const, label: 'Oldest item' },
                  ]).map(({ id, label }) => (
                    <button key={id} type="button" onClick={() => setSortBy(sortBy === id ? 'default' : id)}
                      className={cn('rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                        sortBy === id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {hasActiveFilters && (
                <button type="button"
                  onClick={() => { setSearchQuery(''); setSortBy('default'); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Item count */}
        {items.length > 0 && (
          <div className="flex items-baseline gap-1.5 py-3 border-b border-border/50 mb-1">
            <span className="text-lg font-bold tabular-nums">{checkedCount}/{items.length}</span>
            <span className="text-sm text-muted-foreground">items</span>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* All named categories (shown even if empty) */}
            {categories.map((cat) => {
              const catItems = itemsByCategoryId.get(cat.id) ?? [];
              return (
                <CategorySection key={cat.id} label={cat.name} items={catItems}
                  onToggle={handleToggle} onMove={handleMove} onView={handleView} />
              );
            })}

            {/* Uncategorised */}
            {(uncategorised.length > 0 || categories.length === 0) && (
              <CategorySection
                label={categories.length === 0 ? 'Items' : 'Uncategorised'}
                items={uncategorised}
                onToggle={handleToggle} onMove={handleMove} onView={handleView}
              />
            )}

            {/* Empty state */}
            {items.length === 0 && categories.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Shopping list is empty</p>
                  <p className="text-xs text-muted-foreground mt-1">Tap Add Item, or push items from recipes and pantry.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <CategoryPanel
        open={categoryPanelOpen}
        onClose={() => setCategoryPanelOpen(false)}
        categories={categories}
      />

      {/* Add Item modal */}
      <AddItemModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        categories={categories}
      />

      {/* View modal */}
      <Dialog open={!!viewItem} onOpenChange={(o) => { if (!o) { setViewItem(null); setConfirmDeleteId(null); } }}>
        <DialogContent className="w-[calc(100vw-16px)] max-w-lg p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden" hideClose>
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <h3 className="font-semibold text-sm truncate pr-2">{viewItem?.name}</h3>
            <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors shrink-0">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {/* Image carousel */}
            {viewItem && viewItem.images.length > 0 && (
              <div className="relative bg-muted overflow-hidden">
                <img src={viewItem.images[viewCarouselIdx].url} alt=""
                  className="w-full h-40 object-cover"
                  onError={(e) => { e.currentTarget.style.opacity = '0'; }} />
                {/* Expand */}
                <button type="button"
                  onClick={() => setLightboxIdx(viewCarouselIdx)}
                  className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-white text-[10px] font-medium hover:bg-black/70 transition-colors z-10">
                  <Maximize2 className="h-3 w-3" />Expand
                </button>
                {viewItem.images.length > 1 && (
                  <>
                    <button type="button"
                      onClick={() => setViewCarouselIdx((i) => (i - 1 + viewItem.images.length) % viewItem.images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button"
                      onClick={() => setViewCarouselIdx((i) => (i + 1) % viewItem.images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {viewItem.images.map((_, i) => (
                        <button key={i} type="button" onClick={() => setViewCarouselIdx(i)}
                          className={cn('h-1.5 rounded-full transition-all', i === viewCarouselIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50')} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="px-4 py-4 space-y-3">
              {(viewItem?.quantity != null || viewItem?.unit) && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground text-xs font-medium w-16 shrink-0">Quantity</span>
                  <span>{viewItem?.quantity != null ? viewItem.quantity : ''}{viewItem?.unit ? ` ${viewItem.unit}` : ''}</span>
                </div>
              )}
              {viewItem?.note && (
                <div className="flex items-start gap-1.5 text-sm">
                  <span className="text-muted-foreground text-xs font-medium w-16 shrink-0 pt-0.5">Note</span>
                  <span className="text-sm leading-relaxed">{viewItem.note}</span>
                </div>
              )}
              {viewItem?.addedByUserName && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground text-xs font-medium w-16 shrink-0">Added by</span>
                  <span className="text-sm">{viewItem.addedByUserName}</span>
                </div>
              )}
              {viewItem && !viewItem.quantity && !viewItem.unit && !viewItem.note && viewItem.images.length === 0 && (
                <p className="text-sm text-muted-foreground italic text-center py-2">No additional details.</p>
              )}
            </div>
          </div>
          {/* View image lightbox — inside DialogContent so it fills the modal */}
          {lightboxIdx !== null && viewItem && viewItem.images.length > 0 && (
            <div
              className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center"
              onClick={() => setLightboxIdx(null)}>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
                className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                <X className="h-5 w-5" />
              </button>
              <img src={viewItem.images[lightboxIdx].url} alt=""
                className="max-h-[55%] max-w-[60%] object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()} />
              {viewItem.images.length > 1 && (
                <>
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => ((i ?? 0) - 1 + viewItem.images.length) % viewItem.images.length); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => ((i ?? 0) + 1) % viewItem.images.length); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {viewItem.images.map((_, i) => (
                      <button key={i} type="button"
                        onClick={(e) => { e.stopPropagation(); setLightboxIdx(i); }}
                        className={cn('h-2 rounded-full transition-all', i === lightboxIdx ? 'w-6 bg-foreground' : 'w-2 bg-foreground/30')} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Footer: Edit + Delete */}
          <div className="border-t px-4 py-3 flex gap-2 shrink-0">
            <Button variant="outline" className="flex-1 h-9 text-sm gap-1.5"
              onClick={() => { setViewItem(null); setConfirmDeleteId(null); handleEdit(viewItem!); }}>
              <Pencil className="h-3.5 w-3.5" />Edit
            </Button>
            {confirmDeleteId === viewItem?.id ? (
              <div className="flex-1 flex gap-1.5">
                <Button variant="outline" size="sm" className="flex-1 h-9 text-xs"
                  onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                <Button size="sm" className="flex-1 h-9 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  onClick={() => { deleteMutation.mutate(viewItem!.id); setViewItem(null); setConfirmDeleteId(null); }}>
                  Remove
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="flex-1 h-9 text-sm gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/5"
                onClick={() => setConfirmDeleteId(viewItem?.id ?? null)}>
                <Trash2 className="h-3.5 w-3.5" />Remove
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-sm p-0 gap-0" hideClose>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">Edit Item</h3>
            <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input className="h-9 text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Quantity</label>
              <input type="number" min="1" className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={editQty} onChange={(e) => setEditQty(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Unit</label>
              <Input className="h-9 text-sm" placeholder="e.g. kg, cups, tbsp…" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Note</label>
              <Textarea className="text-sm resize-none" rows={2} placeholder="Add a note…"
                value={editNote} onChange={(e) => setEditNote(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Images</label>
              <div className="flex flex-wrap gap-2">
                {editImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <button type="button" onClick={() => setEditLbIdx(editImages.findIndex((x) => x.id === img.id))}>
                      <img src={img.url} alt="" className="h-16 w-16 rounded-lg object-cover border" />
                    </button>
                    <button type="button"
                      onClick={() => editItem && deleteImageMutation.mutate({ itemId: editItem.id, imageId: img.id })}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) { uploadItemImage(f); e.target.value = ''; } }} />
              </div>
            </div>
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button className="flex-1" disabled={!editName.trim() || updateItemMutation.isPending} onClick={saveEdit}>
              {updateItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>

          {/* Edit image lightbox — inside DialogContent so it fills the modal */}
          {editLbIdx !== null && editImages.length > 0 && (
            <div
              className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center"
              onClick={() => setEditLbIdx(null)}>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); setEditLbIdx(null); }}
                className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                <X className="h-5 w-5" />
              </button>
              <img src={editImages[editLbIdx].url} alt=""
                className="max-h-[55%] max-w-[60%] object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()} />
              {editImages.length > 1 && (
                <>
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); setEditLbIdx((i) => ((i ?? 0) - 1 + editImages.length) % editImages.length); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); setEditLbIdx((i) => ((i ?? 0) + 1) % editImages.length); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {editImages.map((_, i) => (
                      <button key={i} type="button"
                        onClick={(e) => { e.stopPropagation(); setEditLbIdx(i); }}
                        className={cn('h-2 rounded-full transition-all', i === editLbIdx ? 'w-6 bg-foreground' : 'w-2 bg-foreground/30')} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
