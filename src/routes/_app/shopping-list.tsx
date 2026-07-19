import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Plus, Pencil, Trash2, X, Check, Loader2,
  ChevronDown, ChevronUp, Tag, ArrowUp, ArrowDown, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export const Route = createFileRoute('/_app/shopping-list')({
  component: ShoppingListPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShoppingCategory { id: string; name: string; shoppingListId: string; }

interface ShoppingItem {
  id: string; name: string;
  quantity: number | null; unit: string | null;
  isChecked: boolean; categoryId: string | null; categoryName: string | null;
  source: 'RECIPE' | 'PANTRY' | 'DIRECT'; sortOrder: number;
  addedByUserId: string | null; addedByUserName: string | null;
  createdAt: string;
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
                        <select className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                          value={targetCategoryId} onChange={(e) => setTargetCategoryId(e.target.value)}>
                          <option value="">Move to Misc</option>
                          {otherCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
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

function AddItemForm({ categories }: { categories: ShoppingCategory[] }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expanded, setExpanded] = useState(false);

  const addMutation = useMutation({
    mutationFn: () => api.post('/api/shopping-list/items', {
      name: name.trim(), categoryId: categoryId || null, source: 'DIRECT',
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
      setName('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <div className="rounded-2xl border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input className="h-9 flex-1 text-sm" placeholder="Add item…" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) addMutation.mutate(); }} />
        <Button size="sm" className="h-9 shrink-0" disabled={!name.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}>
          {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
        <button type="button" onClick={() => setExpanded((e) => !e)}
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border hover:bg-accent transition-colors text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {expanded && (
        <select className="h-8 w-full rounded-md border bg-background px-2 text-xs"
          value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
    </div>
  );
}

// ─── Shopping Item Row ─────────────────────────────────────────────────────────

function ShoppingItemRow({ item, isFirst, isLast, onToggle, onDelete, onMove }: {
  item: ShoppingItem; isFirst: boolean; isLast: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
}) {
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-xl px-3 py-2.5 border bg-card transition-all',
      item.isChecked && 'opacity-50',
    )}>
      <button type="button"
        onClick={() => onToggle(item.id, !item.isChecked)}
        className={cn(
          'shrink-0 flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors',
          item.isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary/50',
        )}>
        {item.isChecked && <Check className="h-3 w-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <span className={cn('text-sm', item.isChecked && 'line-through text-muted-foreground')}>
          {item.name}
        </span>
        {item.addedByUserName && (
          <div className="flex items-center gap-1 mt-0.5">
            <User className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
            <span className="text-[10px] text-muted-foreground/60 truncate">{item.addedByUserName}</span>
          </div>
        )}
      </div>

      <div className="shrink-0 flex flex-col gap-0">
        <button type="button" disabled={isFirst} onClick={() => onMove(item.id, 'up')}
          className="disabled:opacity-20 text-muted-foreground hover:text-foreground transition-colors p-0.5">
          <ArrowUp className="h-3 w-3" />
        </button>
        <button type="button" disabled={isLast} onClick={() => onMove(item.id, 'down')}
          className="disabled:opacity-20 text-muted-foreground hover:text-foreground transition-colors p-0.5">
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>

      <button type="button" onClick={() => onDelete(item.id)}
        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Category Section ──────────────────────────────────────────────────────────

function CategorySection({ label, items, onToggle, onDelete, onMove }: {
  label: string; items: ShoppingItem[];
  onToggle: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const checkedCount = items.filter((i) => i.isChecked).length;

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
        <div className="space-y-1.5">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3 italic">No items in this category</p>
          ) : items.map((item, idx) => (
            <ShoppingItemRow key={item.id} item={item}
              isFirst={idx === 0} isLast={idx === items.length - 1}
              onToggle={onToggle} onDelete={onDelete} onMove={onMove} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ShoppingListPage() {
  const queryClient = useQueryClient();
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);

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

  // Build a map of items by categoryId (including uncategorised under null key)
  const itemsByCategoryId = new Map<string | null, ShoppingItem[]>();
  itemsByCategoryId.set(null, []);
  for (const cat of categories) itemsByCategoryId.set(cat.id, []);
  for (const item of items) {
    const key = item.categoryId ?? null;
    if (!itemsByCategoryId.has(key)) itemsByCategoryId.set(key, []);
    itemsByCategoryId.get(key)!.push(item);
  }
  // Sort items within each category by sortOrder
  for (const [, arr] of itemsByCategoryId) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const uncategorised = itemsByCategoryId.get(null) ?? [];
  const checkedCount = items.filter((i) => i.isChecked).length;

  const handleToggle = (id: string, checked: boolean) => toggleMutation.mutate({ id, isChecked: checked });
  const handleDelete = (id: string) => deleteMutation.mutate(id);
  const handleMove = (id: string, direction: 'up' | 'down') => moveMutation.mutate({ id, direction });

  return (
    <div className="flex flex-col items-center px-4 pb-24 pt-6">
      <div className="w-full max-w-md sm:max-w-xl lg:max-w-3xl xl:max-w-5xl">

        {/* Header */}
        <div className="mb-1 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-xl font-bold">Shopping List</h1>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground ml-0.5">{checkedCount}/{items.length}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Shared household list. Items added from recipes and pantry appear here automatically.
        </p>

        {/* Toolbar */}
        <div className="flex gap-2 mb-4">
          <Button variant="outline" className="gap-1.5 h-9 text-sm" onClick={() => setCategoryPanelOpen(true)}>
            <Tag className="h-4 w-4" />Categories
          </Button>
          {checkedCount > 0 && (
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 ml-auto"
              disabled={clearCheckedMutation.isPending}
              onClick={() => clearCheckedMutation.mutate()}>
              {clearCheckedMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Clear checked
            </Button>
          )}
        </div>

        {/* Add item form */}
        <div className="mb-6">
          <AddItemForm categories={categories} />
        </div>

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
                  onToggle={handleToggle} onDelete={handleDelete} onMove={handleMove} />
              );
            })}

            {/* Uncategorised */}
            {(uncategorised.length > 0 || categories.length === 0) && (
              <CategorySection
                label={categories.length === 0 ? 'Items' : 'Uncategorised'}
                items={uncategorised}
                onToggle={handleToggle} onDelete={handleDelete} onMove={handleMove}
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
                  <p className="text-xs text-muted-foreground mt-1">Add items above, or push them from recipes and pantry.</p>
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
    </div>
  );
}
