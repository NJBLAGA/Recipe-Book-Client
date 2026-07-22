import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Refrigerator, Plus, Minus, Pencil, Trash2, X, SlidersHorizontal,
  ShoppingCart, ChevronDown, ChevronUp, Loader2, Check,
  Tag, Search, ChefHat, Users, BookOpenText, ChevronRight, ChevronLeft,
  ImageIcon, Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export const Route = createFileRoute('/_app/pantry')({
  component: PantryPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface PantryCategory { id: string; name: string; pantryId: string; }

interface PantryItem {
  id: string; pantryId: string; ingredientId: string; ingredientName: string;
  categoryId: string | null; categoryName: string | null;
  inStock: boolean;
  quantity: number | null; unit: string | null; notes: string | null;
  images: Array<{ id: string; url: string; sortOrder: number }>;
}

interface RecipeSummary {
  id: string; title: string; description: string | null;
  baseServings: number; categoryId: string | null; categoryName: string | null;
  images: string[]; createdAt: string;
}

// ─── Category Sidebar Panel (mirrors recipes CategoryPanel) ───────────────────

function CategoryPanel({ open, onClose, categories }: {
  open: boolean; onClose: () => void; categories: PantryCategory[];
}) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState('');

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
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.items() });
      setEditing(null);
      toast.success('Category renamed');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, target }: { id: string; target: string | null }) =>
      api.delete(`/api/pantry/categories/${id}`, { targetCategoryId: target || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.categories() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.items() });
      setDeletingId(null);
      setTargetCategoryId('');
      toast.success('Category deleted');
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
            <h2 className="font-semibold text-sm">Pantry Categories</h2>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Create new */}
          <div className="flex gap-2">
            <Input className="h-8 text-sm flex-1" placeholder="New category…" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) createMutation.mutate(); }} />
            <Button size="sm" className="h-8 text-xs shrink-0"
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}>Add</Button>
          </div>

          {/* List */}
          <div className="space-y-1.5">
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No categories yet.</p>
            )}
            {categories.map((cat) => (
              <div key={cat.id}>
                {deletingId === cat.id ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-3">
                    <p className="text-xs font-semibold text-destructive">Delete "{deletingCat?.name}"?</p>
                    {otherCategories.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">Move items to (optional):</p>
                        <Select
                          value={targetCategoryId || '__remove__'}
                          onValueChange={(v) => setTargetCategoryId(v === '__remove__' ? '' : v)}>
                          <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__remove__">Remove from category</SelectItem>
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

// ─── Add / Edit Item Modal ────────────────────────────────────────────────────

function ItemModal({ open, onClose, categories, editItem }: {
  open: boolean; onClose: () => void; categories: PantryCategory[]; editItem?: PantryItem | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [inStock, setInStock] = useState(true);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [localImages, setLocalImages] = useState<Array<{ id: string; url: string; sortOrder: number }>>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (editItem) {
        setName(editItem.ingredientName);
        setCategoryId(editItem.categoryId ?? '');
        setInStock(editItem.inStock);
        setQuantity(editItem.quantity ? String(editItem.quantity) : '');
        setUnit(editItem.unit ?? '');
        setNotes(editItem.notes ?? '');
        setLocalImages(editItem.images ?? []);
      } else {
        setName('');
        setCategoryId(categories[0]?.id ?? '');
        setInStock(true);
        setQuantity('');
        setUnit('');
        setNotes('');
        setLocalImages([]);
      }
    }
  }, [open, editItem?.id]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        categoryId: categoryId || undefined,
        inStock,
        quantity: quantity ? parseInt(quantity, 10) : null,
        unit: unit.trim() || null,
        notes: notes.trim() || null,
      };
      if (editItem) return api.patch(`/api/pantry/items/${editItem.id}`, body);
      return api.post('/api/pantry/items', { name: name.trim(), ...body });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.items() });
      toast.success(editItem ? 'Item updated' : 'Item added');
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const canSave = editItem
    ? categoryId.trim().length > 0
    : name.trim().length > 0 && categoryId.trim().length > 0;

  const handleImageUpload = async (files: FileList) => {
    if (!editItem) return;
    setImageUploading(true);
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append('image', file);
        const img = await api.postForm<{ id: string; url: string; sortOrder: number }>(
          `/api/pantry/items/${editItem.id}/images`, fd
        );
        setLocalImages((prev) => [...prev, img]);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setImageUploading(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.items() });
  };

  const handleImageDelete = async (imageId: string) => {
    if (!editItem) return;
    try {
      await api.delete(`/api/pantry/items/${editItem.id}/images/${imageId}`);
      setLocalImages((prev) => prev.filter((i) => i.id !== imageId));
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.items() });
    } catch {
      toast.error('Failed to remove image');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm p-0 gap-0 max-h-[90vh] overflow-y-auto" hideClose>
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-sm">{editItem ? 'Edit Item' : 'Add to Pantry'}</h2>
          <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        <div className="p-4 space-y-4">
          {!editItem && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item Name *</label>
              <Input className="h-9" placeholder="e.g. Sugar" value={name}
                onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category *</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue placeholder="Select a category…" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {categories.length === 0 && (
              <p className="text-[10px] text-muted-foreground">Create a category first using the Categories panel.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stock Status</label>
            <div className="flex items-center gap-2 rounded-xl border p-0.5 bg-muted/30 w-fit">
              <button type="button" onClick={() => setInStock(true)}
                className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  inStock ? 'bg-emerald-500 text-white' : 'text-muted-foreground hover:text-foreground')}>
                In Stock
              </button>
              <button type="button" onClick={() => setInStock(false)}
                className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  !inStock ? 'bg-rose-500 text-white' : 'text-muted-foreground hover:text-foreground')}>
                Out of Stock
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Packages <span className="normal-case font-normal text-muted-foreground/70">(optional)</span>
            </label>
            <div className="flex gap-2">
              <Input className="h-9 w-24" type="number" min="1" max="999" placeholder="Qty" value={quantity}
                onChange={(e) => setQuantity(e.target.value)} />
              <Input className="h-9 flex-1" placeholder="Unit (e.g. bags, cans, bottles)" value={unit}
                onChange={(e) => setUnit(e.target.value)} />
            </div>
            <p className="text-[10px] text-muted-foreground">e.g. 2 bags — represents how many packages you have.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notes <span className="normal-case font-normal text-muted-foreground/70">(optional)</span>
            </label>
            <Input className="h-9" placeholder="e.g. 500g pack, Woolworths brand…" value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* Images — only available when editing an existing item */}
          {editItem && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Photos <span className="normal-case font-normal text-muted-foreground/70">(optional)</span>
              </label>
              {localImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {localImages.map((img) => (
                    <div key={img.id} className="relative group">
                      <img src={img.url} alt="" className="h-20 w-20 rounded-xl object-cover border" />
                      <button type="button"
                        onClick={() => void handleImageDelete(img.id)}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => e.target.files && void handleImageUpload(e.target.files)} />
              <button type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageUploading}
                className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors w-full justify-center">
                {imageUploading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading…</>
                  : <><ImageIcon className="h-3.5 w-3.5" />Add photos</>}
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-4 pb-4">
          <Button variant="outline" className="flex-1 h-9" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 h-9" disabled={saveMutation.isPending || !canSave}
            onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editItem ? 'Save' : 'Add'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Item Detail Modal ────────────────────────────────────────────────────────

function ItemDetailModal({ item, open, onClose, onEdit }: {
  item: PantryItem | null; open: boolean; onClose: () => void; onEdit: (item: PantryItem) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shopModal, setShopModal] = useState<{ qty: string; unit: string; note: string; files: File[] } | null>(null);
  const [shopSubmitting, setShopSubmitting] = useState(false);
  const shopImgRef = useRef<HTMLInputElement>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => { if (open) { setConfirmDelete(false); setShopModal(null); setCarouselIdx(0); setLightboxIdx(null); } }, [open, item?.id]);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/pantry/items/${item!.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.items() });
      toast.success('Item removed');
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const toggleStockMutation = useMutation({
    mutationFn: (inStock: boolean) => api.patch(`/api/pantry/items/${item!.id}`, { inStock }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.items() });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const confirmShopToList = async () => {
    if (!shopModal || !item || shopSubmitting) return;
    setShopSubmitting(true);
    try {
      const created = await api.post<{ id: string }>('/api/shopping-list/items', {
        name: item.ingredientName,
        source: 'PANTRY',
        quantity: shopModal.qty ? Number(shopModal.qty) : null,
        unit: shopModal.unit.trim() || null,
        note: shopModal.note.trim() || null,
      });
      for (const file of shopModal.files) {
        const form = new FormData();
        form.append('image', file);
        await api.postForm(`/api/shopping-list/items/${created.id}/images`, form).catch(() => {});
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
      setShopModal(null);
      toast.success('Added to shopping list');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setShopSubmitting(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-16px)] max-w-lg p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden" hideClose>
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
            <div className="p-4 space-y-4">
              {/* Image carousel */}
              {item.images.length > 0 && (
                <div className="relative rounded-xl overflow-hidden bg-muted">
                  <img src={item.images[carouselIdx].url} alt=""
                    className="w-full h-40 object-cover"
                    onError={(e) => { e.currentTarget.style.opacity = '0'; }} />
                  {/* Expand button */}
                  <button type="button"
                    onClick={() => setLightboxIdx(carouselIdx)}
                    className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-white text-[10px] font-medium hover:bg-black/70 transition-colors z-10">
                    <Maximize2 className="h-3 w-3" />Expand
                  </button>
                  {item.images.length > 1 && (
                    <>
                      <button type="button"
                        onClick={() => setCarouselIdx((i) => (i - 1 + item.images.length) % item.images.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button type="button"
                        onClick={() => setCarouselIdx((i) => (i + 1) % item.images.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {item.images.map((_, i) => (
                          <button key={i} type="button" onClick={() => setCarouselIdx(i)}
                            className={cn('h-1.5 rounded-full transition-all', i === carouselIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50')} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Stock toggle */}
              <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Stock Status</span>
                  <span className={cn('text-xs font-bold flex items-center gap-1.5',
                    item.inStock ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
                    <span className={cn('h-2 w-2 rounded-full', item.inStock ? 'bg-emerald-500' : 'bg-rose-500')} />
                    {item.inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
                <button type="button"
                  onClick={() => toggleStockMutation.mutate(!item.inStock)}
                  disabled={toggleStockMutation.isPending}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold transition-colors',
                    item.inStock
                      ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950'
                      : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950',
                  )}>
                  {toggleStockMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : item.inStock ? 'Mark as Out of Stock' : <><Check className="h-3.5 w-3.5" />Mark as In Stock</>}
                </button>
              </div>

              {/* Quantity / unit */}
              {(item.quantity || item.unit) && (
                <div className="rounded-xl border bg-muted/20 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Packages</p>
                  <p className="text-sm font-medium">
                    {item.quantity && <span>{item.quantity} </span>}
                    {item.unit && <span>{item.unit}</span>}
                  </p>
                </div>
              )}

              {/* Notes */}
              {item.notes && (
                <div className="rounded-xl border bg-muted/20 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{item.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {item && !confirmDelete && (
          <div className="shrink-0 border-t px-4 py-3 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5"
              onClick={() => setShopModal({ qty: item?.quantity ? String(item.quantity) : '', unit: item?.unit ?? '', note: item?.notes ?? '', files: [] })}>
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

        {/* Lightbox — inside DialogContent so it fills the modal, not the full screen */}
        {lightboxIdx !== null && item && item.images.length > 0 && (
          <div
            className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setLightboxIdx(null)}>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
              className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
              <X className="h-5 w-5" />
            </button>
            <img
              src={item.images[lightboxIdx].url}
              alt=""
              className="max-h-[55%] max-w-[60%] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()} />
            {item.images.length > 1 && (
              <>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => ((i ?? 0) - 1 + item.images.length) % item.images.length); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => ((i ?? 0) + 1) % item.images.length); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {item.images.map((_, i) => (
                    <button key={i} type="button"
                      onClick={(e) => { e.stopPropagation(); setLightboxIdx(i); }}
                      className={cn('h-2 rounded-full transition-all', i === lightboxIdx ? 'w-6 bg-foreground' : 'w-2 bg-foreground/30')} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Add to shopping list modal */}
    <Dialog open={!!shopModal} onOpenChange={(o) => !o && setShopModal(null)}>
      <DialogContent className="w-[calc(100vw-48px)] max-w-sm p-0 gap-0 flex flex-col max-h-[85vh] overflow-x-hidden" hideClose>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Add to Shopping List</h3>
          </div>
          <DialogClose className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        {shopModal && item && (
          <div className="px-4 py-4 space-y-3 overflow-y-auto flex-1">
            <p className="text-sm font-medium">{item.ingredientName}</p>
            {item.images.length > 0 && (
              <img src={item.images[0].url} alt="" className="h-20 w-full object-cover rounded-xl border" />
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Quantity</label>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => setShopModal((m) => m ? { ...m, qty: String(Math.max(1, (Number(m.qty) || 0) - 1)) } : m)}
                  className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md border hover:bg-accent transition-colors text-muted-foreground">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input type="text" inputMode="numeric" className="h-8 flex-1 min-w-0 rounded-md border bg-background px-3 text-sm text-center"
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
                  <FilePreview
                    key={idx}
                    file={file}
                    onRemove={() => setShopModal((m) => m ? { ...m, files: m.files.filter((_, i) => i !== idx) } : m)}
                  />
                ))}
                <button type="button"
                  onClick={() => shopImgRef.current?.click()}
                  className="h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                  <Plus className="h-5 w-5" />
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
              <Button className="flex-1" disabled={shopSubmitting}
                onClick={() => { void confirmShopToList(); }}>
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

// ─── Ingredient Search Panel ──────────────────────────────────────────────────

type SearchScope = 'all' | 'mine' | 'community';

interface SearchResult extends RecipeSummary { _source: 'mine' | 'community'; }

function IngredientSearchPanel({ open, onClose, pantryItems, onOpenRecipe }: {
  open: boolean; onClose: () => void; pantryItems: PantryItem[];
  onOpenRecipe: (id: string, source: 'mine' | 'community') => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) { setSelected(new Set()); setIngredientSearch(''); setResults(null); }
  }, [open]);

  const filtered = pantryItems.filter((item) =>
    !ingredientSearch || item.ingredientName.toLowerCase().includes(ingredientSearch.toLowerCase())
  );

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
    setResults(null);
  };

  const search = async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (selected.size > 0) {
        params.set('ingredients', [...selected].join(','));
      }
      let data: SearchResult[] = [];
      if (scope === 'all' || scope === 'mine') {
        const mine = await api.get<RecipeSummary[]>(`/api/recipe-book/recipes?${params}`);
        data = [...data, ...mine.map((r) => ({ ...r, _source: 'mine' as const }))];
      }
      if (scope === 'all' || scope === 'community') {
        try {
          const community = await api.get<RecipeSummary[]>(`/api/community/recipes?${params}`);
          data = [...data, ...community.map((r) => ({ ...r, _source: 'community' as const }))];
        } catch { /* community may fail silently */ }
      }
      setResults(data);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-4 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-top-2 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Find Recipes by Ingredient</h2>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {results === null ? (
          <>
            {/* Scope selector */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Search in</p>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { id: 'all' as const, label: 'All', icon: ChefHat },
                  { id: 'mine' as const, label: 'My Recipes', icon: BookOpenText },
                  { id: 'community' as const, label: 'Community', icon: Users },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => setScope(id)}
                    className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                      scope === id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                    <Icon className="h-3 w-3" />{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected chips */}
            {selected.size > 0 && (
              <div className="px-4 pb-2 shrink-0">
                <div className="flex flex-wrap gap-1.5">
                  {[...selected].map((name) => (
                    <span key={name} className="flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-xs font-medium">
                      {name}
                      <button type="button" onClick={() => toggle(name)} className="ml-0.5 hover:text-foreground transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Ingredient filter */}
            <div className="px-4 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input className="h-9 pl-9 text-sm" placeholder="Filter pantry items…"
                  value={ingredientSearch} onChange={(e) => setIngredientSearch(e.target.value)} />
              </div>
            </div>

            {/* Pantry item list */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 space-y-1 min-h-0">
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No items match.</p>
              )}
              {filtered.map((item) => {
                const isSelected = selected.has(item.ingredientName);
                return (
                  <button key={item.id} type="button" onClick={() => toggle(item.ingredientName)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                      isSelected ? 'border-primary/40 bg-primary/5' : 'hover:bg-accent/30',
                    )}>
                    <span className={cn('h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30')}>
                      {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </span>
                    <span className="flex-1 text-sm font-medium">{item.ingredientName}</span>
                    <span className={cn('h-2 w-2 rounded-full shrink-0', item.inStock ? 'bg-emerald-500' : 'bg-rose-500')} />
                  </button>
                );
              })}
            </div>

            {/* Search button — always visible */}
            <div className="shrink-0 px-4 pb-4 pt-3 border-t mt-2">
              <Button className="w-full gap-2" disabled={searching} onClick={search}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {selected.size > 0
                  ? `Search with ${selected.size} ingredient${selected.size > 1 ? 's' : ''}`
                  : 'Search All Recipes'}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Results header */}
            <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setResults(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-xs text-muted-foreground">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                  {selected.size > 0 && ` · ${selected.size} ingredient${selected.size > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2 min-h-0">
              {results.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <ChefHat className="h-10 w-10 text-muted-foreground" />
                  <p className="font-semibold text-sm">No recipes found</p>
                  <p className="text-xs text-muted-foreground">Try selecting fewer ingredients or a wider scope.</p>
                </div>
              ) : results.map((r) => (
                <button key={`${r._source}-${r.id}`} type="button"
                  onClick={() => { onOpenRecipe(r.id, r._source); onClose(); }}
                  className="w-full flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 hover:bg-accent/30 transition-colors text-left">
                  {r.images?.[0] ? (
                    <img src={r.images[0]} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                      <ChefHat className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{r.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {r._source === 'community'
                        ? <><Users className="h-3 w-3 text-muted-foreground" /><span className="text-[11px] text-muted-foreground">Community</span></>
                        : <><BookOpenText className="h-3 w-3 text-muted-foreground" /><span className="text-[11px] text-muted-foreground">My Recipes</span></>}
                      {r.categoryName && <><span className="text-muted-foreground/40">·</span><span className="text-[11px] text-muted-foreground truncate">{r.categoryName}</span></>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── File Preview (revokes blob URL on unmount) ───────────────────────────────

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="relative group">
      <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover border" />
      <button type="button" onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

// ─── Pantry Item Card ─────────────────────────────────────────────────────────

function PantryItemCard({ item, onClick }: { item: PantryItem; onClick: () => void }) {
  return (
    <button type="button"
      className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3 w-full text-left hover:bg-accent/40 hover:border-primary/30 transition-all cursor-pointer"
      onClick={onClick}>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-semibold leading-snug line-clamp-1">{item.ingredientName}</p>
        <span className={cn(
          'inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none',
          item.inStock
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
        )}>
          <span className={cn('h-1 w-1 rounded-full shrink-0', item.inStock ? 'bg-emerald-500' : 'bg-rose-500')} />
          {item.inStock ? 'In Stock' : 'Out of Stock'}
        </span>
        {item.notes && (
          <p className="text-[10px] text-muted-foreground line-clamp-1">{item.notes}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
    </button>
  );
}

// ─── Category Group ───────────────────────────────────────────────────────────

const CAT_PAGE_SIZE = 8;

function CategoryGroup({ label, items, onItemClick }: {
  label: string; items: PantryItem[]; onItemClick: (item: PantryItem) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [catPage, setCatPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / CAT_PAGE_SIZE));
  const safePage = Math.min(catPage, totalPages);
  const pageItems = items.slice((safePage - 1) * CAT_PAGE_SIZE, safePage * CAT_PAGE_SIZE);

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 text-left">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">({items.length})</span>
        <span className="flex-1 h-px bg-border" />
        {collapsed
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>
      {!collapsed && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {pageItems.map((item) => (
              <PantryItemCard key={item.id} item={item} onClick={() => onItemClick(item)} />
            ))}
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

function PantryPage() {
  const navigate = useNavigate();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'out'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PantryItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<PantryItem | null>(null);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [pantrySearch, setPantrySearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.pantry.categories(),
    queryFn: () => api.get<PantryCategory[]>('/api/pantry/categories'),
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.pantry.items(),
    queryFn: () => api.get<PantryItem[]>('/api/pantry/items'),
  });

  const filteredItems = items.filter((item) => {
    if (activeCategoryId && item.categoryId !== activeCategoryId) return false;
    if (stockFilter === 'in' && !item.inStock) return false;
    if (stockFilter === 'out' && item.inStock) return false;
    if (pantrySearch.trim() && !item.ingredientName.toLowerCase().includes(pantrySearch.toLowerCase().trim())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const grouped = new Map<string, { label: string; items: PantryItem[] }>();

  for (const item of pagedItems) {
    const catId = item.categoryId ?? '__none__';
    const catLabel = item.categoryName ?? 'Uncategorised';
    if (!grouped.has(catId)) grouped.set(catId, { label: catLabel, items: [] });
    grouped.get(catId)!.items.push(item);
  }

  const hasActiveFilters = activeCategoryId !== null || stockFilter !== 'all';

  useEffect(() => { setPage(1); }, [activeCategoryId, stockFilter, pantrySearch]);

  const handleOpenEdit = (item: PantryItem) => {
    setSelectedItem(null);
    setEditItem(item);
    setAddOpen(true);
  };

  return (
    <div className="flex flex-col items-center px-4 pb-24 pt-6">
      <div data-timer-align className="w-full max-w-md sm:max-w-xl lg:max-w-3xl xl:max-w-5xl">

        {/* Header */}
        <div className="mb-1 flex items-center gap-2">
          <Refrigerator className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-xl font-bold">Pantry</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          Track what your household has in stock. Items link to recipes and your shopping list.
        </p>

        {/* Row 1: Add Item + Manage Categories (exact 50/50) */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Button className="w-full gap-1.5 h-9 text-sm" onClick={() => { setEditItem(null); setAddOpen(true); }}>
            <Plus className="h-4 w-4" />Add Item
          </Button>
          <Button variant="outline" className="w-full gap-1.5 h-9 text-sm" onClick={() => setCategoryPanelOpen(true)}>
            <Tag className="h-4 w-4" />Manage Categories
          </Button>
        </div>

        {/* Row 2: Search Pantry + Find by Ingredient (exact 50/50) */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="h-9 pl-9 pr-9 text-sm w-full"
              placeholder="Search pantry…"
              value={pantrySearch}
              onChange={(e) => setPantrySearch(e.target.value)}
            />
            {pantrySearch && (
              <button type="button" onClick={() => setPantrySearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant="outline" className="w-full gap-1.5 h-9 text-sm" onClick={() => setSearchPanelOpen(true)}>
            <Search className="h-4 w-4" />Find by Ingredient
          </Button>
        </div>

        {/* Row 3: Filters */}
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-2 px-3 h-9 rounded-xl border border-border/60 bg-card/50 text-left hover:bg-accent/30 transition-colors">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium">Filters</span>
            {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0', filtersOpen && 'rotate-180')} />
          </button>
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="px-4 pt-3 pb-4 space-y-3">
              {/* Category filter */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</p>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setActiveCategoryId(null)}
                    className={cn('rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                      activeCategoryId === null ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                    All
                  </button>
                  {categories.map((cat) => (
                    <button key={cat.id} type="button" onClick={() => setActiveCategoryId(cat.id === activeCategoryId ? null : cat.id)}
                      className={cn('rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                        activeCategoryId === cat.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stock filter */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stock</p>
                <div className="flex gap-1.5">
                  {([
                    { id: 'all' as const, label: 'All' },
                    { id: 'in' as const, label: 'In Stock' },
                    { id: 'out' as const, label: 'Out of Stock' },
                  ] as const).map(({ id, label }) => (
                    <button key={id} type="button" onClick={() => setStockFilter(id)}
                      className={cn('rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                        stockFilter === id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {hasActiveFilters && (
                <button type="button"
                  onClick={() => { setActiveCategoryId(null); setStockFilter('all'); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />In stock</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />Out of stock</span>
          <span className="ml-auto text-[10px]">{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}</span>
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
              <p className="text-xs text-muted-foreground mt-1">Add ingredients to track what you have in stock.</p>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="font-semibold text-sm">No items match your filters</p>
            <button type="button" onClick={() => { setActiveCategoryId(null); setStockFilter('all'); }}
              className="text-xs text-primary hover:underline">Clear filters</button>
          </div>
        ) : (
          <div className="space-y-6">
            {activeCategoryId ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {pagedItems.map((item) => (
                  <PantryItemCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
                ))}
              </div>
            ) : (
              <>
                {[...grouped.entries()].map(([id, { label, items: groupItems }]) => (
                  <CategoryGroup key={id} label={label} items={groupItems}
                    onItemClick={(item) => setSelectedItem(item)} />
                ))}
              </>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button type="button" disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={cn('flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                    safePage <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent')}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <button type="button" disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className={cn('flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                    safePage >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent')}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ItemDetailModal
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onEdit={handleOpenEdit}
      />

      <ItemModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setEditItem(null); }}
        categories={categories}
        editItem={editItem}
      />

      <CategoryPanel
        open={categoryPanelOpen}
        onClose={() => setCategoryPanelOpen(false)}
        categories={categories}
      />

      <IngredientSearchPanel
        open={searchPanelOpen}
        onClose={() => setSearchPanelOpen(false)}
        pantryItems={items}
        onOpenRecipe={(id, source) => {
          setSearchPanelOpen(false);
          if (source === 'mine') {
            void navigate({ to: '/recipes', search: { openRecipeId: id } });
          } else {
            void navigate({ to: '/community' });
          }
        }}
      />

    </div>
  );
}
