import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useMemo, useRef, useState } from 'react';
import {
  LogOut, Trash2, Camera, Sun, Moon, CheckCircle2, XCircle,
  DoorOpen, ArrowLeftRight, Mail, Crown, Home, TriangleAlert,
  Star, UtensilsCrossed, X, UserPlus, Search, ChevronUp, ChevronDown,
  Plus, Globe, Lock, Send, BookOpen,
} from 'lucide-react';
import { authClient } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useMe } from '@/hooks/useMe';
import { useHousehold } from '@/hooks/useHousehold';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface Member {
  id: string; userId: string; name: string | null; handle: string | null;
  image: string | null; role: 'OWNER' | 'USER'; joinedAt: string;
}

interface Pin {
  position: number; recipeId: string | null; recipeTitle: string | null;
  recipeDescription: string | null; recipeImage: string | null;
  recipeRating: { avg: number; count: number } | null;
}

interface OwnPin {
  position: number; recipeId: string | null;
  recipeTitle: string | null; recipeDescription: string | null;
  recipeImage: string | null;
}

type PinSlot = {
  recipeId: string; recipeTitle: string;
  recipeDescription: string | null; recipeImage: string | null;
} | null;

interface RecipeItem {
  id: string; title: string; description: string | null;
  categoryId: string | null; categoryName: string | null;
  image: string | null;
}

interface MemberProfile {
  id: string; name: string | null; handle: string | null;
  bio: string | null; image: string | null; pins: Pin[];
}

interface SearchUser {
  id: string; name: string | null; handle: string | null;
  image: string | null; householdId: string | null; householdName: string | null;
}

interface PendingItem {
  id: string; householdId: string; householdName: string;
  fromName: string | null; fromHandle: string | null; fromImage: string | null;
  type: 'INVITE' | 'REQUEST';
}
interface PendingResponse { invites: PendingItem[]; requests: PendingItem[]; }

interface PendingSentResponse {
  sentRequests: { id: string; householdId: string; householdName: string; type: string; status: string; createdAt: string }[];
  sentInvites: { id: string; householdId: string; householdName: string; inviteeName: string | null; inviteeHandle: string | null; inviteeImage: string | null; type: string; status: string }[];
}

interface ShareItem {
  id: string; recipeId: string | null; recipeTitle: string | null;
  fromUserId: string; fromUserName: string | null; fromUserHandle: string | null; fromUserImage: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REQUESTED';
  copiedRecipeId: string | null; createdAt: string; updatedAt: string;
}

interface SentShareItem {
  id: string; recipeId: string | null; recipeTitle: string | null;
  toUserId: string; toUserName: string | null; toUserHandle: string | null; toUserImage: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REQUESTED';
  copiedRecipeId: string | null; createdAt: string;
}

interface MeData {
  id: string; name: string | null; email: string; firstName: string | null;
  lastName: string | null; bio: string | null; image: string | null;
  handle: string | null; theme: string | null; isPublic: boolean;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(1, 'Required').max(50),
  lastName: z.string().min(1, 'Required').max(50),
  bio: z.string().max(200).optional(),
  handle: z.union([
    z.string().min(2, 'Handle must be at least 2 characters').max(40).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
    z.literal(''),
  ]).optional(),
});

const emailSchema = z.object({ newEmail: z.string().email('Enter a valid email') });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string | null, fallback: string) {
  if (!name) return fallback[0]?.toUpperCase() ?? '?';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function StarRating({ rating }: { rating: { avg: number; count: number } | null }) {
  if (!rating || rating.count === 0)
    return <span className="text-[10px] text-muted-foreground">No Reviews</span>;
  const rounded = Math.round(rating.avg);
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn('h-3 w-3', i <= rounded ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25')} />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">({rating.count})</span>
    </div>
  );
}

function DialogX() {
  return (
    <AlertDialogCancel className="absolute top-3 left-3 h-7 w-7 rounded-full p-0 border-0 bg-transparent hover:bg-muted flex items-center justify-center">
      <X className="h-4 w-4" />
    </AlertDialogCancel>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ProfilePage() {
  const { data: me, isLoading: meLoading } = useMe();
  const { household } = useHousehold();

  const { data: householdPending } = useQuery({
    queryKey: queryKeys.household.pending(),
    queryFn: () => api.get<PendingResponse>('/api/households/pending'),
  });
  const { data: sharesReceived } = useQuery({
    queryKey: queryKeys.shares.received(),
    queryFn: () => api.get<ShareItem[]>('/api/shares/received'),
  });
  const notifCount =
    ((householdPending?.invites?.length ?? 0) + (householdPending?.requests?.length ?? 0)) +
    (sharesReceived?.filter((s) => s.status === 'PENDING' || s.status === 'REQUESTED').length ?? 0);

  if (meLoading || !me) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="border-primary/30 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-4 pb-24 pt-6">
      <div className="w-full max-w-md">
        <Tabs defaultValue="settings">
          <div className="rounded-t-2xl border border-b-0 overflow-hidden">
            <TabsList className="w-full h-12 rounded-none bg-card border-b p-0 gap-0">
              {(['settings', 'household', 'notifications'] as const).map((tab) => (
                <TabsTrigger key={tab} value={tab}
                  className="flex-1 h-full rounded-none capitalize text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=inactive]:text-muted-foreground">
                  {tab === 'notifications' ? (
                    <span className="relative inline-flex items-center gap-1">
                      Notifications
                      {notifCount > 0 && (
                        <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-1 leading-none">
                          {notifCount > 9 ? '9+' : notifCount}
                        </span>
                      )}
                    </span>
                  ) : tab === 'settings' ? 'Settings' : 'Household'}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="rounded-b-2xl border border-t-0 bg-background overflow-hidden">
            <TabsContent value="settings" className="mt-0">
              <SettingsTab me={me as MeData} household={household} />
            </TabsContent>
            <TabsContent value="household" className="mt-0">
              <HouseholdTab household={household} meId={me.id} />
            </TabsContent>
            <TabsContent value="notifications" className="mt-0">
              <NotificationsTab household={household} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({ me, household }: {
  me: MeData;
  household: { id: string; name: string; role: 'OWNER' | 'USER' } | null;
}) {
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [emailSent, setEmailSent] = useState(false);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: standardSchemaResolver(profileSchema),
    values: {
      firstName: me.firstName ?? '',
      lastName: me.lastName ?? '',
      bio: me.bio ?? '',
      handle: me.handle ?? '',
    },
  });

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: standardSchemaResolver(emailSchema),
    defaultValues: { newEmail: '' },
  });

  const updateProfile = useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string; bio?: string; handle?: string; isPublic?: boolean; theme?: string }) =>
      api.patch('/api/users/me', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.me() });
      toast.success('Profile Updated');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Update Failed'),
  });

  const uploadPicture = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/users/me/picture', { method: 'POST', credentials: 'include', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.message ?? body.error ?? res.statusText);
      }
      return res.json() as Promise<{ id: string; image: string }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.me() });
      toast.success('Profile Picture Updated');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Upload Failed'),
  });

  const changeEmail = useMutation({
    mutationFn: (newEmail: string) => api.post('/api/auth/change-email', { newEmail }),
    onSuccess: () => { setEmailSent(true); emailForm.reset(); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Request Failed'),
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.post('/api/auth/delete-user', {}),
    onSuccess: () => { localStorage.removeItem('householdSkipped'); window.location.href = '/sign-in'; },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Delete Failed'),
  });

  const handleLogout = async () => {
    localStorage.removeItem('householdSkipped');
    await authClient.signOut();
    window.location.href = '/sign-in';
  };

  const handleThemeChange = (next: 'light' | 'dark') => {
    setTheme(next);
    void api.patch('/api/users/me', { theme: next });
  };

  const handleVisibilityChange = (pub: boolean) => {
    updateProfile.mutate({ isPublic: pub });
  };

  const isDark = resolvedTheme === 'dark';

  const onProfileSubmit = (v: z.infer<typeof profileSchema>) => {
    updateProfile.mutate({
      firstName: v.firstName,
      lastName: v.lastName,
      bio: v.bio,
      ...(v.handle && v.handle.length >= 2 ? { handle: v.handle } : {}),
    });
  };

  return (
    <div className="divide-y">

      {/* ── Avatar + Log Out ── */}
      <div className="flex flex-col items-center gap-2 p-6">
        <div className="relative">
          <Avatar className="h-20 w-20">
            <AvatarImage src={me.image ?? undefined} alt={me.name ?? me.email} />
            <AvatarFallback className="text-xl font-semibold">{initials(me.name, me.email)}</AvatarFallback>
          </Avatar>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadPicture.isPending}
            className="bg-primary text-primary-foreground absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition hover:brightness-110 disabled:opacity-50">
            {uploadPicture.isPending
              ? <span className="h-3 w-3 animate-spin rounded-full border border-t-transparent" />
              : <Camera className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="text-center">
          <p className="font-semibold">{me.name ?? me.email}</p>
          {me.handle && <p className="text-muted-foreground text-xs">@{me.handle}</p>}
        </div>
        <Button size="sm" onClick={handleLogout} className="mt-1 gap-2">
          <LogOut className="h-3.5 w-3.5" />Log Out
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPicture.mutate(f); e.target.value = ''; }} />
      </div>

      {/* ── Profile ── */}
      <div className="p-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Profile</p>
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={profileForm.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">First Name</FormLabel>
                  <FormControl><Input className="h-9" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={profileForm.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Last Name</FormLabel>
                  <FormControl><Input className="h-9" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={profileForm.control} name="handle" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Handle</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                    <Input className="h-9 pl-7" placeholder="yourhandle" autoComplete="off" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={profileForm.control} name="bio" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Bio</FormLabel>
                <FormControl>
                  <Textarea placeholder="A few words about yourself…" className="resize-none text-sm" rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* ── Email ── */}
      <div className="p-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</p>
        <p className="text-sm font-medium">{me.email}</p>
        {emailSent ? (
          <div className="bg-primary/8 border border-primary/20 rounded-xl p-3 flex items-start gap-2">
            <Mail className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs leading-relaxed">
              A confirmation link has been sent to your <strong>current email address</strong>. Click it to confirm — your email won't update until you do.
            </p>
          </div>
        ) : (
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit((v) => changeEmail.mutate(v.newEmail))} className="flex gap-2">
              <FormField control={emailForm.control} name="newEmail" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input className="h-9 text-sm" type="email" placeholder="New email address" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" size="sm" disabled={changeEmail.isPending} className="shrink-0 self-start h-9">
                Update
              </Button>
            </form>
          </Form>
        )}
      </div>

      {/* ── Appearance ── */}
      <div className="p-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Appearance</p>
        <div className="relative inline-flex h-9 w-[164px] items-center rounded-full border bg-muted/60 p-1">
          <span className={cn(
            'pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-background shadow-sm transition-transform duration-300 ease-in-out',
            isDark && 'translate-x-[calc(100%+4px)]',
          )} />
          <button type="button" onClick={() => handleThemeChange('light')}
            className={cn('relative z-10 flex flex-1 items-center justify-center gap-1.5 text-xs font-medium transition-colors duration-150',
              !isDark ? 'text-primary' : 'text-muted-foreground')}>
            <Sun className="h-3.5 w-3.5" />Light
          </button>
          <button type="button" onClick={() => handleThemeChange('dark')}
            className={cn('relative z-10 flex flex-1 items-center justify-center gap-1.5 text-xs font-medium transition-colors duration-150',
              isDark ? 'text-primary' : 'text-muted-foreground')}>
            <Moon className="h-3.5 w-3.5" />Dark
          </button>
        </div>
      </div>

      {/* ── Profile Visibility ── */}
      <div className="p-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Profile Visibility</p>
        <div className="relative inline-flex h-9 w-[172px] items-center rounded-full border bg-muted/60 p-1">
          <span className={cn(
            'pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-background shadow-sm transition-transform duration-300 ease-in-out',
            !me.isPublic && 'translate-x-[calc(100%+4px)]',
          )} />
          <button type="button" onClick={() => handleVisibilityChange(true)}
            className={cn('relative z-10 flex flex-1 items-center justify-center gap-1.5 text-xs font-medium transition-colors duration-150',
              me.isPublic ? 'text-primary' : 'text-muted-foreground')}>
            <Globe className="h-3.5 w-3.5" />Public
          </button>
          <button type="button" onClick={() => handleVisibilityChange(false)}
            className={cn('relative z-10 flex flex-1 items-center justify-center gap-1.5 text-xs font-medium transition-colors duration-150',
              !me.isPublic ? 'text-primary' : 'text-muted-foreground')}>
            <Lock className="h-3.5 w-3.5" />Private
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {me.isPublic
            ? 'Your profile is visible to everyone in the community.'
            : 'Your profile is hidden from community search.'}
        </p>
      </div>

      {/* ── Pinned Recipes ── */}
      <div className="p-5">
        <PinnedRecipesSection household={household} />
      </div>

      {/* ── Delete Account ── */}
      <div className="p-5 space-y-3">
        <div className="flex items-start gap-2">
          <TriangleAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-destructive">Delete Account</p>
            <p className="text-xs text-foreground/75 leading-relaxed">
              Permanent and cannot be undone. If you own a household with other members, transfer ownership first. If you're the last member, the entire household — recipe book, pantry and shopping list — will also be permanently deleted.
            </p>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="h-3.5 w-3.5" />Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-sm">
            <DialogX />
            <AlertDialogHeader>
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-center">Delete Your Account?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-center space-y-2 pt-1">
                  <span className="block font-medium text-foreground">This action is permanent and cannot be undone.</span>
                  <span className="block text-xs text-muted-foreground leading-relaxed">
                    If you own a household with other members, transfer ownership first. If you are the last member, the household and all its data will also be deleted.
                  </span>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <AlertDialogAction className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteAccount.mutate()}>
                Yes, Delete My Account
              </AlertDialogAction>
              <AlertDialogCancel className="w-full mt-0">Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

    </div>
  );
}

// ─── Pinned Recipes — 5-slot system ──────────────────────────────────────────

function PinnedRecipesSection({ household }: {
  household: { id: string; name: string; role: 'OWNER' | 'USER' } | null;
}) {
  const queryClient = useQueryClient();
  const [selectModal, setSelectModal] = useState<{ open: boolean; slot: number }>({ open: false, slot: 0 });

  const { data: pins = [] } = useQuery({
    queryKey: queryKeys.recipeBook.pins(),
    queryFn: () => api.get<OwnPin[]>('/api/recipe-book/pins'),
    enabled: !!household,
  });

  const slots: PinSlot[] = useMemo(() => {
    const arr: PinSlot[] = [null, null, null, null, null];
    for (const pin of pins) {
      const idx = pin.position - 1;
      if (idx >= 0 && idx < 5 && pin.recipeId) {
        arr[idx] = {
          recipeId: pin.recipeId,
          recipeTitle: pin.recipeTitle ?? 'Untitled',
          recipeDescription: pin.recipeDescription,
          recipeImage: pin.recipeImage,
        };
      }
    }
    return arr;
  }, [pins]);

  const updatePins = useMutation({
    mutationFn: (newSlots: PinSlot[]) => {
      const payload = newSlots
        .map((s, i) => s ? { position: i + 1, recipeId: s.recipeId } : null)
        .filter(Boolean) as { position: number; recipeId: string }[];
      return api.put('/api/recipe-book/pins', payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipeBook.pins() });
      toast.success('Pins Updated');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed To Update Pins'),
  });

  const openSelect = (slot: number) => setSelectModal({ open: true, slot });
  const closeSelect = () => setSelectModal({ open: false, slot: 0 });

  const handleSelect = (recipe: RecipeItem) => {
    const next = [...slots];
    next[selectModal.slot - 1] = {
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      recipeDescription: recipe.description,
      recipeImage: recipe.image,
    };
    updatePins.mutate(next);
    closeSelect();
  };

  const handleRemove = (slot: number) => {
    const next = [...slots];
    next[slot - 1] = null;
    updatePins.mutate(next);
  };

  const handleMove = (slot: number, dir: 'up' | 'down') => {
    const next = [...slots];
    const swapIdx = dir === 'up' ? slot - 2 : slot;
    [next[slot - 1], next[swapIdx]] = [next[swapIdx], next[slot - 1]];
    updatePins.mutate(next);
  };

  const excludeIds = useMemo(
    () => slots.filter(Boolean).map((s) => s!.recipeId),
    [slots],
  );

  if (!household) {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pinned Recipes</p>
        <p className="text-xs text-muted-foreground">Join a household to pin recipes.</p>
      </div>
    );
  }

  const busy = updatePins.isPending;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pinned Recipes</p>
        <p className="text-xs text-muted-foreground mt-0.5">Up to 5 recipes shown on your public profile.</p>
      </div>

      <div className="space-y-2">
        {slots.map((slot, idx) => {
          const pos = idx + 1;
          return slot ? (
            <FilledPinSlot key={idx} slot={slot} position={pos}
              onReplace={() => openSelect(pos)}
              onRemove={() => handleRemove(pos)}
              onMoveUp={() => handleMove(pos, 'up')}
              onMoveDown={() => handleMove(pos, 'down')}
              canMoveUp={pos > 1}
              canMoveDown={pos < 5}
              disabled={busy}
            />
          ) : (
            <EmptyPinSlot key={idx} position={pos} onSelect={() => openSelect(pos)} />
          );
        })}
      </div>

      <RecipeSelectModal
        open={selectModal.open}
        onClose={closeSelect}
        onSelect={handleSelect}
        excludeIds={excludeIds.filter((_, i) => i !== selectModal.slot - 1)}
      />
    </div>
  );
}

function EmptyPinSlot({ position, onSelect }: { position: number; onSelect: () => void }) {
  return (
    <div className="relative flex h-[72px] items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/20">
      <span className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
        {position}
      </span>
      <Button size="sm" variant="ghost" onClick={onSelect}
        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Plus className="h-3.5 w-3.5" />Select Recipe
      </Button>
    </div>
  );
}

function FilledPinSlot({ slot, position, onReplace, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown, disabled }: {
  slot: NonNullable<PinSlot>; position: number;
  onReplace: () => void; onRemove: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
  canMoveUp: boolean; canMoveDown: boolean; disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
        {position}
      </span>
      {slot.recipeImage
        ? <img src={slot.recipeImage} alt={slot.recipeTitle} className="h-10 w-10 rounded-lg object-cover shrink-0" />
        : <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground/40" />
          </div>
      }
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{slot.recipeTitle}</p>
        {slot.recipeDescription && (
          <p className="text-xs text-muted-foreground truncate">{slot.recipeDescription}</p>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button type="button" disabled={!canMoveUp || disabled} onClick={onMoveUp}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" disabled={!canMoveDown || disabled} onClick={onMoveDown}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button type="button" disabled={disabled} onClick={onReplace}
          className="h-6 px-1.5 text-[10px] font-medium rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          Replace
        </button>
        <button type="button" disabled={disabled} onClick={onRemove}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function RecipeSelectModal({ open, onClose, onSelect, excludeIds }: {
  open: boolean; onClose: () => void;
  onSelect: (recipe: RecipeItem) => void; excludeIds: string[];
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: queryKeys.recipeBook.recipes(debouncedSearch),
    queryFn: () => api.get<RecipeItem[]>(`/api/recipe-book/recipes?search=${encodeURIComponent(debouncedSearch)}`),
    enabled: open && debouncedSearch.length >= 1,
  });

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(val.trim()), 350);
  };

  const handleClose = () => {
    setSearch('');
    setDebouncedSearch('');
    onClose();
  };

  const available = recipes.filter((r) => !excludeIds.includes(r.id));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Recipe</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="h-9 pl-9 text-sm" placeholder="Search your recipes…"
              value={search} onChange={(e) => handleSearch(e.target.value)} autoFocus autoComplete="off" />
          </div>
          <div className="max-h-56 scrollbar-hide overflow-y-auto space-y-1.5 -mx-1 px-1">
            {debouncedSearch.length < 1 && (
              <p className="text-xs text-muted-foreground py-6 text-center">Start typing to search your recipes…</p>
            )}
            {debouncedSearch.length >= 1 && isLoading && (
              <p className="text-xs text-muted-foreground py-4 text-center">Searching…</p>
            )}
            {debouncedSearch.length >= 1 && !isLoading && available.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No recipes match that search.</p>
            )}
            {debouncedSearch.length >= 1 && available.map((r) => (
              <button key={r.id} type="button" onClick={() => onSelect(r)}
                className="w-full text-left rounded-lg border px-2.5 py-2 hover:bg-accent transition-colors flex items-center gap-2.5">
                {r.image
                  ? <img src={r.image} alt={r.title} className="h-9 w-9 rounded-md object-cover shrink-0" />
                  : <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                }
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate leading-tight">{r.title}</p>
                  {r.description && <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">{r.description}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Household tab ────────────────────────────────────────────────────────────

function HouseholdTab({ household, meId }: {
  household: { id: string; name: string; role: 'OWNER' | 'USER' } | null;
  meId: string;
}) {
  const queryClient = useQueryClient();
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [transferTo, setTransferTo] = useState('');

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.household.members(household?.id ?? ''),
    queryFn: () => api.get<Member[]>(`/api/households/${household!.id}/members`),
    enabled: !!household,
  });

  const leaveMutation = useMutation({
    mutationFn: () => api.post(`/api/households/${household!.id}/leave`),
    onSuccess: () => { window.location.href = '/onboarding'; },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed To Leave'),
  });

  const transferMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/api/households/${household!.id}/transfer-ownership`, { userId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.household.mine() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.household.members(household!.id) });
      toast.success('Ownership Transferred');
      setTransferTo('');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Transfer Failed'),
  });

  if (!household) {
    return (
      <div className="p-10 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Home className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">You're not in a household yet.</p>
        <Button size="sm" onClick={() => { localStorage.removeItem('householdSkipped'); window.location.href = '/onboarding'; }}>
          Set Up A Household
        </Button>
      </div>
    );
  }

  const owner = (members ?? []).find((m) => m.role === 'OWNER');
  const otherMembers = (members ?? []).filter((m) => m.role !== 'OWNER');
  const isOwner = household.role === 'OWNER';
  const hasOtherMembers = otherMembers.length > 0;

  return (
    <div className="divide-y">
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold shrink-0">
            {household.name[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{household.name}</p>
            <p className="text-muted-foreground text-xs">{(members ?? []).length} {(members ?? []).length === 1 ? 'member' : 'members'}</p>
          </div>
          <Badge variant={isOwner ? 'default' : 'secondary'} className="text-[10px] shrink-0">
            {isOwner ? 'Owner' : 'Member'}
          </Badge>
        </div>
      </div>

      <div className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Members</p>
        {membersLoading
          ? <div className="flex justify-center py-4"><div className="border-primary/30 h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" /></div>
          : (<>
              {owner && <MemberCard member={owner} onClick={() => setSelectedMember(owner)} />}
              {otherMembers.map((m) => <MemberCard key={m.userId} member={m} onClick={() => setSelectedMember(m)} />)}
            </>)
        }
      </div>

      <div className="p-5">
        <InviteSection householdId={household.id} />
      </div>

      <div className="p-5 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Management</p>

        {isOwner && hasOtherMembers && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Transfer ownership to another member</p>
            <div className="flex gap-2">
              <select className="bg-input border-border flex-1 rounded-lg border px-3 py-2 text-sm min-w-0"
                value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                <option value="">Select member…</option>
                {otherMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name ?? m.handle ?? m.userId}</option>
                ))}
              </select>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!transferTo} className="gap-1.5 shrink-0">
                    <ArrowLeftRight className="h-3.5 w-3.5" />Transfer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-sm">
                  <DialogX />
                  <AlertDialogHeader>
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                      <ArrowLeftRight className="h-5 w-5 text-primary" />
                    </div>
                    <AlertDialogTitle className="text-center">Transfer Ownership?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="text-center">
                        <span className="block font-medium text-foreground">You will become a regular member.</span>
                        <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">
                          The new owner will have full control of the household. This can only be undone if the new owner transfers back.
                        </span>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
                    <AlertDialogAction className="w-full" onClick={() => transferMutation.mutate(transferTo)}>Transfer Ownership</AlertDialogAction>
                    <AlertDialogCancel className="w-full mt-0">Cancel</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2">
          <TriangleAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="text-xs text-foreground/75 leading-relaxed">
              {isOwner && hasOtherMembers
                ? 'As the owner, you cannot leave while other members remain. Transfer ownership first.'
                : isOwner
                  ? 'You are the last member. Leaving will permanently delete the household and all its data.'
                  : 'Leaving removes your access to this household\'s recipe book, pantry and shopping list.'}
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={isOwner && hasOtherMembers}
                  className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40">
                  <DoorOpen className="h-3.5 w-3.5" />Leave Household
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-sm">
                <DialogX />
                <AlertDialogHeader>
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
                    <DoorOpen className="h-5 w-5 text-destructive" />
                  </div>
                  <AlertDialogTitle className="text-center">Leave {household.name}?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="text-center space-y-2 pt-1">
                      {isOwner
                        ? <><span className="block font-medium text-foreground">You are the last member.</span>
                            <span className="block text-xs text-muted-foreground leading-relaxed">Leaving will permanently delete this household and all its data. This cannot be undone.</span></>
                        : <><span className="block font-medium text-foreground">You will lose access to this household.</span>
                            <span className="block text-xs text-muted-foreground leading-relaxed">Recipes, pantry and shopping list remain for other members. You can join or create another household afterwards.</span></>
                      }
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
                  <AlertDialogAction className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => leaveMutation.mutate()}>
                    {isOwner ? 'Delete Household And Leave' : 'Leave Household'}
                  </AlertDialogAction>
                  <AlertDialogCancel className="w-full mt-0">Cancel</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <MemberProfileDialog member={selectedMember} householdName={household.name} meId={meId}
        open={selectedMember !== null} onClose={() => setSelectedMember(null)} />
    </div>
  );
}

// ─── Invite section ───────────────────────────────────────────────────────────

function InviteSection({ householdId }: { householdId: string }) {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: results, isFetching } = useQuery({
    queryKey: queryKeys.users.search(searchTerm),
    queryFn: () => api.get<SearchUser[]>(`/api/users/search?handle=${encodeURIComponent(searchTerm)}`),
    enabled: searchTerm.length >= 2,
  });

  const inviteMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/api/households/${householdId}/invites`, { userId }),
    onSuccess: () => toast.success('Invite Sent'),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could Not Send Invite'),
  });

  const handleInput = (val: string) => {
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSearchTerm(val.trim()), 400);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Invite A Member</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input className="h-9 pl-9 text-sm" placeholder="Search by @handle…"
          value={query} onChange={(e) => handleInput(e.target.value)} autoComplete="off" />
      </div>
      {isFetching && <p className="text-xs text-muted-foreground">Searching…</p>}
      {!isFetching && searchTerm.length >= 2 && results !== undefined && (
        results.length === 0
          ? <p className="text-xs text-muted-foreground">No users found.</p>
          : <div className="space-y-1.5">
              {results.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={u.image ?? undefined} />
                    <AvatarFallback className="text-xs font-semibold">{initials(u.name, u.handle ?? u.id)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{u.name ?? u.handle}</p>
                    {u.handle && <p className="text-xs text-muted-foreground">@{u.handle}</p>}
                    {u.householdName && <p className="text-xs text-muted-foreground/60">{u.householdName}</p>}
                  </div>
                  <Button size="sm" className="h-7 text-xs shrink-0 gap-1"
                    onClick={() => inviteMutation.mutate(u.id)} disabled={inviteMutation.isPending}>
                    <UserPlus className="h-3 w-3" />Invite
                  </Button>
                </div>
              ))}
            </div>
      )}
    </div>
  );
}

// ─── Member card ──────────────────────────────────────────────────────────────

function MemberCard({ member, onClick }: { member: Member; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-accent/50 group">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={member.image ?? undefined} />
        <AvatarFallback className="text-xs font-semibold">{initials(member.name, member.handle ?? member.userId)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{member.name ?? 'Unknown'}</p>
          {member.role === 'OWNER' && <Crown className="h-3 w-3 shrink-0 text-primary" />}
        </div>
        {member.handle && <p className="text-muted-foreground text-xs">@{member.handle}</p>}
      </div>
      <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0">View →</span>
    </button>
  );
}

// ─── Member profile dialog ────────────────────────────────────────────────────

function MemberProfileDialog({ member, householdName, meId, open, onClose }: {
  member: Member | null; householdName: string; meId: string; open: boolean; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isCurrentUser = member?.userId === meId;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.users.profile(member?.handle ?? ''),
    queryFn: () => api.get<MemberProfile>(`/api/users/${member!.handle}`),
    enabled: open && !!member?.handle,
  });

  const { data: ownPins, isLoading: pinsLoading } = useQuery({
    queryKey: queryKeys.recipeBook.pins(),
    queryFn: () => api.get<OwnPin[]>('/api/recipe-book/pins'),
    enabled: open && isCurrentUser && !member?.handle,
  });

  const requestRecipe = useMutation({
    mutationFn: ({ recipeId, ownerId }: { recipeId: string; ownerId: string }) =>
      api.post('/api/shares/request', { recipeId, ownerId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shares.sent() });
      toast.success('Recipe Requested');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Request Failed'),
  });

  if (!member) return null;

  const ini = initials(member.name, member.handle ?? member.userId);
  const isOwner = member.role === 'OWNER';

  const activePins: Pin[] = member.handle
    ? (profile?.pins ?? []).filter((p) => p.recipeId !== null)
    : (ownPins ?? [])
        .filter((p) => p.recipeId !== null)
        .map((p) => ({
          position: p.position, recipeId: p.recipeId,
          recipeTitle: p.recipeTitle, recipeDescription: p.recipeDescription,
          recipeImage: p.recipeImage, recipeRating: null,
        }));

  const isLoading = member.handle ? profileLoading : pinsLoading;

  const handlePinRequest = (pin: Pin) => {
    if (!pin.recipeId || isCurrentUser) return;
    requestRecipe.mutate({ recipeId: pin.recipeId, ownerId: member.userId });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="relative h-16 bg-muted/40 border-b shrink-0">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <div className="rounded-full p-1 bg-background shadow-md ring-4 ring-background">
              <Avatar className="h-14 w-14">
                <AvatarImage src={member.image ?? undefined} />
                <AvatarFallback className="text-xl font-bold">{ini}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        <div className="scrollbar-hide overflow-y-auto flex-1 pt-10 pb-5 px-5 space-y-4">
          <div className="text-center space-y-0.5">
            <p className="font-bold text-base">{member.name ?? 'Unknown'}</p>
            {member.handle && <p className="text-muted-foreground text-sm">@{member.handle}</p>}
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {isOwner && <Crown className="h-3 w-3 text-primary" />}
              <span className="text-xs text-muted-foreground">
                {isOwner ? 'Owner of' : 'Member of'}{' '}
                <span className="font-medium text-foreground">{householdName}</span>
              </span>
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
            </div>
          )}

          {member.handle && profile && (
            profile.bio
              ? <div className="rounded-xl bg-muted/50 border border-border/40 px-3 py-2.5">
                  <p className="text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
                </div>
              : <p className="text-center text-xs text-muted-foreground italic">No bio yet.</p>
          )}

          {isCurrentUser && !member.handle && !isLoading && (
            <p className="text-center text-xs text-muted-foreground italic">Set a handle in Settings to show a public profile.</p>
          )}

          {!isLoading && activePins.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Pinned Recipes</p>
              {!isCurrentUser && (
                <p className="text-xs text-muted-foreground">Tap a recipe to request it from {member.name?.split(' ')[0] ?? 'them'}.</p>
              )}
              <div className="space-y-2.5">
                {activePins.map((pin) => (
                  <PinCard key={pin.position} pin={pin}
                    onRequest={!isCurrentUser ? () => handlePinRequest(pin) : undefined}
                    requesting={requestRecipe.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {!isLoading && !profile && !!member.handle && (
            <p className="text-center text-xs text-muted-foreground">Profile unavailable.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pin card (public view) ───────────────────────────────────────────────────

function PinCard({ pin, onRequest, requesting }: {
  pin: Pin;
  onRequest?: () => void;
  requesting?: boolean;
}) {
  return (
    <div className={cn(
      'relative flex items-center gap-3 rounded-xl border bg-card p-2.5',
      onRequest && 'cursor-pointer hover:bg-accent/40 transition-colors group',
    )} onClick={onRequest}>
      <span className="absolute -top-2.5 -left-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm">
        {pin.position}
      </span>
      {pin.recipeImage
        ? <img src={pin.recipeImage} alt={pin.recipeTitle ?? ''} className="h-14 w-14 rounded-lg object-cover shrink-0" />
        : <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <UtensilsCrossed className="h-5 w-5 text-muted-foreground/40" />
          </div>
      }
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-semibold truncate">{pin.recipeTitle}</p>
        {pin.recipeDescription && (
          <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">{pin.recipeDescription}</p>
        )}
        <StarRating rating={pin.recipeRating} />
      </div>
      {onRequest && (
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {requesting
            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
            : <Send className="h-4 w-4 text-primary" />
          }
        </div>
      )}
    </div>
  );
}

// ─── Notifications tab ────────────────────────────────────────────────────────

function NotificationsTab({ household }: {
  household: { id: string; name: string; role: 'OWNER' | 'USER' } | null;
}) {
  return (
    <div className="p-5">
      <Tabs defaultValue="household">
        <TabsList className="w-full h-9 mb-4 rounded-xl bg-muted/50 border border-border/60 p-0.5">
          <TabsTrigger value="household" className="flex-1 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Household</TabsTrigger>
          <TabsTrigger value="sharing" className="flex-1 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Recipe Sharing</TabsTrigger>
        </TabsList>
        <TabsContent value="household" className="mt-0">
          <HouseholdNotifications household={household} />
        </TabsContent>
        <TabsContent value="sharing" className="mt-0">
          <SharesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Household notifications ──────────────────────────────────────────────────

function HouseholdNotifications({ household }: {
  household: { id: string; name: string; role: 'OWNER' | 'USER' } | null;
}) {
  const queryClient = useQueryClient();

  const { data: pending, isLoading } = useQuery({
    queryKey: queryKeys.household.pending(),
    queryFn: () => api.get<PendingResponse>('/api/households/pending'),
  });

  const { data: pendingSent, isLoading: sentLoading } = useQuery({
    queryKey: queryKeys.household.pendingSent(),
    queryFn: () => api.get<PendingSentResponse>('/api/households/pending/sent'),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/households/join-requests/${id}/accept`),
    onSuccess: () => {
      if (!household) { localStorage.removeItem('householdSkipped'); window.location.href = '/'; }
      else {
        void queryClient.invalidateQueries({ queryKey: queryKeys.household.pending() });
        toast.success('Request Accepted');
      }
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/households/join-requests/${id}/decline`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.household.pending() });
      toast.success('Declined');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const inboundItems = [...(pending?.invites ?? []), ...(pending?.requests ?? [])];
  const outboundRequests = pendingSent?.sentRequests ?? [];
  const outboundInvites = pendingSent?.sentInvites ?? [];
  const hasOutbound = outboundRequests.length > 0 || outboundInvites.length > 0;

  return (
    <Tabs defaultValue="inbound">
      <TabsList className="w-full h-8 mb-4 rounded-lg bg-muted/40 border border-border/50 p-0.5">
        <TabsTrigger value="inbound" className="flex-1 text-[11px] h-7 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
          Inbound{inboundItems.length > 0 && <span className="ml-1 text-[9px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{inboundItems.length}</span>}
        </TabsTrigger>
        <TabsTrigger value="outbound" className="flex-1 text-[11px] h-7 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
          Outbound
        </TabsTrigger>
      </TabsList>

      <TabsContent value="inbound" className="mt-0 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground py-2">Loading…</p>}
        {!isLoading && inboundItems.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No pending invites or requests.</p>
        )}
        {inboundItems.map((item) => (
          <div key={item.id} className="rounded-xl border border-border/60 bg-card/80 p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {item.fromImage && (
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={item.fromImage} />
                    <AvatarFallback className="text-[10px]">{initials(item.fromName, item.fromHandle ?? '?')}</AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {item.type === 'INVITE' ? `Invite To ${item.householdName}` : `${item.fromName ?? item.fromHandle ?? 'Someone'} Wants To Join`}
                  </p>
                  <p className="text-muted-foreground truncate text-xs mt-0.5">
                    {item.type === 'INVITE' ? `From ${item.fromName ?? item.fromHandle ?? 'someone'}` : item.householdName}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px] border-border/60">
                {item.type === 'INVITE' ? 'Invite' : 'Request'}
              </Badge>
            </div>
            {(item.type === 'INVITE' || (item.type === 'REQUEST' && household?.role === 'OWNER')) && (
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-8" onClick={() => acceptMutation.mutate(item.id)} disabled={acceptMutation.isPending}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Accept
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 border-border/60" onClick={() => declineMutation.mutate(item.id)} disabled={declineMutation.isPending}>
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />Decline
                </Button>
              </div>
            )}
          </div>
        ))}
      </TabsContent>

      <TabsContent value="outbound" className="mt-0 space-y-2">
        {sentLoading && <p className="text-sm text-muted-foreground py-2">Loading…</p>}
        {!sentLoading && !hasOutbound && (
          <p className="text-sm text-muted-foreground py-4 text-center">No outbound invites or requests.</p>
        )}
        {outboundRequests.map((req) => (
          <div key={req.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/80 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">Request To Join {req.householdName}</p>
              <p className="text-xs text-muted-foreground">Waiting for response</p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0 border-border/60">Pending</Badge>
          </div>
        ))}
        {outboundInvites.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/80 p-3">
            <div className="flex items-center gap-2 min-w-0">
              {inv.inviteeImage && (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={inv.inviteeImage} />
                  <AvatarFallback className="text-[10px]">{initials(inv.inviteeName, inv.inviteeHandle ?? '?')}</AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">Invited {inv.inviteeName ?? inv.inviteeHandle ?? 'User'}</p>
                <p className="text-xs text-muted-foreground">To {inv.householdName}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0 border-border/60">Pending</Badge>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}

// ─── Shares section ───────────────────────────────────────────────────────────

function SharesSection() {
  const queryClient = useQueryClient();
  const [renameShare, setRenameShare] = useState<{ id: string; title: string; mode: 'accept' | 'recopy' } | null>(null);
  const [customTitle, setCustomTitle] = useState('');

  const { data: received = [], isLoading: loadingReceived } = useQuery({
    queryKey: queryKeys.shares.received(),
    queryFn: () => api.get<ShareItem[]>('/api/shares/received'),
  });

  const { data: sent = [], isLoading: loadingSent } = useQuery({
    queryKey: queryKeys.shares.sent(),
    queryFn: () => api.get<SentShareItem[]>('/api/shares/sent'),
  });

  const invalidateShares = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.shares.received() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.shares.sent() });
  };

  const acceptMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title?: string }) =>
      title
        ? api.post(`/api/shares/${id}/accept-with-name`, { title })
        : api.post(`/api/shares/${id}/accept`),
    onSuccess: () => { toast.success('Recipe Added To Your Book'); invalidateShares(); setRenameShare(null); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/shares/${id}/reject`),
    onSuccess: () => { toast.success('Share Declined'); invalidateShares(); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const fulfillMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/shares/${id}/fulfill-request`),
    onSuccess: () => { toast.success('Recipe Shared'); invalidateShares(); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const declineRequestMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/shares/${id}/decline-request`),
    onSuccess: () => { toast.success('Request Declined'); invalidateShares(); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const recopyMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title?: string }) =>
      title
        ? api.post(`/api/shares/${id}/recopy-with-name`, { title })
        : api.post(`/api/shares/${id}/recopy`),
    onSuccess: () => { toast.success('Recipe Re-Added To Your Book'); invalidateShares(); setRenameShare(null); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const cancelRequestMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/shares/${id}/cancel-request`),
    onSuccess: () => { toast.success('Request Cancelled'); invalidateShares(); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const openRename = (s: ShareItem, mode: 'accept' | 'recopy') => {
    setCustomTitle(s.recipeTitle ?? '');
    setRenameShare({ id: s.id, title: s.recipeTitle ?? '', mode });
  };

  const confirmRename = () => {
    if (!renameShare) return;
    const title = customTitle.trim() || undefined;
    if (renameShare.mode === 'accept') acceptMutation.mutate({ id: renameShare.id, title });
    else recopyMutation.mutate({ id: renameShare.id, title });
  };

  const pendingShares = received.filter((s) => s.status === 'PENDING');
  const recipeRequests = received.filter((s) => s.status === 'REQUESTED');
  const pastReceived = received.filter((s) => s.status !== 'PENDING' && s.status !== 'REQUESTED');
  const inboundCount = pendingShares.length + recipeRequests.length;

  const pendingRequests = sent.filter((s) => s.status === 'REQUESTED');
  const pendingSentOther = sent.filter((s) => s.status === 'PENDING');
  const pastSent = sent.filter((s) => s.status !== 'REQUESTED' && s.status !== 'PENDING');

  return (
    <>
      {/* Rename / custom title modal */}
      <Dialog open={!!renameShare} onOpenChange={(o) => !o && setRenameShare(null)}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-sm">
          <DialogHeader>
            <DialogTitle>{renameShare?.mode === 'accept' ? 'Add To Recipe Book' : 'Re-Add To Recipe Book'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Give this recipe a custom name, or keep the original.</p>
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={renameShare?.title ?? 'Recipe name…'}
              maxLength={255}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRenameShare(null)}>Cancel</Button>
              <Button className="flex-1"
                disabled={acceptMutation.isPending || recopyMutation.isPending}
                onClick={confirmRename}>
                {acceptMutation.isPending || recopyMutation.isPending ? 'Saving…' : 'Add To Book'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="inbound">
        <TabsList className="w-full h-8 mb-4 rounded-lg bg-muted/40 border border-border/50 p-0.5">
          <TabsTrigger value="inbound" className="flex-1 text-[11px] h-7 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Inbound{inboundCount > 0 && <span className="ml-1 text-[9px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{inboundCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="outbound" className="flex-1 text-[11px] h-7 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Outbound
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbound" className="mt-0 space-y-2">
          {loadingReceived && <p className="text-sm text-muted-foreground py-2">Loading…</p>}

          {!loadingReceived && inboundCount === 0 && pastReceived.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No sharing activity yet.</p>
          )}

          {recipeRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Requests For Your Recipes</p>
              {recipeRequests.map((s) => (
                <div key={s.id} className="rounded-xl border border-border/60 bg-card/80 p-3 space-y-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.fromUserImage && (
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={s.fromUserImage} />
                        <AvatarFallback className="text-[10px]">{initials(s.fromUserName, s.fromUserHandle ?? '?')}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        <span className="font-semibold">{s.fromUserName ?? s.fromUserHandle ?? 'Someone'}</span> wants{' '}
                        <span className="font-semibold">{s.recipeTitle ?? 'a recipe'}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px] border-border/60">
                      <BookOpen className="mr-1 h-2.5 w-2.5" />Request
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8" onClick={() => fulfillMutation.mutate(s.id)} disabled={fulfillMutation.isPending}>
                      <Send className="mr-1.5 h-3.5 w-3.5" />Share With Them
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 border-border/60" onClick={() => declineRequestMutation.mutate(s.id)} disabled={declineRequestMutation.isPending}>
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingShares.length > 0 && (
            <div className="space-y-2">
              {recipeRequests.length > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Shared With You</p>
              )}
              {pendingShares.map((s) => (
                <div key={s.id} className="rounded-xl border border-border/60 bg-card/80 p-3 space-y-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.fromUserImage && (
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={s.fromUserImage} />
                        <AvatarFallback className="text-[10px]">{initials(s.fromUserName, s.fromUserHandle ?? '?')}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.recipeTitle ?? 'Untitled Recipe'}</p>
                      <p className="text-xs text-muted-foreground">From {s.fromUserName ?? 'someone'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8" onClick={() => openRename(s, 'accept')} disabled={acceptMutation.isPending}>
                      Add To My Book
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 border-border/60" onClick={() => rejectMutation.mutate(s.id)} disabled={rejectMutation.isPending}>Decline</Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pastReceived.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {(pendingShares.length > 0 || recipeRequests.length > 0) && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">History</p>
              )}
              {pastReceived.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.recipeTitle ?? 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground">From {s.fromUserName ?? 'someone'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.status === 'ACCEPTED' && s.copiedRecipeId && (
                      <Badge variant="default" className="text-[10px]">In Book</Badge>
                    )}
                    {s.status === 'ACCEPTED' && !s.copiedRecipeId && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-border/60"
                        onClick={() => openRename(s, 'recopy')} disabled={recopyMutation.isPending}>
                        Re-Add
                      </Button>
                    )}
                    {s.status !== 'ACCEPTED' && (
                      <Badge variant="outline" className="text-[10px] border-border/60">{s.status}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="outbound" className="mt-0 space-y-2">
          {loadingSent && <p className="text-sm text-muted-foreground py-2">Loading…</p>}

          {!loadingSent && sent.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No outbound shares or requests.</p>
          )}

          {/* Pending recipe requests I sent — with Cancel */}
          {pendingRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recipe Requests</p>
              {pendingRequests.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/80 px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.toUserImage && (
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={s.toUserImage} />
                        <AvatarFallback className="text-[10px]">{initials(s.toUserName, s.toUserHandle ?? '?')}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.recipeTitle ?? 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground">Requested from {s.toUserName ?? 'someone'}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline"
                    className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => cancelRequestMutation.mutate(s.id)} disabled={cancelRequestMutation.isPending}>
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Pending shares I sent (awaiting recipient acceptance) */}
          {pendingSentOther.length > 0 && (
            <div className="space-y-1.5">
              {pendingRequests.length > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Shares Awaiting Acceptance</p>
              )}
              {pendingSentOther.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/80 px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.toUserImage && (
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={s.toUserImage} />
                        <AvatarFallback className="text-[10px]">{initials(s.toUserName, s.toUserHandle ?? '?')}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.recipeTitle ?? 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground">Shared with {s.toUserName ?? 'someone'}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 border-border/60">Pending</Badge>
                </div>
              ))}
            </div>
          )}

          {pastSent.length > 0 && (
            <div className="space-y-1.5">
              {(pendingRequests.length > 0 || pendingSentOther.length > 0) && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-2">History</p>
              )}
              {pastSent.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.recipeTitle ?? 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground">To {s.toUserName ?? 'someone'}</p>
                  </div>
                  <Badge variant={s.status === 'ACCEPTED' ? 'default' : 'outline'} className="text-[10px] shrink-0 border-border/60">{s.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
