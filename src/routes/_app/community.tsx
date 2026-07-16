import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  Search, Users, BookOpen, UserPlus, UserMinus,
  Send, UtensilsCrossed, Lock, Plus, ChevronRight, ChevronDown,
  Trash2, Star, ChevronLeft, LayoutList, X, Scale, ChefHat, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useMe } from '@/hooks/useMe';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
}

interface CommunityPost {
  id: string; comment: string; createdAt: string;
  userId: string; userName: string | null; userHandle: string | null; userImage: string | null;
  recipeId: string | null; recipeTitle: string | null; recipeDescription: string | null;
  recipeImage: string | null; isFollowing: boolean; isOwnPost: boolean;
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

type MeasureSystem = 'metric' | 'imperial';

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
}

function UserProfileModal({ target, meId, open, onClose }: {
  target: ProfileModalTarget | null; meId: string; open: boolean; onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.users.profile(target?.handle ?? ''),
    queryFn: () => api.get<PublicProfile>(`/api/users/${target!.handle}`),
    enabled: open && !!target?.handle,
  });

  const requestRecipe = useMutation({
    mutationFn: ({ recipeId, ownerId }: { recipeId: string; ownerId: string }) =>
      api.post('/api/shares/request', { recipeId, ownerId }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.shares.sent() }); toast.success('Recipe Requested'); },
    onError: (err) => {
      if (err instanceof ApiError && (err as any).sameHousehold) {
        toast.info('This person is in your household — you already have access to their recipes.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Request Failed');
      }
    },
  });

  if (!target) return null;
  const ini = initials(target.name, target.handle ?? target.userId);
  const isCurrentUser = target.userId === meId;
  const activePins = (profile?.pins ?? []).filter((p) => p.recipeId !== null);

  return (
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
                    className={cn('relative flex items-center gap-3 rounded-xl border bg-card p-2.5',
                      !isCurrentUser && pin.recipeId && 'cursor-pointer hover:bg-accent/40 transition-colors group')}
                    onClick={!isCurrentUser && pin.recipeId ? () => requestRecipe.mutate({ recipeId: pin.recipeId!, ownerId: target.userId }) : undefined}>
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
                    {!isCurrentUser && <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><Send className="h-4 w-4 text-primary" /></div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reviews section (collapsible) ───────────────────────────────────────────

const REVIEWS_PREVIEW = 3;

function ReviewsSection({ reviews }: { reviews: RecipeReview[] }) {
  const [expanded, setExpanded] = useState(false);
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
              <div key={r.id} className="rounded-xl border bg-card px-3 py-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={r.reviewerImage ?? undefined} />
                    <AvatarFallback className="text-[10px]">{initials(r.reviewerName, r.reviewerHandle ?? '?')}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{r.reviewerName ?? r.reviewerHandle ?? 'User'}</p>
                  </div>
                  <StarDisplay rating={r.rating} />
                </div>
                {r.comment && <p className="text-sm text-foreground/80 leading-relaxed">{r.comment}</p>}
                <p className="text-[10px] text-muted-foreground/50">{formatDate(r.updatedAt)}</p>
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
    </div>
  );
}

// ─── Recipe Detail Modal ──────────────────────────────────────────────────────

const REVIEW_CHAR_LIMIT = 500;

function RecipeDetailModal({ post, meId, onClose }: { post: CommunityPost | null; meId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [servings, setServings] = useState<number | null>(null);
  const [system, setSystem] = useState<MeasureSystem>('metric');
  const [imageIdx, setImageIdx] = useState(0);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const reviewCommentRef = useRef<HTMLTextAreaElement>(null);

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
      try { return await api.get<{ rating: number; comment: string | null }>(`/api/shares/${myShare!.id}/review`); }
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
        toast.info('This person is in your household — you already have access to their recipes.');
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
              <button type="button" onClick={() => setSystem((s) => s === 'metric' ? 'imperial' : 'metric')}
                className="flex items-center gap-1.5 text-[11px] font-medium rounded-full border px-2.5 py-1 transition-colors shrink-0 hover:bg-accent">
                <Scale className="h-3 w-3" />{system === 'metric' ? 'Metric' : 'Imperial'}
              </button>
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
              <ReviewsSection reviews={reviews} />

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
                      <Button size="sm" className="w-full"
                        disabled={reviewRating === 0 || submitReview.isPending}
                        onClick={() => submitReview.mutate()}>
                        {submitReview.isPending ? 'Saving…' : myReview ? 'Update Review' : 'Submit Review'}
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-1">Request this recipe first to leave a review.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky bottom action bar */}
        {!post.isOwnPost && post.recipeId && (
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
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Post Modal ────────────────────────────────────────────────────────

function CreatePostModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeItem | null>(null);
  const [comment, setComment] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [step, setStep] = useState<'recipe' | 'comment'>('recipe');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: recipes = [], isLoading: recipesLoading } = useQuery({
    queryKey: queryKeys.recipeBook.recipes(debouncedSearch),
    queryFn: () => api.get<RecipeItem[]>(`/api/recipe-book/recipes?search=${encodeURIComponent(debouncedSearch)}`),
    enabled: open && debouncedSearch.length >= 1,
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
    setSelectedRecipe(null); setComment(''); setSearch('');
    setDebouncedSearch(''); setStep('recipe'); onClose();
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(val.trim()), 350);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-[calc(100vw-48px)] max-w-lg mx-auto">
        <DialogHeader>
          <DialogTitle>{step === 'recipe' ? 'Select A Recipe' : 'Write Your Post'}</DialogTitle>
        </DialogHeader>

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
                  onClick={() => { setSelectedRecipe(r); setStep('comment'); }}
                  className="w-full text-left rounded-lg border px-2.5 py-2 hover:bg-accent transition-colors flex items-center gap-2.5">
                  {r.image
                    ? <img src={r.image} alt={r.title} className="h-9 w-9 rounded-md object-cover shrink-0" />
                    : <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0"><UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground/40" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate leading-tight">{r.title}</p>
                    {r.description && <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">{r.description}</p>}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
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
      <div className="w-full max-w-md sm:max-w-xl lg:w-[65%] lg:max-w-none">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="rounded-t-2xl border border-b-0 overflow-hidden">
            <TabsList className="w-full h-12 rounded-none bg-card border-b p-0 gap-0">
              {[
                { value: 'feed', label: 'Community Recipes' },
                { value: 'search', label: 'Search Members' },
                { value: 'following', label: 'Following' },
              ].map(({ value, label }) => (
                <TabsTrigger key={value} value={value}
                  className="flex-1 h-full rounded-none text-[10px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=inactive]:text-muted-foreground px-0.5">
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

type SinceFilter = '24h' | '1w' | '1m' | 'all';
const PAGE_SIZE = 5;

function FeedTab({ meId, filterUserId, filterUserName, onClearFilter }: {
  meId: string; filterUserId: string | null; filterUserName: string | null; onClearFilter: () => void;
}) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [recipeModalPost, setRecipeModalPost] = useState<CommunityPost | null>(null);
  const [profileTarget, setProfileTarget] = useState<ProfileModalTarget | null>(null);
  const [since, setSince] = useState<SinceFilter>('all');
  const [page, setPage] = useState(0);
  const [feedSearch, setFeedSearch] = useState('');

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filterUserId, since, feedSearch]);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: queryKeys.community.posts(filterUserId ?? undefined, since),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterUserId) params.set('userId', filterUserId);
      if (since !== 'all') params.set('since', since);
      return api.get<CommunityPost[]>(`/api/community/posts?${params.toString()}`);
    },
  });

  const filteredPosts = feedSearch.trim()
    ? posts.filter((p) => {
        const q = feedSearch.toLowerCase();
        return p.userName?.toLowerCase().includes(q) || p.userHandle?.toLowerCase().includes(q);
      })
    : posts;

  const totalPages = Math.ceil(filteredPosts.length / PAGE_SIZE);
  const clampedPage = Math.min(page, Math.max(0, totalPages - 1));
  const paginated = filteredPosts.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE);

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
        toast.info('This person is in your household — you already have access to their recipes.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed');
      }
    },
  });

  const sinceLabels: { value: SinceFilter; label: string }[] = [
    { value: '24h', label: 'Last 24h' },
    { value: '1w', label: 'This Week' },
    { value: '1m', label: 'This Month' },
    { value: 'all', label: 'All Time' },
  ];

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filterUserId ? `Posts by ${filterUserName ?? 'user'}` : 'What the community is cooking'}
        </p>
        <Button size="sm" className="gap-1.5 h-8 text-xs shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />Share A Recipe
        </Button>
      </div>

      {/* Username search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input className="h-9 pl-9 pr-8 text-sm" placeholder="Search posts by username…"
          value={feedSearch} onChange={(e) => setFeedSearch(e.target.value)} autoComplete="off" />
        {feedSearch && (
          <button type="button" onClick={() => setFeedSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
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

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {sinceLabels.map(({ value, label }) => (
          <button key={value} type="button" onClick={() => setSince(value)}
            className={cn('shrink-0 text-[11px] font-medium rounded-full border px-2.5 py-1 transition-colors',
              since === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30')}>
            {label}
          </button>
        ))}
      </div>

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
            onViewProfile={() => setProfileTarget({ userId: post.userId, name: post.userName, handle: post.userHandle, image: post.userImage })}
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

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
        <button type="button" onClick={onViewProfile} className="shrink-0">
          <Avatar className="h-9 w-9 ring-2 ring-border hover:ring-primary transition-all">
            <AvatarImage src={post.userImage ?? undefined} />
            <AvatarFallback className="text-xs font-semibold">{initials(post.userName, post.userHandle ?? post.userId)}</AvatarFallback>
          </Avatar>
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onViewProfile} className="text-left">
            <p className="text-sm font-semibold truncate hover:text-primary transition-colors">{post.userName ?? post.userHandle ?? 'User'}</p>
          </button>
          {post.userHandle && <p className="text-xs text-muted-foreground">@{post.userHandle}</p>}
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

      <div className="px-3 pb-3">
        <p className="text-sm leading-relaxed text-foreground/90">{post.comment}</p>
      </div>

      {post.recipeId ? (
        <div className="mx-3 mb-3 rounded-xl border bg-background/60 overflow-hidden">
          {post.recipeImage && <img src={post.recipeImage} alt={post.recipeTitle ?? ''} className="w-full h-36 object-cover" />}
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
              {!isOwn && (
                <button type="button" onClick={onRequestRecipe}
                  className="flex items-center gap-1 text-[11px] font-medium rounded-full border border-primary px-2.5 py-1 text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
                  <Send className="h-3 w-3" />Request
                </button>
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
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

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
      <div className="relative">
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
        <div className="space-y-2">
          {visibleUsers.map((u) => {
            const isFollowing = followingSet.has(u.id);
            return (
              <div key={u.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3 hover:bg-accent/30 transition-colors">
                <button type="button" className="shrink-0"
                  onClick={() => setProfileTarget({ userId: u.id, name: u.name, handle: u.handle, image: u.image })}>
                  <Avatar className="h-10 w-10 ring-2 ring-border hover:ring-primary transition-all">
                    <AvatarImage src={u.image ?? undefined} />
                    <AvatarFallback className="text-sm font-semibold">{initials(u.name, u.handle ?? u.id)}</AvatarFallback>
                  </Avatar>
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" className="text-left w-full"
                    onClick={() => setProfileTarget({ userId: u.id, name: u.name, handle: u.handle, image: u.image })}>
                    <p className="font-semibold text-sm truncate hover:text-primary transition-colors">{u.name ?? u.handle}</p>
                    {u.handle && <p className="text-xs text-muted-foreground">@{u.handle}</p>}
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
    <div className="p-4 space-y-2">
      {following.map((u) => {
        const isPrivate = !u.isPublic;
        return (
          <div key={u.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3">
            <button type="button"
              onClick={!isPrivate ? () => setProfileTarget({ userId: u.id, name: u.name, handle: u.handle, image: u.image }) : undefined}
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
                  onClick={() => setProfileTarget({ userId: u.id, name: u.name, handle: u.handle, image: u.image })}>
                  <p className="text-sm font-semibold truncate hover:text-primary transition-colors">{u.name ?? u.handle ?? 'User'}</p>
                  {u.handle && <p className="text-xs text-muted-foreground">@{u.handle}</p>}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!isPrivate && (
                <button type="button"
                  onClick={() => onViewUserFeed(u.id, u.name ?? u.handle)}
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

      <UserProfileModal target={profileTarget} meId={meId} open={!!profileTarget} onClose={() => setProfileTarget(null)} />
    </div>
  );
}
