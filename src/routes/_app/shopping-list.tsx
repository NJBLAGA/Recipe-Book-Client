import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Plus, Pencil, Trash2, X, Check, Loader2, ChevronDown, ChevronUp,
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
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  isChecked: boolean;
  categoryId: string | null;
  categoryName: string | null;
  source: 'RECIPE' | 'PANTRY' | 'DIRECT';
  createdAt: string;
}

// ─── Category Manager ─────────────────────────────────────────────────────────

function ShoppingCategoryManager({ open, onClose, categories }: {
  open: boolean; onClose: () => void; categories: ShoppingCategory[];
}) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

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
    mutationFn: (id: string) => api.delete(`/api/shopping-list/categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.categories() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
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

// ─── Add Item Form ─────────────────────────────────────────────────────────────

function AddItemForm({ categories, onAdded }: { categories: ShoppingCategory[]; onAdded: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expanded, setExpanded] = useState(false);

  const addMutation = useMutation({
    mutationFn: () => api.post('/api/shopping-list/items', {
      name: name.trim(),
      quantity: quantity ? parseFloat(quantity) || null : null,
      unit: unit.trim() || null,
      categoryId: categoryId || null,
      source: 'DIRECT',
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
      setName('');
      setQuantity('');
      setUnit('');
      onAdded();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <div className="rounded-2xl border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input className="h-9 flex-1 text-sm" placeholder="Add item…" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) addMutation.mutate(); }} />
        <Button size="sm" className="h-9 gap-1.5 shrink-0" disabled={!name.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}>
          {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
        <button type="button" onClick={() => setExpanded((e) => !e)}
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border hover:bg-accent transition-colors text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {expanded && (
        <div className="grid grid-cols-3 gap-2">
          <Input className="h-8 text-xs" placeholder="Qty" value={quantity}
            onChange={(e) => setQuantity(e.target.value)} />
          <Input className="h-8 text-xs" placeholder="Unit" value={unit}
            onChange={(e) => setUnit(e.target.value)} />
          <select className="h-8 rounded-md border bg-input px-2 text-xs"
            value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// ─── Shopping Item Row ─────────────────────────────────────────────────────────

function ShoppingItemRow({ item, onToggle, onDelete }: {
  item: ShoppingItem;
  onToggle: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const sourceBadge = item.source === 'RECIPE' ? 'Recipe' : item.source === 'PANTRY' ? 'Pantry' : null;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 border bg-card transition-all',
      item.isChecked && 'opacity-50',
    )}>
      <button type="button"
        onClick={() => onToggle(item.id, !item.isChecked)}
        className={cn(
          'shrink-0 flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors',
          item.isChecked
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-border hover:border-primary/50',
        )}>
        {item.isChecked && <Check className="h-3 w-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <span className={cn('text-sm', item.isChecked && 'line-through text-muted-foreground')}>
          {item.quantity != null && (
            <span className="font-medium">{item.quantity}{item.unit ? ` ${item.unit} ` : ' '}</span>
          )}
          {item.name}
        </span>
        {sourceBadge && (
          <span className="ml-2 text-[10px] text-muted-foreground">{sourceBadge}</span>
        )}
      </div>

      <button type="button" onClick={() => onDelete(item.id)}
        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Category Section ──────────────────────────────────────────────────────────

function CategorySection({ label, items, onToggle, onDelete }: {
  label: string;
  items: ShoppingItem[];
  onToggle: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const checkedCount = items.filter((i) => i.isChecked).length;

  return (
    <div className="space-y-1.5">
      <button type="button" onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 text-left py-0.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">
          {checkedCount}/{items.length}
        </span>
        <span className="flex-1 h-px bg-border" />
        {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>
      {!collapsed && (
        <div className="space-y-1.5">
          {items.map((item) => (
            <ShoppingItemRow key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ShoppingListPage() {
  const queryClient = useQueryClient();
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

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

  const clearCheckedMutation = useMutation({
    mutationFn: () => api.delete('/api/shopping-list/items/checked'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.items() });
      toast.success('Cleared checked items');
    },
    onError: () => toast.error('Failed'),
  });

  // Group items by category
  const grouped = new Map<string, { label: string; items: ShoppingItem[] }>();
  const uncategorised: ShoppingItem[] = [];

  for (const item of items) {
    if (item.categoryId && item.categoryName) {
      if (!grouped.has(item.categoryId)) grouped.set(item.categoryId, { label: item.categoryName, items: [] });
      grouped.get(item.categoryId)!.items.push(item);
    } else {
      uncategorised.push(item);
    }
  }

  const checkedCount = items.filter((i) => i.isChecked).length;
  const totalCount = items.length;

  return (
    <div className="flex flex-col items-center px-4 pb-24 pt-6">
      <div className="w-full max-w-md sm:max-w-xl lg:max-w-3xl xl:max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-xl font-bold">Shopping List</h1>
            {totalCount > 0 && (
              <span className="text-xs text-muted-foreground ml-0.5">
                {checkedCount}/{totalCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {checkedCount > 0 && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
                disabled={clearCheckedMutation.isPending}
                onClick={() => clearCheckedMutation.mutate()}>
                {clearCheckedMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Clear checked
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground"
              onClick={() => setCategoryManagerOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />Categories
            </Button>
          </div>
        </div>

        {/* Add item form */}
        <div className="mb-5">
          <AddItemForm categories={categories} onAdded={() => {}} />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <ShoppingCart className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">Shopping list is empty</p>
              <p className="text-xs text-muted-foreground mt-1">Add items above, or push them from your recipes and pantry.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {[...grouped.entries()].map(([id, { label, items: groupItems }]) => (
              <CategorySection key={id} label={label} items={groupItems}
                onToggle={(itemId, checked) => toggleMutation.mutate({ id: itemId, isChecked: checked })}
                onDelete={(itemId) => deleteMutation.mutate(itemId)}
              />
            ))}
            {uncategorised.length > 0 && (
              grouped.size > 0 ? (
                <CategorySection label="Uncategorised" items={uncategorised}
                  onToggle={(itemId, checked) => toggleMutation.mutate({ id: itemId, isChecked: checked })}
                  onDelete={(itemId) => deleteMutation.mutate(itemId)}
                />
              ) : (
                <div className="space-y-1.5">
                  {uncategorised.map((item) => (
                    <ShoppingItemRow key={item.id} item={item}
                      onToggle={(itemId, checked) => toggleMutation.mutate({ id: itemId, isChecked: checked })}
                      onDelete={(itemId) => deleteMutation.mutate(itemId)}
                    />
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      <ShoppingCategoryManager
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
        categories={categories}
      />
    </div>
  );
}
