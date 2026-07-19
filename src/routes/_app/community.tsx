import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Users, BookOpen, UserPlus, UserMinus,
  Send, UtensilsCrossed, Lock, Plus, ChevronRight, ChevronDown,
  Trash2, Star, ChevronLeft, LayoutList, X, Scale, ChefHat, MessageSquare, Eye, Pencil,
  SlidersHorizontal, TrendingUp, Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useMe } from '@/hooks/useMe';
import { useMeasureSystem } from '@/hooks/useMeasureSystem';
import type { MeasureSystem } from '@/hooks/useMeasureSystem';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/community')({
  component: CommunityPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommunityUser {
  id: string; name: string | null; handle: string | null;
  image: string | null; bio: string | null;
  householdId: string | null; householdName: string | null;
}

interface FollowedUser {
  id: string; name: string | null; handle: string | null;
  image: string | null; isPublic: boolean; followedAt: string;
  householdId: string | null;
}

interface CommunityPost {
  id: string; comment: string; createdAt: string;
  userId: string; userName: string | null; userHandle: string | null; userImage: string | null;
  recipeId: string | null; recipeTitle: string | null; recipeDescription: string | null;
  recipeImages: string[]; isFollowing: boolean; isOwnPost: boolean;
  reviewCount: number; recipeAvgRating: number | null; sameHousehold: boolean;
}

interface RecipeItem {
  id: string; title: string; description: string | null;
  categoryId: string | null; categoryName: string | null; image: string | null;
}

interface RecipeIngredient {
  id: string; name: string; quantity: string | null; unit: string | null;
  note: string | null; sortOrder: number;
}

interface RecipeDetail {
  id: string; title: string; description: string | null;
  baseServings: number; steps: string[]; categoryName: string | null;
  ingredients: RecipeIngredient[];
  images: { url: string; sortOrder: number }[];
}

interface RecipeReview {
  id: string; rating: number; comment: string | null; updatedAt: string;
  reviewerName: string | null; reviewerHandle: string | null; reviewerImage: string | null;
  reviewerId: string | null;
}

interface ProfilePin {
  position: number; recipeId: string | null; recipeTitle: string | null;
  recipeDescription: string | null; recipeImage: string | null;
  recipeRating: { avg: number; count: number } | null;
}

interface PublicProfile {
  id: string; name: string | null; handle: string | null;
  bio: string | null; image: string | null; isPublic: boolean; pins: ProfilePin[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null, fallback: string) {
  if (!name) return fallback[0]?.toUpperCase() ?? '?';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function round(n: number): string {
  if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
  return n < 10 ? n.toFixed(1) : Math.round(n).toString();
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
    })
    .replace(/(\d+(?:\.\d+)?)\s+degrees?\s+(celsius|fahrenheit|centigrade|[CF])\b/gi, (_, num, unit) => {
      const n = parseFloat(num);
      const u = unit.toLowerCase();
      const isC = u === 'c' || u === 'celsius' || u === 'centigrade';
      const isF = u === 'f' || u === 'fahrenheit';
      if (!isC && !isF) return _;
      if (system === 'imperial' && isC) return `${round(n * 9 / 5 + 32)}°F`;
      if (system === 'metric' && isF) return `${round((n - 32) * 5 / 9)}°C`;
      return `${num}°${isC ? 'C' : 'F'}`;
    });
}

function scaleQty(qty: string | null, base: number, target: number): string | null {
  if (!qty) return null;
  const n = parseFloat(qty);
  if (isNaN(n)) return qty;
  return round((n * target) / base);
}

function StarDisplay({ rating, count }: { rating: number; count?: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => {
          const state: 'full' | 'half' | 'empty' =
            rounded >= i ? 'full' : rounded >= i - 0.5 ? 'half' : 'empty';
          if (state === 'full') return <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />;
          if (state === 'half') return (
            <span key={i} className="relative inline-block h-3 w-3">
              <Star className="h-3 w-3 text-muted-foreground/25" />
              <Star className="absolute inset-0 h-3 w-3 fill-amber-400 text-amber-400 [clip-path:inset(0_50%_0_0)]" />
            </span>
          );
          return <Star key={i} className="h-3 w-3 text-muted-foreground/25" />;
        })}
      </div>
      {count !== undefined && <span className="text-[10px] text-muted-foreground">({count})</span>}
    </div>
  );
}

function HalfStarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;
  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const state: 'full' | 'half' | 'empty' =
          display >= star ? 'full' : display >= star - 0.5 ? 'half' : 'empty';
        return (
          <div key={star} className="relative h-6 w-6 cursor-pointer">
            {state === 'full' && <Star className="h-6 w-6 fill-amber-400 text-amber-400" />}
            {state === 'half' && (
              <>
                <Star className="h-6 w-6 text-muted-foreground/30" />
                <Star className="absolute inset-0 h-6 w-6 fill-amber-400 text-amber-400 [clip-path:inset(0_50%_0_0)]" />
              </>
            )}
            {state === 'empty' && <Star className="h-6 w-6 text-muted-foreground/30" />}
            <button type="button"
              className="absolute inset-y-0 left-0 w-1/2 focus:outline-none"
              onMouseEnter={() => setHovered(star - 0.5)}
              onClick={() => onChange(star - 0.5)}
            />
            <button type="button"
              className="absolute inset-y-0 right-0 w-1/2 focus:outline-none"
              onMouseEnter={() => setHovered(star)}
              onClick={() => onChange(star)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── User Profile Modal ───────────────────────────────────────────────────────

interface ProfileModalTarget {
  userId: string; name: string | null; handle: string | null; image: string | null;
  sameHousehold: boolean;
}

function UserProfileModal({ target, meId, open, onClose }: {
  target: ProfileModalTarget | null; meId: string; open: boolean; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [pinViewTarget, setPinViewTarget] = useState<PinViewTarget | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.users.profile(target?.handle ?? ''),
    queryFn: () => api.get<PublicProfile>(`/api/users/${target!.handle}`),
    enabled: open && !!target?.handle,
  });

  const pinRequestMutation = useMutation({
    mutationFn: ({ recipeId, ownerId }: { recipeId: string; ownerId: string }) =>
      api.post('/api/shares/request', { recipeId, ownerId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shares.sent() });
      toast.success('Recipe Requested');
      setRequestingId(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Request Failed');
      setRequestingId(null);
    },
  });

  if (!target) return null;
  const ini = initials(target.name, target.handle ?? target.userId);
  const isCurrentUser = target.userId === meId;
  const isHousehold = target.sameHousehold;
  const activePins = (profile?.pins ?? []).filter((p) => p.recipeId !== null);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-sm sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
          <div className="relative h-16 bg-muted/40 border-b shrink-0">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
              <div className="rounded-full p-1 bg-background shadow-md ring-4 ring-background">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={target.image ?? undefined} />
                  <AvatarFallback className="text-xl font-bold">{ini}</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
          <div className="scrollbar-hide overflow-y-auto flex-1 pt-10 pb-5 px-5 space-y-4">
            <div className="text-center space-y-0.5">
              <p className="font-bold text-base">{target.name ?? 'User'}</p>
              {target.handle && <p className="text-muted-foreground text-sm">@{target.handle}</p>}
            </div>
            {isLoading && <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" /></div>}
            {!isLoading && profile?.bio && (
              <div className="rounded-xl bg-muted/50 border border-border/40 px-3 py-2.5">
                <p className="text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
              </div>
            )}
            {!isLoading && profile && !profile.bio && <p className="text-center text-xs text-muted-foreground italic">No bio yet.</p>}
            {!isLoading && activePins.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Pinned Recipes</p>
                <div className="space-y-2.5">
                  {activePins.map((pin) => (
                    <div key={pin.position}
                      className="relative flex items-center gap-3 rounded-xl border bg-card p-2.5">
                      <span className="absolute -top-2 -left-2 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow-sm leading-none">
                        {pin.position}
                      </span>
                      {pin.recipeImage
                        ? <img src={pin.recipeImage} alt={pin.recipeTitle ?? ''} className="h-14 w-14 rounded-lg object-cover shrink-0" />
                        : <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0"><UtensilsCrossed className="h-5 w-5 text-muted-foreground/40" /></div>}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-sm font-semibold truncate">{pin.recipeTitle}</p>
                        {pin.recipeDescription && <p className="text-xs text-muted-foreground line-clamp-1">{pin.recipeDescription}</p>}
                        {pin.recipeRating && pin.recipeRating.count > 0 && <StarDisplay rating={pin.recipeRating.avg} count={pin.recipeRating.count} />}
                      </div>
                      {pin.recipeId && target.handle && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                            onClick={() => setPinViewTarget({ recipeId: pin.recipeId!, recipeTitle: pin.recipeTitle, recipeDescription: pin.recipeDescription, recipeImage: pin.recipeImage, ownerHandle: target.handle!, ownerId: target.userId, sameHousehold: isHousehold })}>
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {!isCurrentUser && !isHousehold && (
                            <button type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                              disabled={requestingId === pin.recipeId || pinRequestMutation.isPending}
                              onClick={() => {
                                setRequestingId(pin.recipeId!);
                                pinRequestMutation.mutate({ recipeId: pin.recipeId!, ownerId: target.userId });
                              }}>
                              {requestingId === pin.recipeId
                                ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
                                : <Send className="h-3.5 w-3.5" />
                              }
                            </button>
                          )}
                          {!isCurrentUser && isHousehold && (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/50 cursor-default" title="Same household">
                              <Users className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <PublicPinViewModal
        target={pinViewTarget}
        meId={meId}
        open={!!pinViewTarget}
        onClose={() => setPinViewTarget(null)}
      />
    </>
  );
}

// ─── Public pin view modal ────────────────────────────────────────────────────

interface PinViewTarget {
  recipeId: string; recipeTitle: string | null; recipeDescription: string | null;
  recipeImage: string | null; ownerHandle: string; ownerId: string;
  sameHousehold: boolean;
}

function PublicPinViewModal({ target, meId, open, onClose }: {
  target: PinViewTarget | null; meId: string; open: boolean; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [servings, setServings] = useState<number | null>(null);
  const [system, setSystem] = useMeasureSystem();
  const [imgIdx, setImgIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const reviewCommentRef = useRef<HTMLTextAreaElement | undefined>(undefined);

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: queryKeys.users.pinRecipe(target?.ownerHandle ?? '', target?.recipeId ?? ''),
    queryFn: () => api.get<RecipeDetail>(`/api/users/${target!.ownerHandle}/recipes/${target!.recipeId}`),
    enabled: open && !!target,
  });

  const { data: receivedShares = [] } = useQuery({
    queryKey: queryKeys.shares.received(),
    queryFn: () => api.get<{ id: string; recipeId: string | null; status: string }[]>('/api/shares/received'),
    enabled: open && !!target && target.ownerId !== meId,
  });

  const myShare = receivedShares.find(
    (s) => s.recipeId === target?.recipeId && s.status === 'ACCEPTED'
  );

  const { data: myReview = null } = useQuery({
    queryKey: queryKeys.shares.review(myShare?.id ?? ''),
    queryFn: async () => {
      try { return await api.get<{ id: string; rating: number; comment: string | null }>(`/api/shares/${myShare!.id}/review`); }
      catch (e) { if (e instanceof ApiError && (e as ApiError).status === 404) return null; throw e; }
    },
    enabled: !!myShare,
  });

  const requestMutation = useMutation({
    mutationFn: () => api.post('/api/shares/request', { recipeId: target!.recipeId, ownerId: target!.ownerId }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.shares.sent() }); toast.success('Recipe Requested'); },
    onError: (err) => {
      if (err instanceof ApiError && (err as any).sameHousehold) {
        toast.info('This person is in your household — you already share access to their recipes.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Request Failed');
      }
    },
  });

  const submitReview = useMutation({
    mutationFn: () =>
      myReview
        ? api.patch(`/api/shares/${myShare!.id}/review`, { rating: reviewRating, comment: reviewComment || null })
        : api.post(`/api/shares/${myShare!.id}/review`, { rating: reviewRating, comment: reviewComment || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shares.review(myShare!.id) });
      toast.success(myReview ? 'Review Updated' : 'Review Submitted');
      setShowReviewForm(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  useEffect(() => {
    if (open) { setImgIdx(0); setLightboxIdx(null); setShowReviewForm(false); setReviewRating(0); setReviewComment(''); }
  }, [open]);

  useEffect(() => {
    if (detail) setServings(detail.baseServings);
  }, [detail?.id]);

  useEffect(() => {
    if (myReview && showReviewForm) { setReviewRating(myReview.rating); setReviewComment(myReview.comment ?? ''); }
  }, [myReview, showReviewForm]);

  useEffect(() => {
    if (reviewCommentRef.current) {
      reviewCommentRef.current.style.height = 'auto';
      reviewCommentRef.current.style.height = `${reviewCommentRef.current.scrollHeight}px`;
    }
  }, [reviewComment]);

  if (!target) return null;
  const isOwnRecipe = target.ownerId === meId;
  const isHousehold = target.sameHousehold;
  const effectiveServings = servings ?? detail?.baseServings ?? 4;
  const base = detail?.baseServings ?? 1;
  const images = detail?.images?.length
    ? [...detail.images].sort((a, b) => a.sortOrder - b.sortOrder)
    : target.recipeImage ? [{ url: target.recipeImage, sortOrder: 0 }] : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-lg sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]" hideClose>
        <DialogClose className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 border border-border/60 shadow-md text-foreground hover:bg-muted transition-colors backdrop-blur-sm">
          <X className="h-4 w-4" /><span className="sr-only">Close</span>
        </DialogClose>

        {images.length > 0 && (
          <div className="relative shrink-0 bg-muted">
            <img src={images[imgIdx]?.url} alt={target.recipeTitle ?? ''} className="w-full h-48 object-cover" />
            <button type="button" onClick={() => setLightboxIdx(imgIdx)}
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-white text-[10px] font-medium hover:bg-black/70 transition-colors z-10">
              <Maximize2 className="h-3 w-3" />Expand
            </button>
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 border flex items-center justify-center shadow">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 border flex items-center justify-center shadow">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <button key={i} type="button" onClick={() => setImgIdx(i)}
                      className={cn('h-1.5 rounded-full transition-all', i === imgIdx ? 'w-4 bg-primary' : 'w-1.5 bg-primary/30')} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {detail && (
          <div className="shrink-0 px-4 pt-4 pb-3 border-b space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold leading-tight">{detail.title}</h2>
                {detail.categoryName && <p className="text-xs text-muted-foreground mt-0.5">{detail.categoryName}</p>}
              </div>
              <div className="flex items-center rounded-full border p-0.5 bg-muted/30 shrink-0">
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
            {detail.description && <p className="text-sm text-foreground/80 leading-relaxed">{detail.description}</p>}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <ChefHat className="h-3.5 w-3.5" />Servings
                </span>
                <span className="text-sm font-bold text-primary">{effectiveServings}</span>
              </div>
              <Slider min={1} max={20} step={1} value={[effectiveServings]} onValueChange={([v]) => setServings(v)} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground/50"><span>1</span><span>20</span></div>
            </div>
          </div>
        )}

        <div className="scrollbar-hide overflow-y-auto flex-1 px-4 py-4 space-y-5">
          {detailLoading && <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" /></div>}

          {detail && (
            <>
              {detail.ingredients.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredients</p>
                  <div className="space-y-2">
                    {detail.ingredients.map((ing) => {
                      const scaledQty = scaleQty(ing.quantity, base, effectiveServings);
                      const converted = convertQty(scaledQty, ing.unit, system);
                      return (
                        <div key={ing.id} className="flex gap-2.5 items-start text-sm">
                          <ChefHat className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0 opacity-70" />
                          <span>
                            {converted.qty && <span className="font-medium">{converted.qty}{converted.unit ? ` ${converted.unit}` : ''} </span>}
                            {ing.name}
                            {ing.note && <span className="text-muted-foreground"> ({ing.note})</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {detail.steps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Method</p>
                  <div className="space-y-3">
                    {detail.steps.map((step, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold leading-none mt-0.5">{i + 1}</span>
                        <p className="leading-relaxed flex-1">{convertStepText(step, system)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showReviewForm && !isOwnRecipe && (
                <div className="rounded-xl border bg-muted/30 px-3 py-3 space-y-3">
                  <p className="text-xs font-medium">{myReview ? 'Edit Your Review' : 'Leave A Review'}</p>
                  {myShare ? (
                    <>
                      <HalfStarPicker value={reviewRating} onChange={setReviewRating} />
                      <div className="relative">
                        <textarea
                          ref={(el) => { reviewCommentRef.current = el ?? undefined; }}
                          placeholder="Share your thoughts…"
                          className="w-full resize-none overflow-hidden text-sm min-h-[72px] pb-5 rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value.slice(0, REVIEW_CHAR_LIMIT))}
                        />
                        <span className={`absolute bottom-1.5 right-2 text-[10px] pointer-events-none ${reviewComment.length >= REVIEW_CHAR_LIMIT ? 'text-destructive' : 'text-muted-foreground/60'}`}>
                          {reviewComment.length}/{REVIEW_CHAR_LIMIT}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 h-8"
                          onClick={() => setShowReviewForm(false)}>Cancel</Button>
                        <Button size="sm" className="flex-1 h-8"
                          disabled={reviewRating === 0 || submitReview.isPending}
                          onClick={() => submitReview.mutate()}>
                          {submitReview.isPending ? 'Saving…' : myReview ? 'Update' : 'Submit'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground text-center py-1">Request this recipe first to leave a review.</p>
                      <Button variant="outline" size="sm" className="w-full h-8" onClick={() => setShowReviewForm(false)}>Close</Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {!isOwnRecipe && !isHousehold && (
          <div className="shrink-0 border-t bg-background px-3 py-2.5 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5"
              disabled={requestMutation.isPending}
              onClick={() => requestMutation.mutate()}>
              <Send className="h-3.5 w-3.5" />Request Recipe
            </Button>
            <Button size="sm" variant={showReviewForm ? 'default' : 'outline'}
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={() => {
                if (!showReviewForm && myReview) { setReviewRating(myReview.rating); setReviewComment(myReview.comment ?? ''); }
                setShowReviewForm((v) => !v);
              }}>
              <MessageSquare className="h-3.5 w-3.5" />{myReview ? 'Edit Review' : 'Rate & Review'}
            </Button>
          </div>
        )}
        {!isOwnRecipe && isHousehold && (
          <div className="shrink-0 border-t bg-background px-3 py-2 flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">This recipe is in your household's book.</p>
          </div>
        )}

        {lightboxIdx !== null && images[lightboxIdx] && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
            onClick={() => setLightboxIdx(null)}>
            <button type="button" onClick={() => setLightboxIdx(null)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
              <X className="h-5 w-5" />
            </button>
            {images.length > 1 && (
              <>
                <button type="button" onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => ((i ?? 0) - 1 + images.length) % images.length); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => ((i ?? 0) + 1) % images.length); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            <img src={images[lightboxIdx].url} alt="" className="max-h-[80%] max-w-[85%] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setLightboxIdx(i); }}
                    className={cn('h-2 rounded-full transition-all', i === lightboxIdx ? 'w-6 bg-foreground' : 'w-2 bg-foreground/30')} />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Reviews section (collapsible) ───────────────────────────────────────────

const REVIEWS_PREVIEW = 3;

function ReviewExpandModal({ review, meId, myShareId, postId, open, onClose, onViewProfile }: {
  review: RecipeReview | null; meId: string; myShareId: string | null;
  postId: string; open: boolean; onClose: () => void;
  onViewProfile?: (target: ProfileModalTarget) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (review) { setRating(review.rating); setComment(review.comment ?? ''); }
    setEditing(false);
  }, [review?.id]);

  useEffect(() => {
    if (commentRef.current) {
      commentRef.current.style.height = 'auto';
      commentRef.current.style.height = `${commentRef.current.scrollHeight}px`;
    }
  }, [comment, editing]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/api/shares/${myShareId!}/review`, { rating, comment: comment.trim() || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.community.postReviews(postId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.shares.review(myShareId ?? '') });
      toast.success('Review Updated');
      setEditing(false);
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  if (!review) return null;
  const isOwn = review.reviewerId === meId;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm sm:max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Review</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => review.reviewerId && onViewProfile?.({ userId: review.reviewerId, name: review.reviewerName, handle: review.reviewerHandle, image: review.reviewerImage, sameHousehold: false })}>
              <Avatar className="h-8 w-8 hover:ring-2 hover:ring-primary transition-all cursor-pointer">
                <AvatarImage src={review.reviewerImage ?? undefined} />
                <AvatarFallback className="text-xs">{initials(review.reviewerName, review.reviewerHandle ?? '?')}</AvatarFallback>
              </Avatar>
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{review.reviewerHandle ? `@${review.reviewerHandle}` : 'User'}</p>
              <p className="text-[10px] text-muted-foreground">{formatDate(review.updatedAt)}</p>
            </div>
            <StarDisplay rating={review.rating} />
          </div>

          {!editing ? (
            <>
              {review.comment
                ? <p className="text-sm text-foreground/80 leading-relaxed [word-break:break-word] [overflow-wrap:anywhere]">{review.comment}</p>
                : <p className="text-xs text-muted-foreground italic">No written comment.</p>}
              {isOwn && myShareId && (
                <div className="flex justify-end pt-1">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5" />Edit Review
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <HalfStarPicker value={rating} onChange={setRating} />
              <div className="relative">
                <Textarea
                  ref={commentRef}
                  placeholder="Update your comment…"
                  className="resize-none overflow-hidden text-sm min-h-[80px] pb-5"
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, REVIEW_CHAR_LIMIT))}
                />
                <span className="absolute bottom-1.5 right-2 text-[10px] text-muted-foreground/60 pointer-events-none">
                  {comment.length}/{REVIEW_CHAR_LIMIT}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-8"
                  onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" className="flex-1 h-8"
                  disabled={rating === 0 || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}>
                  {saveMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewsSection({ reviews, meId, myShareId, postId, onViewProfile }: {
  reviews: RecipeReview[]; meId: string; myShareId: string | null; postId: string;
  onViewProfile: (target: ProfileModalTarget) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedReview, setExpandedReview] = useState<RecipeReview | null>(null);
  const visible = expanded ? reviews : reviews.slice(0, REVIEWS_PREVIEW);

  return (
    <div className="space-y-3 pt-1 border-t">
      <button type="button" onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-1 hover:text-foreground transition-colors">
        <MessageSquare className="h-3.5 w-3.5" />
        Reviews
        {reviews.length > 0 && <span className="normal-case font-normal">({reviews.length})</span>}
        {reviews.length > REVIEWS_PREVIEW && (
          <ChevronDown className={cn('h-3.5 w-3.5 ml-auto transition-transform duration-200', expanded && 'rotate-180')} />
        )}
      </button>

      {reviews.length === 0
        ? <p className="text-xs text-muted-foreground text-center py-4 italic">No reviews yet.</p>
        : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visible.map((r) => (
              <div key={r.id} className="rounded-xl border bg-card px-3 py-3 flex flex-col gap-1.5 overflow-hidden">
                <div className="flex items-center gap-2">
                  <button type="button" className="shrink-0" onClick={() => r.reviewerId && onViewProfile({ userId: r.reviewerId, name: r.reviewerName, handle: r.reviewerHandle, image: r.reviewerImage, sameHousehold: false })}>
                    <Avatar className="h-7 w-7 hover:ring-2 hover:ring-primary transition-all">
                      <AvatarImage src={r.reviewerImage ?? undefined} />
                      <AvatarFallback className="text-[10px]">{initials(r.reviewerName, r.reviewerHandle ?? '?')}</AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{r.reviewerHandle ? `@${r.reviewerHandle}` : 'User'}</p>
                  </div>
                  <StarDisplay rating={r.rating} />
                </div>
                {r.comment && (
                  <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3 break-words overflow-hidden flex-1">{r.comment}</p>
                )}
                <div className="flex items-center justify-between pt-0.5">
                  <p className="text-[10px] text-muted-foreground/50">{formatDate(r.updatedAt)}</p>
                  <button type="button" onClick={() => setExpandedReview(r)}
                    className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors">
                    View
                  </button>
                </div>
              </div>
            ))}
            {!expanded && reviews.length > REVIEWS_PREVIEW && (
              <button type="button" onClick={() => setExpanded(true)}
                className="w-full text-center text-xs text-primary hover:text-primary/80 font-medium py-1 transition-colors">
                Show all {reviews.length} reviews
              </button>
            )}
          </div>
        )}

      <ReviewExpandModal
        review={expandedReview}
        meId={meId}
        myShareId={myShareId}
        postId={postId}
        open={!!expandedReview}
        onClose={() => setExpandedReview(null)}
        onViewProfile={onViewProfile}
      />
    </div>
  );
}

// ─── Recipe Detail Modal ──────────────────────────────────────────────────────

const REVIEW_CHAR_LIMIT = 500;

function RecipeDetailModal({ post, meId, onClose }: { post: CommunityPost | null; meId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [servings, setServings] = useState<number | null>(null);
  const [system, setSystem] = useMeasureSystem();
  const [imageIdx, setImageIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const reviewCommentRef = useRef<HTMLTextAreaElement>(null);
  const [reviewerProfileTarget, setReviewerProfileTarget] = useState<ProfileModalTarget | null>(null);

  const { data: recipe } = useQuery({
    queryKey: queryKeys.community.postRecipe(post?.id ?? ''),
    queryFn: () => api.get<RecipeDetail>(`/api/community/posts/${post!.id}/recipe`),
    enabled: !!post && !!post.recipeId,
  });

  useEffect(() => {
    setShowReviewForm(false);
    setReviewRating(0);
    setReviewComment('');
    setImageIdx(0);
    setLightboxIdx(null);
  }, [post?.id]);

  useEffect(() => {
    if (recipe) setServings(recipe.baseServings);
  }, [recipe]);

  const { data: reviews = [] } = useQuery({
    queryKey: queryKeys.community.postReviews(post?.id ?? ''),
    queryFn: () => api.get<RecipeReview[]>(`/api/community/posts/${post!.id}/recipe/reviews`),
    enabled: !!post && !!post.recipeId,
  });

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  // Find if current user has an accepted share for this recipe (so they can review)
  const { data: receivedShares = [] } = useQuery({
    queryKey: queryKeys.shares.received(),
    queryFn: () => api.get<{ id: string; recipeId: string | null; status: string }[]>('/api/shares/received'),
    enabled: !!post && post.userId !== meId,
  });

  const myShare = receivedShares.find(
    (s) => s.recipeId === post?.recipeId && s.status === 'ACCEPTED'
  );

  const { data: myReview = null } = useQuery({
    queryKey: queryKeys.shares.review(myShare?.id ?? ''),
    queryFn: async () => {
      try { return await api.get<{ id: string; rating: number; comment: string | null }>(`/api/shares/${myShare!.id}/review`); }
      catch (e) { if (e instanceof ApiError && (e as ApiError).status === 404) return null; throw e; }
    },
    enabled: !!myShare,
  });

  useEffect(() => {
    if (myReview && showReviewForm) {
      setReviewRating(myReview.rating);
      setReviewComment(myReview.comment ?? '');
    }
  }, [myReview, showReviewForm]);

  useEffect(() => {
    if (reviewCommentRef.current) {
      reviewCommentRef.current.style.height = 'auto';
      reviewCommentRef.current.style.height = `${reviewCommentRef.current.scrollHeight}px`;
    }
  }, [reviewComment]);

  const submitReview = useMutation({
    mutationFn: () =>
      myReview
        ? api.patch(`/api/shares/${myShare!.id}/review`, { rating: reviewRating, comment: reviewComment || null })
        : api.post(`/api/shares/${myShare!.id}/review`, { rating: reviewRating, comment: reviewComment || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.community.postReviews(post!.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.shares.review(myShare!.id) });
      toast.success(myReview ? 'Review Updated' : 'Review Submitted');
      setShowReviewForm(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed To Submit Review'),
  });

  const requestMutation = useMutation({
    mutationFn: () => api.post('/api/shares/request', { recipeId: post!.recipeId!, ownerId: post!.userId }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.shares.sent() }); toast.success('Recipe Requested'); },
    onError: (err) => {
      if (err instanceof ApiError && (err as any).sameHousehold) {
        toast.info('This person is in your household — you already share access to their recipes.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Request Failed');
      }
    },
  });

  if (!post) return null;

  const effectiveServings = servings ?? recipe?.baseServings ?? 4;
  const base = recipe?.baseServings ?? 1;
  const images = recipe?.images ?? [];
  const isLoading = !recipe && !!post.recipeId;

  return (
    <>
    <Dialog open={!!post} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-lg sm:max-w-xl lg:max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]" hideClose>
        {/* Custom themed close button */}
        <DialogClose className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 border border-border/60 shadow-md text-foreground hover:bg-muted transition-colors backdrop-blur-sm">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        {/* Image carousel */}
        {images.length > 0 && (
          <div className="relative shrink-0 bg-muted">
            <img src={images[imageIdx]?.url} alt="" className="w-full h-48 object-cover" />
            <button type="button" onClick={() => setLightboxIdx(imageIdx)}
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-white text-[10px] font-medium hover:bg-black/70 transition-colors z-10">
              <Maximize2 className="h-3 w-3" />Expand
            </button>
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => setImageIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 border flex items-center justify-center shadow">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setImageIdx((i) => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 border flex items-center justify-center shadow">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <button key={i} type="button" onClick={() => setImageIdx(i)}
                      className={cn('h-1.5 rounded-full transition-all', i === imageIdx ? 'w-4 bg-primary' : 'w-1.5 bg-primary/30')} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Title + controls */}
        {recipe && (
          <div className="shrink-0 px-4 pt-4 pb-3 border-b space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold leading-tight">{recipe.title}</h2>
                {recipe.categoryName && <p className="text-xs text-muted-foreground mt-0.5">{recipe.categoryName}</p>}
              </div>
              <div className="flex items-center rounded-full border p-0.5 bg-muted/30 shrink-0">
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
            {avgRating !== null && <StarDisplay rating={avgRating} count={reviews.length} />}
            {recipe.description && <p className="text-sm text-foreground/80 leading-relaxed">{recipe.description}</p>}
            {/* Serving slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <ChefHat className="h-3.5 w-3.5" />Servings
                </span>
                <span className="text-sm font-bold text-primary">{effectiveServings}</span>
              </div>
              <Slider min={1} max={20} step={1} value={[effectiveServings]} onValueChange={([v]) => setServings(v)} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground/50"><span>1</span><span>20</span></div>
            </div>
          </div>
        )}

        <div className="scrollbar-hide overflow-y-auto flex-1 px-4 py-4 space-y-5">
          {isLoading && <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" /></div>}
          {!recipe && !isLoading && !post.recipeId && <p className="text-sm text-muted-foreground text-center py-4">Recipe no longer available.</p>}

          {recipe && (
            <>
              {/* Ingredients */}
              {recipe.ingredients.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredients</p>
                  <div className="space-y-2">
                    {recipe.ingredients.map((ing) => {
                      const scaledQty = scaleQty(ing.quantity, base, effectiveServings);
                      const converted = convertQty(scaledQty, ing.unit, system);
                      return (
                        <div key={ing.id} className="flex gap-2.5 items-start text-sm">
                          <ChefHat className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0 opacity-70" />
                          <span>
                            {converted.qty && <span className="font-medium">{converted.qty}{converted.unit ? ` ${converted.unit}` : ''} </span>}
                            {ing.name}
                            {ing.note && <span className="text-muted-foreground"> ({ing.note})</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Steps */}
              {recipe.steps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Method</p>
                  <div className="space-y-3">
                    {recipe.steps.map((step, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold leading-none mt-0.5">
                          {i + 1}
                        </span>
                        <p className="leading-relaxed flex-1">{convertStepText(step, system)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews */}
              <ReviewsSection
                reviews={reviews}
                meId={meId}
                myShareId={myShare?.id ?? null}
                postId={post.id}
                onViewProfile={setReviewerProfileTarget}
              />

              {/* Rate & review form — toggled from bottom bar */}
              {showReviewForm && !post.isOwnPost && (
                <div className="rounded-xl border bg-muted/30 px-3 py-3 space-y-3">
                  <p className="text-xs font-medium">{myReview ? 'Edit Your Review' : 'Leave A Review'}</p>
                  {myShare ? (
                    <>
                      <HalfStarPicker value={reviewRating} onChange={setReviewRating} />
                      <div className="relative">
                        <Textarea
                          ref={reviewCommentRef}
                          placeholder="Share your thoughts on this recipe…"
                          className="resize-none overflow-hidden text-sm min-h-[72px] pb-5"
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value.slice(0, REVIEW_CHAR_LIMIT))}
                          maxLength={REVIEW_CHAR_LIMIT}
                        />
                        <span className={`absolute bottom-1.5 right-2 text-[10px] pointer-events-none ${reviewComment.length >= REVIEW_CHAR_LIMIT ? 'text-destructive' : 'text-muted-foreground/60'}`}>
                          {reviewComment.length}/{REVIEW_CHAR_LIMIT}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 h-8"
                          onClick={() => setShowReviewForm(false)}>Cancel</Button>
                        <Button size="sm" className="flex-1 h-8"
                          disabled={reviewRating === 0 || submitReview.isPending}
                          onClick={() => submitReview.mutate()}>
                          {submitReview.isPending ? 'Saving…' : myReview ? 'Update Review' : 'Submit Review'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground text-center py-1">Request this recipe first to leave a review.</p>
                      <Button variant="outline" size="sm" className="w-full h-8" onClick={() => setShowReviewForm(false)}>Close</Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky bottom action bar */}
        {!post.isOwnPost && post.recipeId && !post.sameHousehold && (
          <div className="shrink-0 border-t bg-background px-3 py-2.5 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5"
              disabled={requestMutation.isPending}
              onClick={() => requestMutation.mutate()}>
              <Send className="h-3.5 w-3.5" />Request Recipe
            </Button>
            <Button size="sm" variant={showReviewForm ? 'default' : 'outline'}
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={() => {
                if (!showReviewForm && myReview) {
                  setReviewRating(myReview.rating);
                  setReviewComment(myReview.comment ?? '');
                }
                setShowReviewForm((v) => !v);
              }}>
              <MessageSquare className="h-3.5 w-3.5" />{myReview ? 'Edit Review' : 'Rate & Review'}
            </Button>
          </div>
        )}
        {!post.isOwnPost && post.recipeId && post.sameHousehold && (
          <div className="shrink-0 border-t bg-background px-3 py-2 flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">This recipe is in your household's book.</p>
          </div>
        )}

        {lightboxIdx !== null && images[lightboxIdx] && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
            onClick={() => setLightboxIdx(null)}>
            <button type="button" onClick={() => setLightboxIdx(null)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
              <X className="h-5 w-5" />
            </button>
            {images.length > 1 && (
              <>
                <button type="button" onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => ((i ?? 0) - 1 + images.length) % images.length); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => ((i ?? 0) + 1) % images.length); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            <img src={images[lightboxIdx].url} alt="" className="max-h-[80%] max-w-[85%] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setLightboxIdx(i); }}
                    className={cn('h-2 rounded-full transition-all', i === lightboxIdx ? 'w-6 bg-foreground' : 'w-2 bg-foreground/30')} />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
    <UserProfileModal
      target={reviewerProfileTarget}
      meId={meId}
      open={!!reviewerProfileTarget}
      onClose={() => setReviewerProfileTarget(null)}
    />
    </>
  );
}

// ─── Create Post Modal ────────────────────────────────────────────────────────

function CreatePostModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeItem | null>(null);
  const [previewRecipe, setPreviewRecipe] = useState<RecipeItem | null>(null);
  const [comment, setComment] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [step, setStep] = useState<'recipe' | 'preview' | 'comment'>('recipe');
  const [previewServings, setPreviewServings] = useState(4);
  const [previewSystem, setPreviewSystem] = useMeasureSystem();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { data: recipes = [], isLoading: recipesLoading } = useQuery({
    queryKey: queryKeys.recipeBook.recipes(debouncedSearch),
    queryFn: () => api.get<RecipeItem[]>(`/api/recipe-book/recipes?search=${encodeURIComponent(debouncedSearch)}`),
    enabled: open && debouncedSearch.length >= 1,
  });

  const { data: previewDetail, isLoading: previewLoading } = useQuery({
    queryKey: ['recipe-book', 'recipe', previewRecipe?.id ?? ''],
    queryFn: () => api.get<RecipeDetail>(`/api/recipe-book/recipes/${previewRecipe!.id}`),
    enabled: step === 'preview' && !!previewRecipe,
  });

  const createPost = useMutation({
    mutationFn: () => api.post('/api/community/posts', { recipeId: selectedRecipe!.id, comment }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.community.posts() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.community.followingPosts() });
      toast.success('Posted To Community');
      handleClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed To Post'),
  });

  const handleClose = () => {
    setSelectedRecipe(null); setPreviewRecipe(null); setComment(''); setSearch('');
    setDebouncedSearch(''); setStep('recipe'); onClose();
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(val.trim()), 350);
  };

  const selectPreviewedRecipe = () => {
    if (!previewRecipe) return;
    setSelectedRecipe(previewRecipe);
    setStep('comment');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className={cn(
        'w-[calc(100vw-48px)] mx-auto',
        step === 'preview'
          ? 'max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]'
          : 'max-w-lg'
      )}>
        {step !== 'preview' && (
          <DialogHeader>
            <DialogTitle>{step === 'recipe' ? 'Select A Recipe' : 'Write Your Post'}</DialogTitle>
          </DialogHeader>
        )}

        {step === 'recipe' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="h-10 pl-9" placeholder="Search your recipes…"
                value={search} onChange={(e) => handleSearch(e.target.value)} autoFocus autoComplete="off" />
            </div>
            <div className="max-h-56 scrollbar-hide overflow-y-auto space-y-1.5">
              {debouncedSearch.length < 1 && <p className="text-xs text-muted-foreground py-6 text-center">Start typing to search your recipes…</p>}
              {debouncedSearch.length >= 1 && recipesLoading && <p className="text-xs text-muted-foreground py-4 text-center">Searching…</p>}
              {debouncedSearch.length >= 1 && !recipesLoading && recipes.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No recipes match that search.</p>}
              {debouncedSearch.length >= 1 && recipes.map((r) => (
                <button key={r.id} type="button"
                  onClick={() => { setPreviewRecipe(r); setPreviewServings(4); setStep('preview'); }}
                  className="w-full text-left rounded-lg border px-2.5 py-2 hover:bg-accent transition-colors flex items-center gap-2.5">
                  {r.image
                    ? <img src={r.image} alt={r.title} className="h-9 w-9 rounded-md object-cover shrink-0" />
                    : <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0"><UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground/40" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate leading-tight">{r.title}</p>
                    {r.description && <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">{r.description}</p>}
                  </div>
                  <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'preview' && previewRecipe && (
          <>
            {previewRecipe.image && (
              <div className="shrink-0 bg-muted">
                <img src={previewRecipe.image} alt={previewRecipe.title} className="w-full h-40 object-cover" />
              </div>
            )}
            <div className="scrollbar-hide overflow-y-auto flex-1 px-4 py-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold leading-tight">{previewDetail?.title ?? previewRecipe.title}</h2>
                  {previewDetail?.categoryName && <p className="text-xs text-muted-foreground mt-0.5">{previewDetail.categoryName}</p>}
                </div>
                <div className="flex items-center rounded-full border p-0.5 bg-muted/30 shrink-0">
                  <button type="button" onClick={() => setPreviewSystem('metric')}
                    className={cn('text-[10px] px-2.5 py-0.5 rounded-full transition-colors font-medium',
                      previewSystem === 'metric' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    Metric
                  </button>
                  <button type="button" onClick={() => setPreviewSystem('imperial')}
                    className={cn('text-[10px] px-2.5 py-0.5 rounded-full transition-colors font-medium',
                      previewSystem === 'imperial' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    Imperial
                  </button>
                </div>
              </div>
              {(previewDetail?.description ?? previewRecipe.description) && (
                <p className="text-sm text-foreground/80 leading-relaxed">{previewDetail?.description ?? previewRecipe.description}</p>
              )}
              {previewLoading && <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" /></div>}
              {previewDetail && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><ChefHat className="h-3.5 w-3.5" />Servings</span>
                      <span className="text-sm font-bold text-primary">{previewServings}</span>
                    </div>
                    <Slider min={1} max={20} step={1} value={[previewServings]} onValueChange={([v]) => setPreviewServings(v)} className="w-full" />
                  </div>
                  {previewDetail.ingredients.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredients</p>
                      <div className="space-y-2">
                        {previewDetail.ingredients.map((ing) => {
                          const scaledQty = scaleQty(ing.quantity, previewDetail.baseServings, previewServings);
                          const converted = convertQty(scaledQty, ing.unit, previewSystem);
                          return (
                            <div key={ing.id} className="flex gap-2.5 items-start text-sm">
                              <ChefHat className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0 opacity-70" />
                              <span>
                                {converted.qty && <span className="font-medium">{converted.qty}{converted.unit ? ` ${converted.unit}` : ''} </span>}
                                {ing.name}
                                {ing.note && <span className="text-muted-foreground"> ({ing.note})</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {previewDetail.steps.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Method</p>
                      <div className="space-y-3">
                        {previewDetail.steps.map((step, i) => (
                          <div key={i} className="flex gap-3 text-sm">
                            <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold leading-none mt-0.5">{i + 1}</span>
                            <p className="leading-relaxed flex-1">{convertStepText(step, previewSystem)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="shrink-0 border-t bg-background px-3 py-2.5 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setStep('recipe')}>Back</Button>
              <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={selectPreviewedRecipe}>
                Select This Recipe
              </Button>
            </div>
          </>
        )}

        {step === 'comment' && selectedRecipe && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-3">
              {selectedRecipe.image
                ? <img src={selectedRecipe.image} alt={selectedRecipe.title} className="h-12 w-12 rounded-lg object-cover shrink-0" />
                : <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0"><UtensilsCrossed className="h-5 w-5 text-muted-foreground/40" /></div>}
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{selectedRecipe.title}</p></div>
              <button type="button" onClick={() => setStep('recipe')} className="text-[11px] text-primary hover:text-primary/80 shrink-0 font-medium">Change</button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">What makes this recipe amazing?</label>
              <Textarea placeholder="Tell the community why you love this recipe…"
                className="resize-none text-sm min-h-[120px]"
                value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} autoFocus />
              <p className="text-right text-[10px] text-muted-foreground">{comment.length}/1000</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep('recipe')}>Back</Button>
              <Button className="flex-1" disabled={!comment.trim() || createPost.isPending} onClick={() => createPost.mutate()}>
                {createPost.isPending ? 'Posting…' : 'Post To Community'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function CommunityPage() {
  const { data: me } = useMe();
  const [activeTab, setActiveTab] = useState('feed');
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterUserName, setFilterUserName] = useState<string | null>(null);

  const goToUserFeed = (userId: string, name: string | null) => {
    setFilterUserId(userId);
    setFilterUserName(name);
    setActiveTab('feed');
  };

  return (
    <div className="flex flex-col items-center px-4 pb-24 pt-6">
      <div className="w-full max-w-md sm:max-w-xl lg:w-[65%] lg:max-w-5xl xl:max-w-[1400px]">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="rounded-t-2xl border border-b-0 overflow-hidden">
            <TabsList className="w-full h-12 rounded-none bg-card border-b p-0 gap-0">
              {[
                { value: 'feed', label: 'Community Recipes' },
                { value: 'search', label: 'Search Members' },
                { value: 'following', label: 'Following' },
              ].map(({ value, label }) => (
                <TabsTrigger key={value} value={value}
                  className="flex-1 h-full rounded-none text-[10px] sm:text-xs lg:text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=inactive]:text-muted-foreground px-0.5">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="rounded-b-2xl border border-t-0 bg-background overflow-hidden">
            <TabsContent value="feed" className="mt-0">
              <FeedTab meId={me?.id ?? ''} filterUserId={filterUserId} filterUserName={filterUserName}
                onClearFilter={() => { setFilterUserId(null); setFilterUserName(null); }} />
            </TabsContent>
            <TabsContent value="search" className="mt-0">
              <SearchMembersTab meId={me?.id ?? ''} />
            </TabsContent>
            <TabsContent value="following" className="mt-0">
              <FollowingTab meId={me?.id ?? ''} onViewUserFeed={goToUserFeed} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Feed Tab ─────────────────────────────────────────────────────────────────

type TimeMode = 'all' | 'year' | 'month' | 'day';
type SortBy = 'recent' | 'oldest' | 'top-rated' | 'most-reviewed' | 'unreviewed' | 'az';
type PostType = 'all' | 'with-recipe' | 'no-recipe';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LAUNCH_YEAR = 2024;

function usePageSize() {
  const getSize = () => {
    if (typeof window === 'undefined') return 8;
    const w = window.innerWidth;
    if (w >= 1536) return 16;
    if (w >= 1280) return 12;
    if (w >= 1024) return 9;
    if (w >= 768) return 6;
    return 4;
  };
  const [size, setSize] = useState(getSize);
  useEffect(() => {
    const handler = () => setSize(getSize());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

function FeedTab({ meId, filterUserId, filterUserName, onClearFilter }: {
  meId: string; filterUserId: string | null; filterUserName: string | null; onClearFilter: () => void;
}) {
  const queryClient = useQueryClient();
  const pageSize = usePageSize();
  const [createOpen, setCreateOpen] = useState(false);
  const [recipeModalPost, setRecipeModalPost] = useState<CommunityPost | null>(null);
  const [profileTarget, setProfileTarget] = useState<ProfileModalTarget | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [feedSearch, setFeedSearch] = useState('');

  const now = new Date();
  const [timeMode, setTimeMode] = useState<TimeMode>('all');
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selDay, setSelDay] = useState(now.getDate());
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [postType, setPostType] = useState<PostType>('all');
  const [minRating, setMinRating] = useState<0 | 3 | 4 | 5>(0);

  const hasActiveFilters = timeMode !== 'all' || sortBy !== 'recent' || postType !== 'all' || minRating > 0;
  const clearFilters = () => { setTimeMode('all'); setSortBy('recent'); setPostType('all'); setMinRating(0); };

  const currentYear = now.getFullYear();
  const years = useMemo(() => Array.from({ length: currentYear - LAUNCH_YEAR + 1 }, (_, i) => currentYear - i), [currentYear]);
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();

  const { apiFrom, apiTo } = useMemo(() => {
    if (timeMode === 'all') return { apiFrom: undefined, apiTo: undefined };
    const mm = String(selMonth).padStart(2, '0');
    const last = String(new Date(selYear, selMonth, 0).getDate()).padStart(2, '0');
    if (timeMode === 'year') return { apiFrom: `${selYear}-01-01T00:00:00Z`, apiTo: `${selYear}-12-31T23:59:59Z` };
    if (timeMode === 'month') return { apiFrom: `${selYear}-${mm}-01T00:00:00Z`, apiTo: `${selYear}-${mm}-${last}T23:59:59Z` };
    const dd = String(selDay).padStart(2, '0');
    return { apiFrom: `${selYear}-${mm}-${dd}T00:00:00Z`, apiTo: `${selYear}-${mm}-${dd}T23:59:59Z` };
  }, [timeMode, selYear, selMonth, selDay]);

  useEffect(() => { setPage(0); }, [filterUserId, apiFrom, apiTo, sortBy, postType, minRating, feedSearch]);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: queryKeys.community.posts(filterUserId ?? undefined, apiFrom, apiTo),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterUserId) params.set('userId', filterUserId);
      if (apiFrom) params.set('from', apiFrom);
      if (apiTo) params.set('to', apiTo);
      return api.get<CommunityPost[]>(`/api/community/posts?${params.toString()}`);
    },
  });

  const filteredPosts = useMemo(() => {
    let result = feedSearch.trim()
      ? posts.filter((p) => { const q = feedSearch.toLowerCase(); return p.userName?.toLowerCase().includes(q) || p.userHandle?.toLowerCase().includes(q); })
      : posts;

    if (postType === 'with-recipe') result = result.filter((p) => p.recipeId !== null);
    else if (postType === 'no-recipe') result = result.filter((p) => p.recipeId === null);

    if (minRating > 0) result = result.filter((p) => p.recipeAvgRating !== null && p.recipeAvgRating >= minRating);

    if (sortBy === 'unreviewed') result = result.filter((p) => p.recipeId !== null && p.reviewCount === 0);

    switch (sortBy) {
      case 'oldest': return [...result].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'top-rated': return [...result].sort((a, b) => (b.recipeAvgRating ?? 0) - (a.recipeAvgRating ?? 0));
      case 'most-reviewed': return [...result].sort((a, b) => b.reviewCount - a.reviewCount);
      case 'az': return [...result].sort((a, b) => (a.recipeTitle ?? '').localeCompare(b.recipeTitle ?? ''));
      default: return result;
    }
  }, [posts, feedSearch, postType, minRating, sortBy]);

  const totalPages = Math.ceil(filteredPosts.length / pageSize);
  const clampedPage = Math.min(page, Math.max(0, totalPages - 1));
  const paginated = filteredPosts.slice(clampedPage * pageSize, (clampedPage + 1) * pageSize);

  const followMutation = useMutation({
    mutationFn: (userId: string) => api.post('/api/follows', { followingId: userId }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.community.posts() }); void queryClient.invalidateQueries({ queryKey: queryKeys.follows.following() }); toast.success('Following'); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const unfollowMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/api/follows/${userId}`),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.community.posts() }); void queryClient.invalidateQueries({ queryKey: queryKeys.follows.following() }); toast.success('Unfollowed'); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const deletePost = useMutation({
    mutationFn: (id: string) => api.delete(`/api/community/posts/${id}`),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.community.posts() }); toast.success('Post Deleted'); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const requestShare = useMutation({
    mutationFn: ({ recipeId, ownerId }: { recipeId: string; ownerId: string }) => api.post('/api/shares/request', { recipeId, ownerId }),
    onSuccess: () => toast.success('Recipe Requested'),
    onError: (err) => {
      if (err instanceof ApiError && (err as any).sameHousehold) {
        toast.info('This person is in your household — you already share access to their recipes.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed');
      }
    },
  });

  const filterPanelContent = (
    <div className="border-t border-border/40 px-3 py-3 space-y-4">

      {/* TIME PERIOD */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Time Period</p>
        <div className="flex flex-wrap gap-1.5">
          {([
            { value: 'all', label: 'All Time' },
            { value: 'year', label: 'Year' },
            { value: 'month', label: 'Month' },
            { value: 'day', label: 'Day' },
          ] as { value: TimeMode; label: string }[]).map(({ value, label }) => (
            <button key={value} type="button" onClick={() => setTimeMode(value)}
              className={cn('text-[11px] font-medium rounded-full border px-2.5 py-1 transition-colors',
                timeMode === value ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30')}>
              {label}
            </button>
          ))}
        </div>
        {timeMode !== 'all' && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            <Select value={String(selYear)} onValueChange={(v) => setSelYear(Number(v))}>
              <SelectTrigger className="h-8 w-[90px] text-xs bg-primary/15 text-primary border-primary/20 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {(timeMode === 'month' || timeMode === 'day') && (
              <Select value={String(selMonth)} onValueChange={(v) => setSelMonth(Number(v))}>
                <SelectTrigger className="h-8 w-[120px] text-xs bg-primary/15 text-primary border-primary/20 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {timeMode === 'day' && (
              <Select value={String(selDay)} onValueChange={(v) => setSelDay(Number(v))}>
                <SelectTrigger className="h-8 w-[72px] text-xs bg-primary/15 text-primary border-primary/20 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {/* SORT BY */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sort By</p>
        <div className="flex flex-wrap gap-1.5">
          {([
            { value: 'recent', label: 'Newest First' },
            { value: 'oldest', label: 'Oldest First' },
            { value: 'top-rated', label: 'Top Rated', icon: TrendingUp },
            { value: 'most-reviewed', label: 'Most Reviewed', icon: MessageSquare },
            { value: 'unreviewed', label: 'No Reviews Yet' },
            { value: 'az', label: 'A–Z by Recipe' },
          ] as { value: SortBy; label: string; icon?: React.ComponentType<{ className?: string }> }[]).map(({ value, label, icon: Icon }) => (
            <button key={value} type="button" onClick={() => setSortBy(value)}
              className={cn('flex items-center gap-1 text-[11px] font-medium rounded-full border px-2.5 py-1 transition-colors',
                sortBy === value ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30')}>
              {Icon && <Icon className="h-3 w-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Content</p>
        <div className="flex flex-wrap gap-1.5">
          {([
            { value: 'all', label: 'All Posts' },
            { value: 'with-recipe', label: 'Has Recipe' },
            { value: 'no-recipe', label: 'No Recipe' },
          ] as { value: PostType; label: string }[]).map(({ value, label }) => (
            <button key={value} type="button" onClick={() => setPostType(value)}
              className={cn('text-[11px] font-medium rounded-full border px-2.5 py-1 transition-colors',
                postType === value ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* MIN RATING — only relevant when recipes are shown */}
      {postType !== 'no-recipe' && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Min Rating</p>
          <div className="flex flex-wrap gap-1.5">
            {([
              { value: 0, label: 'Any' },
              { value: 3, label: '3★+' },
              { value: 4, label: '4★+' },
              { value: 5, label: '5★ Only' },
            ] as { value: 0 | 3 | 4 | 5; label: string }[]).map(({ value, label }) => (
              <button key={value} type="button" onClick={() => setMinRating(value)}
                className={cn('text-[11px] font-medium rounded-full border px-2.5 py-1 transition-colors',
                  minRating === value ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30')}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <button type="button" onClick={clearFilters}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="p-4 space-y-3">

      {/* Header row — all breakpoints */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filterUserId ? `Posts by ${filterUserName ?? 'user'}` : 'Check out what the community is cooking'}
        </p>
        <Button size="sm" className="gap-1.5 h-8 text-xs shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />Share A Recipe
        </Button>
      </div>

      {/* Mobile/tablet: search standalone */}
      <div className="relative lg:hidden">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input className="h-9 pl-9 pr-8 text-sm" placeholder="Search posts by username or handle…"
          value={feedSearch} onChange={(e) => setFeedSearch(e.target.value)} autoComplete="off" />
        {feedSearch && (
          <button type="button" onClick={() => setFeedSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Desktop: search (60%) + filter (40%) */}
      <div className="hidden lg:flex gap-3">
        <div className="w-[60%] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="h-9 pl-9 pr-8 text-sm w-full" placeholder="Search posts by username or handle…"
            value={feedSearch} onChange={(e) => setFeedSearch(e.target.value)} autoComplete="off" />
          {feedSearch && (
            <button type="button" onClick={() => setFeedSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="w-[40%]">
          <button type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="w-full h-9 flex items-center gap-2 px-3 rounded-xl border border-border/60 bg-card/50 text-left hover:bg-accent/30 transition-colors">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium flex-1">Filters</span>
            {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0', filtersOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {filterUserId && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <LayoutList className="h-3.5 w-3.5 text-primary shrink-0" />
          <p className="text-xs text-primary flex-1 min-w-0 truncate">Filtered by {filterUserName ?? 'user'}</p>
          <button type="button" onClick={onClearFilter} className="shrink-0 text-primary hover:text-primary/70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Collapsible filters — mobile/tablet */}
      <div className="lg:hidden rounded-xl border border-border/60 bg-card/50 overflow-hidden">
        <button type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/30 transition-colors">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium flex-1">Filters</span>
          {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0', filtersOpen && 'rotate-180')} />
        </button>
        {filtersOpen && filterPanelContent}
      </div>

      {/* Desktop: filter panel */}
      {filtersOpen && (
        <div className="hidden lg:block rounded-xl border border-border/60 bg-card/50 overflow-hidden">
          {filterPanelContent}
        </div>
      )}

      {isLoading && <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" /></div>}

      {!isLoading && filteredPosts.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><BookOpen className="h-5 w-5 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">
            {feedSearch.trim() ? 'No posts match that username.' : filterUserId ? 'No posts in this time range.' : 'No community posts yet. Be the first!'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {paginated.map((post) => (
          <PostCard key={post.id} post={post} meId={meId}
            onFollow={() => followMutation.mutate(post.userId)}
            onUnfollow={() => unfollowMutation.mutate(post.userId)}
            onDelete={() => deletePost.mutate(post.id)}
            onViewRecipe={() => setRecipeModalPost(post)}
            onRequestRecipe={() => requestShare.mutate({ recipeId: post.recipeId!, ownerId: post.userId })}
            onViewProfile={() => setProfileTarget({ userId: post.userId, name: post.userName, handle: post.userHandle, image: post.userImage, sameHousehold: post.sameHousehold })}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <Button variant="outline" size="sm" className="gap-1 h-8 text-xs"
            disabled={clampedPage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-3.5 w-3.5" />Previous
          </Button>
          <span className="text-xs text-muted-foreground">{clampedPage + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" className="gap-1 h-8 text-xs"
            disabled={clampedPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Next<ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <CreatePostModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <RecipeDetailModal post={recipeModalPost} meId={meId} onClose={() => setRecipeModalPost(null)} />
      <UserProfileModal target={profileTarget} meId={meId} open={!!profileTarget} onClose={() => setProfileTarget(null)} />
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, meId, onFollow, onUnfollow, onDelete, onViewRecipe, onRequestRecipe, onViewProfile }: {
  post: CommunityPost; meId: string;
  onFollow: () => void; onUnfollow: () => void; onDelete: () => void;
  onViewRecipe: () => void; onRequestRecipe: () => void; onViewProfile: () => void;
}) {
  const isOwn = post.userId === meId;
  const [imgIdx, setImgIdx] = useState(0);
  const imgs = post.recipeImages;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
        <button type="button" onClick={onViewProfile} className="shrink-0">
          <Avatar className="h-9 w-9 ring-2 ring-border hover:ring-primary transition-all">
            <AvatarImage src={post.userImage ?? undefined} />
            <AvatarFallback className="text-xs font-semibold">{initials(post.userName, post.userHandle ?? post.userId)}</AvatarFallback>
          </Avatar>
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onViewProfile} className="text-left">
            <p className="text-sm font-semibold truncate hover:text-primary transition-colors">{post.userHandle ? `@${post.userHandle}` : post.userName ?? 'User'}</p>
          </button>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isOwn && (
            <button type="button" onClick={post.isFollowing ? onUnfollow : onFollow}
              className={cn('flex items-center gap-1 text-[11px] font-medium rounded-full border px-2.5 py-1 transition-colors',
                post.isFollowing
                  ? 'border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/50'
                  : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground')}>
              {post.isFollowing ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
              {post.isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
          {isOwn && (
            <button type="button" onClick={onDelete}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 pb-2 flex-1">
        <p className="text-sm leading-relaxed text-foreground/90 line-clamp-2">{post.comment}</p>
      </div>

      {post.recipeId && post.reviewCount > 0 && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground">
            {post.reviewCount} {post.reviewCount === 1 ? 'review' : 'reviews'}
            {post.recipeAvgRating != null && (
              <span className="ml-1 text-foreground/70">· {post.recipeAvgRating.toFixed(1)} ★</span>
            )}
          </p>
        </div>
      )}

      {post.recipeId ? (
        <div className="mx-3 mb-3 rounded-xl border bg-background/60 overflow-hidden">
          {imgs.length > 0 && (
            <div className="relative w-full h-36 bg-muted overflow-hidden">
              <img src={imgs[imgIdx]} alt={post.recipeTitle ?? ''} className="w-full h-full object-cover" />
              {imgs.length > 1 && (
                <>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setImgIdx((i) => (i - 1 + imgs.length) % imgs.length); }}
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setImgIdx((i) => (i + 1) % imgs.length); }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                    {imgs.map((_, i) => (
                      <span key={i} className={cn('h-1 rounded-full transition-all', i === imgIdx ? 'w-3 bg-white' : 'w-1 bg-white/50')} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{post.recipeTitle}</p>
              {post.recipeDescription && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{post.recipeDescription}</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={onViewRecipe}
                className="flex items-center gap-1 text-[11px] font-medium rounded-full border border-border/60 px-2.5 py-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                <BookOpen className="h-3 w-3" />View
              </button>
              {!isOwn && !post.sameHousehold && (
                <button type="button" onClick={onRequestRecipe}
                  className="flex items-center gap-1 text-[11px] font-medium rounded-full border border-primary px-2.5 py-1 text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
                  <Send className="h-3 w-3" />Request
                </button>
              )}
              {!isOwn && post.sameHousehold && (
                <span className="flex items-center gap-1 text-[11px] font-medium rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground cursor-default">
                  <Users className="h-3 w-3" />Household
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-3 mb-3 rounded-xl border border-dashed border-border/50 bg-muted/20 px-3 py-2 flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          <p className="text-xs text-muted-foreground italic">Recipe no longer available</p>
        </div>
      )}

      <div className="px-3 pb-2.5">
        <p className="text-[10px] text-muted-foreground/60">{formatDate(post.createdAt)}</p>
      </div>
    </div>
  );
}

// ─── Search Members Tab ───────────────────────────────────────────────────────

function SearchMembersTab({ meId }: { meId: string }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [profileTarget, setProfileTarget] = useState<ProfileModalTarget | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { data: myHousehold } = useQuery({
    queryKey: queryKeys.household.mine(),
    queryFn: () => api.get<{ id: string; name: string; role: string } | null>('/api/households/mine'),
  });
  const myHouseholdId = myHousehold?.id ?? null;

  const { data: users = [], isLoading, isFetching } = useQuery({
    queryKey: queryKeys.users.community(search),
    queryFn: () => api.get<CommunityUser[]>(`/api/users/community?search=${encodeURIComponent(search)}`),
    enabled: search.length >= 2,
  });

  const { data: following = [] } = useQuery({
    queryKey: queryKeys.follows.following(),
    queryFn: () => api.get<FollowedUser[]>('/api/follows/following'),
  });
  const followingSet = new Set(following.map((f) => f.id));

  const followMutation = useMutation({
    mutationFn: (userId: string) => api.post('/api/follows', { followingId: userId }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.follows.following() }); void queryClient.invalidateQueries({ queryKey: queryKeys.community.posts() }); toast.success('Following'); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const unfollowMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/api/follows/${userId}`),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.follows.following() }); void queryClient.invalidateQueries({ queryKey: queryKeys.community.posts() }); toast.success('Unfollowed'); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const handleInput = (val: string) => {
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSearch(val.trim()), 350);
  };

  const visibleUsers = users.filter((u) => u.id !== meId);

  return (
    <div className="p-4 space-y-4">
      <div className="relative max-w-xs sm:max-w-sm mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="h-10 pl-10" placeholder="Search community members by handle…"
          value={query} onChange={(e) => handleInput(e.target.value)} autoComplete="off" />
      </div>

      {query.length < 2 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Search className="h-5 w-5 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">Start typing to find community members.</p>
        </div>
      )}

      {query.length >= 2 && (isLoading || isFetching) && (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" /></div>
      )}

      {query.length >= 2 && !isLoading && !isFetching && visibleUsers.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Users className="h-5 w-5 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">No users match that search.</p>
        </div>
      )}

      {query.length >= 2 && !isLoading && !isFetching && visibleUsers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visibleUsers.map((u) => {
            const isFollowing = followingSet.has(u.id);
            const isHousehold = myHouseholdId !== null && u.householdId === myHouseholdId;
            return (
              <div key={u.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3 hover:bg-accent/30 transition-colors">
                <button type="button" className="shrink-0"
                  onClick={() => setProfileTarget({ userId: u.id, name: u.name, handle: u.handle, image: u.image, sameHousehold: isHousehold })}>
                  <Avatar className="h-10 w-10 ring-2 ring-border hover:ring-primary transition-all">
                    <AvatarImage src={u.image ?? undefined} />
                    <AvatarFallback className="text-sm font-semibold">{initials(u.name, u.handle ?? u.id)}</AvatarFallback>
                  </Avatar>
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" className="text-left w-full"
                    onClick={() => setProfileTarget({ userId: u.id, name: u.name, handle: u.handle, image: u.image, sameHousehold: isHousehold })}>
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm truncate hover:text-primary transition-colors">{u.handle ? '@' + u.handle : u.name ?? 'User'}</p>
                      {isHousehold && <Users className="h-3 w-3 text-muted-foreground shrink-0" />}
                    </div>
                    {u.bio && <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{u.bio}</p>}
                  </button>
                </div>
                <button type="button"
                  onClick={() => isFollowing ? unfollowMutation.mutate(u.id) : followMutation.mutate(u.id)}
                  className={cn('flex items-center gap-1 text-[11px] font-medium rounded-full border px-2.5 py-1 transition-colors shrink-0',
                    isFollowing
                      ? 'border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/50'
                      : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground')}>
                  {isFollowing ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <UserProfileModal target={profileTarget} meId={meId} open={!!profileTarget} onClose={() => setProfileTarget(null)} />
    </div>
  );
}

// ─── Following Tab ────────────────────────────────────────────────────────────

function FollowingTab({ meId, onViewUserFeed }: {
  meId: string; onViewUserFeed: (userId: string, name: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [profileTarget, setProfileTarget] = useState<ProfileModalTarget | null>(null);

  const { data: myHousehold } = useQuery({
    queryKey: queryKeys.household.mine(),
    queryFn: () => api.get<{ id: string; name: string; role: string } | null>('/api/households/mine'),
  });
  const myHouseholdId = myHousehold?.id ?? null;

  const { data: following = [], isLoading } = useQuery({
    queryKey: queryKeys.follows.following(),
    queryFn: () => api.get<FollowedUser[]>('/api/follows/following'),
  });

  const unfollowMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/api/follows/${userId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.follows.following() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.community.followingPosts() });
      toast.success('Unfollowed');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" /></div>;

  if (following.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><UserPlus className="h-5 w-5 text-muted-foreground" /></div>
        <p className="text-sm text-muted-foreground">You're not following anyone yet. Use Search Members to find people.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {following.map((u) => {
        const isPrivate = !u.isPublic;
        const isHousehold = myHouseholdId !== null && u.householdId === myHouseholdId;
        return (
          <div key={u.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3">
            <button type="button"
              onClick={!isPrivate ? () => setProfileTarget({ userId: u.id, name: u.name, handle: u.handle, image: u.image, sameHousehold: isHousehold }) : undefined}
              className={cn('shrink-0', !isPrivate && 'cursor-pointer')}>
              <Avatar className={cn('h-10 w-10', !isPrivate && 'ring-2 ring-border hover:ring-primary transition-all')}>
                {!isPrivate && <AvatarImage src={u.image ?? undefined} />}
                <AvatarFallback className="text-sm font-semibold">
                  {isPrivate ? <Lock className="h-4 w-4" /> : initials(u.name, u.handle ?? u.id)}
                </AvatarFallback>
              </Avatar>
            </button>

            <div className="min-w-0 flex-1">
              {isPrivate ? (
                <>
                  <p className="text-sm font-semibold text-muted-foreground">Private Account</p>
                  <p className="text-xs text-muted-foreground/60">This account is private</p>
                </>
              ) : (
                <button type="button" className="text-left w-full"
                  onClick={() => setProfileTarget({ userId: u.id, name: u.name, handle: u.handle, image: u.image, sameHousehold: isHousehold })}>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate hover:text-primary transition-colors">{u.handle ? '@' + u.handle : u.name ?? 'User'}</p>
                    {isHousehold && <Users className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </div>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!isPrivate && (
                <button type="button"
                  onClick={() => onViewUserFeed(u.id, u.handle ?? u.name)}
                  className="flex items-center gap-1 text-[11px] font-medium rounded-full border border-border/60 px-2.5 py-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                  <LayoutList className="h-3 w-3" />Posts
                </button>
              )}
              <button type="button" onClick={() => unfollowMutation.mutate(u.id)}
                className="flex items-center gap-1 text-[11px] font-medium rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors">
                <UserMinus className="h-3 w-3" />Unfollow
              </button>
            </div>
          </div>
        );
      })}
      </div>
      <UserProfileModal target={profileTarget} meId={meId} open={!!profileTarget} onClose={() => setProfileTarget(null)} />
    </div>
  );
}
