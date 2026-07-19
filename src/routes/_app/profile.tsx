import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LogOut, Trash2, Camera, Sun, Moon, CheckCircle2, XCircle,
  DoorOpen, ArrowLeftRight, Mail, Crown, Home, TriangleAlert,
  Star, UtensilsCrossed, X, UserPlus, Search, ChevronUp, ChevronDown,
  Plus, Globe, Lock, Send, BookOpen, Eye, Copy, Users,
  ChevronLeft, ChevronRight, Scale, ChefHat, Maximize2,
} from 'lucide-react';
import { authClient } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useMe } from '@/hooks/useMe';
import { useHousehold } from '@/hooks/useHousehold';
import { useMeasureSystem } from '@/hooks/useMeasureSystem';
import type { MeasureSystem } from '@/hooks/useMeasureSystem';
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
  Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
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
  bio: string | null; image: string | null; isPublic: boolean; pins: Pin[];
}

interface SearchUser {
  id: string; name: string | null; handle: string | null;
  image: string | null; householdId: string | null; householdName: string | null;
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
  recipeDescription: string | null; recipeImage: string | null;
  fromUserId: string; fromUserName: string | null; fromUserHandle: string | null; fromUserImage: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REQUESTED';
  copiedRecipeId: string | null; createdAt: string; updatedAt: string;
}

interface SentShareItem {
  id: string; recipeId: string | null; recipeTitle: string | null;
  recipeDescription: string | null; recipeImage: string | null;
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
  const rounded = Math.round(rating.avg * 2) / 2;
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
      <span className="text-[10px] text-muted-foreground">({rating.count})</span>
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

function DialogX() {
  return (
    <AlertDialogCancel className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full bg-background/90 border border-border/60 shadow-md text-foreground hover:bg-muted transition-colors backdrop-blur-sm p-0 flex items-center justify-center">
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
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

  const [seenNotifIds, setSeenNotifIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem('seenNotifIds') ?? '[]') as string[]); }
    catch { return new Set(); }
  });

  const markNotifsSeen = useCallback((ids: string[]) => {
    setSeenNotifIds((prev) => {
      const next = new Set([...prev, ...ids]);
      sessionStorage.setItem('seenNotifIds', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const notifCount =
    ((householdPending?.invites ?? []).filter((i) => !seenNotifIds.has(i.id)).length +
     (householdPending?.requests ?? []).filter((r) => !seenNotifIds.has(r.id)).length) +
    (sharesReceived?.filter((s) => (s.status === 'PENDING' || s.status === 'REQUESTED') && !seenNotifIds.has(s.id)).length ?? 0);

  if (meLoading || !me) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="border-primary/30 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-4 pb-24 pt-6">
      <div className="w-full max-w-md sm:max-w-xl lg:max-w-2xl xl:max-w-3xl">
        <Tabs defaultValue="settings">
          <div className="rounded-t-2xl border border-b-0 overflow-hidden">
            <TabsList className="w-full h-12 rounded-none bg-card border-b p-0 gap-0">
              {(['settings', 'household', 'notifications'] as const).map((tab) => (
                <TabsTrigger key={tab} value={tab}
                  className="flex-1 h-full rounded-none capitalize text-xs sm:text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=inactive]:text-muted-foreground">
                  {tab === 'notifications' ? (
                    <span className="inline-flex items-center gap-1.5">
                      Notifications
                      {notifCount > 0 && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-1 leading-none">
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
              <NotificationsTab household={household} seenNotifIds={seenNotifIds} onMarkSeen={markNotifsSeen} />
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
  const [measureSystem, setMeasureSystemState] = useMeasureSystem();

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

  const handleMeasureChange = (s: MeasureSystem) => setMeasureSystemState(s);

  const isDark = resolvedTheme === 'dark';
  const firstNameValue = profileForm.watch('firstName') ?? '';
  const lastNameValue = profileForm.watch('lastName') ?? '';
  const handleValue = profileForm.watch('handle') ?? '';
  const bioValue = profileForm.watch('bio') ?? '';

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
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs">First Name</FormLabel>
                    <span className={cn('text-[10px]', firstNameValue.length >= 50 ? 'text-destructive' : 'text-muted-foreground')}>{firstNameValue.length}/50</span>
                  </div>
                  <FormControl><Input className="h-9" maxLength={50} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={profileForm.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs">Last Name</FormLabel>
                    <span className={cn('text-[10px]', lastNameValue.length >= 50 ? 'text-destructive' : 'text-muted-foreground')}>{lastNameValue.length}/50</span>
                  </div>
                  <FormControl><Input className="h-9" maxLength={50} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={profileForm.control} name="handle" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-xs">Handle</FormLabel>
                  <span className={cn('text-[10px]', handleValue.length >= 40 ? 'text-destructive' : 'text-muted-foreground')}>{handleValue.length}/40</span>
                </div>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                    <Input className="h-9 pl-7" placeholder="yourhandle" autoComplete="off" maxLength={40} {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={profileForm.control} name="bio" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-xs">Bio</FormLabel>
                  <span className={cn('text-[10px]', bioValue.length >= 200 ? 'text-destructive' : 'text-muted-foreground')}>
                    {bioValue.length}/200
                  </span>
                </div>
                <FormControl>
                  <Textarea placeholder="A few words about yourself…" className="resize-none text-sm" rows={3} maxLength={200} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="pt-1">
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
            <form onSubmit={emailForm.handleSubmit((v) => changeEmail.mutate(v.newEmail))} className="flex items-start gap-2">
              <FormField control={emailForm.control} name="newEmail" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input className="h-9 text-sm" type="email" placeholder="New email address" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" size="sm" className="h-9 shrink-0" disabled={changeEmail.isPending}>
                Update
              </Button>
            </form>
          </Form>
        )}
      </div>

      {/* ── Advanced Settings ── */}
      <div className="p-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Advanced Settings</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground">Theme</p>
            <div className="relative flex h-10 w-full items-center rounded-full border bg-muted/60 p-1">
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
            <p className="text-xs text-muted-foreground leading-relaxed">Change app's theme colour scheme.</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground">Visibility</p>
            <div className="relative flex h-10 w-full items-center rounded-full border bg-muted/60 p-1">
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
              {me.isPublic ? 'Visible to the community.' : 'Hidden from search.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground">Units</p>
            <div className="relative flex h-10 w-full items-center rounded-full border bg-muted/60 p-1">
              <span className={cn(
                'pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-background shadow-sm transition-transform duration-300 ease-in-out',
                measureSystem === 'imperial' && 'translate-x-[calc(100%+4px)]',
              )} />
              <button type="button" onClick={() => handleMeasureChange('metric')}
                className={cn('relative z-10 flex flex-1 items-center justify-center gap-1.5 text-xs font-medium transition-colors duration-150',
                  measureSystem === 'metric' ? 'text-primary' : 'text-muted-foreground')}>
                <Scale className="h-3.5 w-3.5" />Metric
              </button>
              <button type="button" onClick={() => handleMeasureChange('imperial')}
                className={cn('relative z-10 flex flex-1 items-center justify-center gap-1.5 text-xs font-medium transition-colors duration-150',
                  measureSystem === 'imperial' ? 'text-primary' : 'text-muted-foreground')}>
                <Scale className="h-3.5 w-3.5" />Imperial
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">Default unit system for recipes.</p>
          </div>
        </div>
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
  const [viewSlot, setViewSlot] = useState<PinSlot | null>(null);

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
        <p className="text-xs text-muted-foreground mt-0.5">Up to 5 pinned recipes appear on your public profile.</p>
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
              onView={() => setViewSlot(slot)}
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

      <PinViewModal
        slot={viewSlot}
        open={!!viewSlot}
        onClose={() => setViewSlot(null)}
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

function FilledPinSlot({ slot, position, onReplace, onRemove, onMoveUp, onMoveDown, onView, canMoveUp, canMoveDown, disabled }: {
  slot: NonNullable<PinSlot>; position: number;
  onReplace: () => void; onRemove: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
  onView: () => void;
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
          <p className="text-xs text-muted-foreground line-clamp-1">{slot.recipeDescription}</p>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button type="button" onClick={onView}
          className="h-6 px-1.5 text-[10px] font-medium rounded hover:bg-muted transition-colors text-primary hover:text-primary/80">
          View
        </button>
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

function roundQty(n: number): string {
  if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
  return n < 10 ? n.toFixed(1) : Math.round(n).toString();
}

function scaleQty(qty: string | null, base: number, target: number): string | null {
  if (!qty) return null;
  const n = parseFloat(qty);
  if (isNaN(n)) return qty;
  return roundQty((n * target) / base);
}

function convertQty(qty: string | null, unit: string | null, system: MeasureSystem) {
  if (!qty || !unit) return { qty: qty ?? '', unit: unit ?? '' };
  const n = parseFloat(qty);
  if (isNaN(n)) return { qty, unit };
  if (system === 'imperial') {
    if (unit === 'g')  return { qty: roundQty(n * 0.03527), unit: 'oz' };
    if (unit === 'kg') return { qty: roundQty(n * 2.20462), unit: 'lb' };
    if (unit === 'ml') return { qty: roundQty(n * 0.00422675), unit: 'cups' };
    if (unit === 'L')  return { qty: roundQty(n * 4.22675), unit: 'cups' };
    if (unit === '°C') return { qty: roundQty(n * 9 / 5 + 32), unit: '°F' };
  } else {
    if (unit === 'oz')   return { qty: roundQty(n * 28.3495), unit: 'g' };
    if (unit === 'lb')   return { qty: roundQty(n * 453.592), unit: 'g' };
    if (unit === 'cups') return { qty: roundQty(n * 236.588), unit: 'ml' };
    if (unit === '°F')   return { qty: roundQty((n - 32) * 5 / 9), unit: '°C' };
  }
  return { qty, unit };
}

function convertStepText(step: string, system: MeasureSystem): string {
  return step
    .replace(/(\d+(?:\.\d+)?)\s*°\s*([CcFf])\b/g, (_, num, unit) => {
      const n = parseFloat(num);
      const u = unit.toUpperCase() as 'C' | 'F';
      if (system === 'imperial' && u === 'C') return `${roundQty(n * 9 / 5 + 32)}°F`;
      if (system === 'metric' && u === 'F') return `${roundQty((n - 32) * 5 / 9)}°C`;
      return `${num}°${u}`;
    })
    .replace(/(\d+(?:\.\d+)?)\s+degrees?\s+(celsius|fahrenheit|centigrade|[CF])\b/gi, (_, num, unit) => {
      const n = parseFloat(num);
      const u = unit.toLowerCase();
      const isC = u === 'c' || u === 'celsius' || u === 'centigrade';
      const isF = u === 'f' || u === 'fahrenheit';
      if (!isC && !isF) return _;
      if (system === 'imperial' && isC) return `${roundQty(n * 9 / 5 + 32)}°F`;
      if (system === 'metric' && isF) return `${roundQty((n - 32) * 5 / 9)}°C`;
      return `${num}°${isC ? 'C' : 'F'}`;
    });
}

function PinViewModal({ slot, open, onClose }: { slot: PinSlot; open: boolean; onClose: () => void }) {
  const [servings, setServings] = useState<number | null>(null);
  const [system, setSystem] = useMeasureSystem();
  const [imageIdx, setImageIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const { data: recipe } = useQuery({
    queryKey: ['recipe-book', 'recipe', slot?.recipeId ?? ''],
    queryFn: () => api.get<RecipeDetail>(`/api/recipe-book/recipes/${slot!.recipeId}`),
    enabled: open && !!slot?.recipeId,
  });

  useEffect(() => {
    if (recipe) setServings(recipe.baseServings);
  }, [recipe]);

  useEffect(() => {
    if (!open) { setImageIdx(0); setServings(null); }
  }, [open]);

  if (!slot) return null;

  const effectiveServings = servings ?? recipe?.baseServings ?? 4;
  const base = recipe?.baseServings ?? 1;
  const images = recipe?.images ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-lg sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]" hideClose>
        <DialogClose className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 border border-border/60 shadow-md text-foreground hover:bg-muted transition-colors backdrop-blur-sm">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        {/* Image carousel */}
        {images.length > 0 && (
          <div className="relative shrink-0 bg-muted">
            <img src={images[imageIdx]?.url} alt={slot.recipeTitle} className="w-full h-48 object-cover" />
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
            {recipe.description && <p className="text-sm text-foreground/80 leading-relaxed">{recipe.description}</p>}
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

        {!recipe && (
          <div className="flex justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
          </div>
        )}

        {recipe && (
          <div className="scrollbar-hide overflow-y-auto flex-1 px-4 py-4 space-y-5">
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

function RecipeSelectModal({ open, onClose, onSelect, excludeIds }: {
  open: boolean; onClose: () => void;
  onSelect: (recipe: RecipeItem) => void; excludeIds: string[];
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

      <div className="p-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Members</p>
        {membersLoading
          ? <div className="flex justify-center py-4"><div className="border-primary/30 h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" /></div>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {owner && <MemberCard member={owner} onClick={() => setSelectedMember(owner)} />}
              {otherMembers.map((m) => <MemberCard key={m.userId} member={m} onClick={() => setSelectedMember(m)} />)}
            </div>
          )
        }
      </div>

      <div className="p-5">
        <InviteSection householdId={household.id} meId={meId} />
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
                  <option key={m.userId} value={m.userId}>{m.handle ? '@' + m.handle : m.name ?? m.userId}</option>
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
            <p className="text-xs font-semibold text-destructive">Leave Household</p>
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

function InviteSection({ householdId, meId }: { householdId: string; meId: string }) {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [profileUser, setProfileUser] = useState<SearchUser | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
      <div className="relative max-w-xs sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input className="h-9 pl-9 text-sm" placeholder="Search by @handle…"
          value={query} onChange={(e) => handleInput(e.target.value)} autoComplete="off" />
      </div>
      {isFetching && <p className="text-xs text-muted-foreground">Searching…</p>}
      {!isFetching && searchTerm.length >= 2 && results !== undefined && (
        results.length === 0
          ? <p className="text-xs text-muted-foreground">No users found.</p>
          : <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {results.map((u) => {
                const alreadyMember = u.householdId === householdId;
                return (
                  <div key={u.id}
                    className="flex items-center gap-3 rounded-xl border p-2.5 cursor-pointer hover:bg-accent/40 transition-colors"
                    onClick={() => setProfileUser(u)}>
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={u.image ?? undefined} />
                      <AvatarFallback className="text-xs font-semibold">{initials(u.name, u.handle ?? u.id)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{u.handle ? `@${u.handle}` : u.name ?? 'User'}</p>
                      {u.householdName && <p className="text-xs text-muted-foreground/60">{u.householdName}</p>}
                    </div>
                    {alreadyMember ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground shrink-0">
                        <Users className="h-3 w-3" />Household
                      </span>
                    ) : (
                      <Button size="sm" className="h-7 text-xs shrink-0 gap-1"
                        onClick={(e) => { e.stopPropagation(); inviteMutation.mutate(u.id); }}
                        disabled={inviteMutation.isPending}>
                        <UserPlus className="h-3 w-3" />Invite
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
      )}
      {profileUser && (
        <InviteUserProfileModal
          user={profileUser}
          meId={meId}
          isHousehold={profileUser.householdId === householdId}
          open={!!profileUser}
          onClose={() => setProfileUser(null)}
          onInvite={(userId) => { inviteMutation.mutate(userId); setProfileUser(null); }}
          inviting={inviteMutation.isPending}
        />
      )}
    </div>
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
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Request Failed'),
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

  if (!target) return null;
  const isOwnRecipe = target.ownerId === meId;
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
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><ChefHat className="h-3.5 w-3.5" />Servings</span>
                <span className="text-sm font-bold text-primary">{effectiveServings}</span>
              </div>
              <Slider min={1} max={20} step={1} value={[effectiveServings]} onValueChange={([v]) => setServings(v)} className="w-full" />
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
                        <li key={ing.id} className="flex items-baseline gap-2 text-sm list-none">
                          <span className="shrink-0 font-medium tabular-nums">
                            {converted.qty ? `${converted.qty}${converted.unit ? ` ${converted.unit}` : ''}` : ''}
                          </span>
                          <span className="text-foreground/85">{ing.name}</span>
                          {ing.note && <span className="text-muted-foreground text-xs">({ing.note})</span>}
                        </li>
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
                      <textarea
                        placeholder="Share your thoughts…"
                        className="w-full resize-none text-sm min-h-[72px] rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                        value={reviewComment}
                        maxLength={500}
                        onChange={(e) => setReviewComment(e.target.value.slice(0, 500))}
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setShowReviewForm(false)}>Cancel</Button>
                        <Button size="sm" className="flex-1 h-8" disabled={reviewRating === 0 || submitReview.isPending} onClick={() => submitReview.mutate()}>
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

        {!isOwnRecipe && !target.sameHousehold && (
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
              <BookOpen className="h-3.5 w-3.5" />{myReview ? 'Edit Review' : 'Rate & Review'}
            </Button>
          </div>
        )}
        {!isOwnRecipe && target.sameHousehold && (
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

function InviteUserProfileModal({ user: u, meId, isHousehold, open, onClose, onInvite, inviting }: {
  user: SearchUser; meId: string; isHousehold: boolean; open: boolean; onClose: () => void;
  onInvite: (userId: string) => void; inviting: boolean;
}) {
  const queryClient = useQueryClient();
  const [pinViewTarget, setPinViewTarget] = useState<PinViewTarget | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);

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

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.users.profile(u.handle ?? ''),
    queryFn: () => api.get<MemberProfile>(`/api/users/${u.handle}`),
    enabled: open && !!u.handle,
  });

  const activePins = (profile?.pins ?? []).filter((p) => p.recipeId !== null);
  const isPublic = profile?.isPublic ?? true;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-sm sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]" hideClose>
          <DialogClose className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 border border-border/60 shadow-md text-foreground hover:bg-muted transition-colors backdrop-blur-sm">
            <X className="h-4 w-4" /><span className="sr-only">Close</span>
          </DialogClose>
          <div className="relative h-16 bg-muted/40 border-b shrink-0">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
              <div className="rounded-full p-1 bg-background shadow-md ring-4 ring-background">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={u.image ?? undefined} />
                  <AvatarFallback className="text-xl font-bold">{initials(u.name, u.handle ?? u.id)}</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
          <div className="scrollbar-hide overflow-y-auto flex-1 px-5 pt-10 pb-5 space-y-4">
            <div className="text-center space-y-0.5">
              <p className="font-bold text-base">{u.name ?? 'Unknown'}</p>
              {u.handle && <p className="text-muted-foreground text-sm">@{u.handle}</p>}
              {u.householdName && <p className="text-xs text-muted-foreground mt-1">Member of <span className="font-medium">{u.householdName}</span></p>}
            </div>

            {profileLoading && (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
              </div>
            )}

            {!profileLoading && isPublic && profile?.bio && (
              <div className="rounded-xl bg-muted/50 border border-border/40 px-3 py-2.5">
                <p className="text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
              </div>
            )}
            {!profileLoading && isPublic && !profile?.bio && (
              <p className="text-center text-xs text-muted-foreground italic">No bio yet.</p>
            )}
            {!profileLoading && !isPublic && (
              <p className="text-center text-xs text-muted-foreground italic">This profile is private.</p>
            )}

            {!profileLoading && isPublic && activePins.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Pinned Recipes</p>
                <div className="space-y-2.5">
                  {activePins.map((pin) => (
                    <PinCard key={pin.position} pin={pin}
                      onView={u.handle ? () => setPinViewTarget({ recipeId: pin.recipeId!, recipeTitle: pin.recipeTitle, recipeDescription: pin.recipeDescription, recipeImage: pin.recipeImage, ownerHandle: u.handle!, ownerId: u.id, sameHousehold: isHousehold }) : undefined}
                      onRequest={!isHousehold && u.handle && u.id !== meId ? () => { setRequestingId(pin.recipeId!); pinRequestMutation.mutate({ recipeId: pin.recipeId!, ownerId: u.id }); } : undefined}
                      requesting={requestingId === pin.recipeId && pinRequestMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {isHousehold ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-muted/40 px-3 py-2.5">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">Already in your household</p>
              </div>
            ) : (
              <Button className="w-full gap-2" onClick={() => onInvite(u.id)} disabled={inviting}>
                <UserPlus className="h-4 w-4" />{inviting ? 'Sending…' : 'Invite To Household'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <PublicPinViewModal target={pinViewTarget} meId={meId} open={!!pinViewTarget} onClose={() => setPinViewTarget(null)} />
    </>
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
          <p className="truncate text-sm font-medium">{member.handle ? `@${member.handle}` : member.name ?? 'Unknown'}</p>
          {member.role === 'OWNER' && <Crown className="h-3 w-3 shrink-0 text-primary" />}
          <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0">View →</span>
    </button>
  );
}

// ─── Member profile dialog ────────────────────────────────────────────────────

function MemberProfileDialog({ member, householdName, meId, open, onClose }: {
  member: Member | null; householdName: string; meId: string; open: boolean; onClose: () => void;
}) {
  const isCurrentUser = member?.userId === meId;
  const [viewPin, setViewPin] = useState<PinSlot>(null);

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

  const handleViewPin = (pin: Pin) => {
    if (!pin.recipeId) return;
    setViewPin({
      recipeId: pin.recipeId,
      recipeTitle: pin.recipeTitle ?? 'Untitled',
      recipeDescription: pin.recipeDescription,
      recipeImage: pin.recipeImage,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-sm sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]" hideClose>
          <DialogClose className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 border border-border/60 shadow-md text-foreground hover:bg-muted transition-colors backdrop-blur-sm">
            <X className="h-4 w-4" /><span className="sr-only">Close</span>
          </DialogClose>
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
              <div className="space-y-3">
                <p className="text-sm font-semibold">Pinned Recipes</p>
                <div className="space-y-2.5">
                  {activePins.map((pin) => (
                    <PinCard key={pin.position} pin={pin}
                      onView={() => handleViewPin(pin)}
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
      <PinViewModal slot={viewPin} open={!!viewPin} onClose={() => setViewPin(null)} />
    </>
  );
}

// ─── Pin card (public view) ───────────────────────────────────────────────────

function PinCard({ pin, onView, onRequest, requesting }: {
  pin: Pin;
  onView?: () => void;
  onRequest?: () => void;
  requesting?: boolean;
}) {
  return (
    <div className="relative flex items-center gap-3 rounded-xl border bg-card p-2.5">
      <span className="absolute -top-2 -left-2 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow-sm leading-none">
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
      {(onView || onRequest) && (
        <div className="flex items-center gap-1.5 shrink-0">
          {onView && (
            <button type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              onClick={onView}>
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
          {onRequest && (
            <button type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              onClick={onRequest}
              disabled={requesting}>
              {requesting
                ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
                : <Send className="h-3.5 w-3.5" />
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Notifications tab ────────────────────────────────────────────────────────

function NotificationsTab({ household, seenNotifIds, onMarkSeen }: {
  household: { id: string; name: string; role: 'OWNER' | 'USER' } | null;
  seenNotifIds: Set<string>;
  onMarkSeen: (ids: string[]) => void;
}) {
  return (
    <div className="p-5">
      <Tabs defaultValue="household">
        <TabsList className="w-full h-9 mb-4 rounded-xl bg-muted/50 border border-border/60 p-0.5">
          <TabsTrigger value="household" className="flex-1 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Household</TabsTrigger>
          <TabsTrigger value="sharing" className="flex-1 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Recipe Sharing</TabsTrigger>
        </TabsList>
        <TabsContent value="household" className="mt-0">
          <HouseholdNotifications household={household} seenNotifIds={seenNotifIds} onMarkSeen={onMarkSeen} />
        </TabsContent>
        <TabsContent value="sharing" className="mt-0">
          <SharesSection seenNotifIds={seenNotifIds} onMarkSeen={onMarkSeen} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Household notifications ──────────────────────────────────────────────────

function HouseholdNotifications({ household, seenNotifIds, onMarkSeen }: {
  household: { id: string; name: string; role: 'OWNER' | 'USER' } | null;
  seenNotifIds: Set<string>;
  onMarkSeen: (ids: string[]) => void;
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
          Inbound{inboundItems.filter(i => !seenNotifIds.has(i.id)).length > 0 && <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none">{inboundItems.filter(i => !seenNotifIds.has(i.id)).length}</span>}
        </TabsTrigger>
        <TabsTrigger value="outbound" className="flex-1 text-[11px] h-7 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
          Outbound
        </TabsTrigger>
      </TabsList>

      <TabsContent value="inbound" className="mt-0 space-y-2">
        {inboundItems.length > 0 && inboundItems.some(i => !seenNotifIds.has(i.id)) && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
              onClick={() => onMarkSeen(inboundItems.map(i => i.id))}>
              Mark all as read
            </Button>
          </div>
        )}
        {isLoading && <p className="text-sm text-muted-foreground py-2">Loading…</p>}
        {!isLoading && inboundItems.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No pending invites or requests.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    {item.type === 'INVITE' ? `Invite To ${item.householdName}` : `${item.fromHandle ? '@' + item.fromHandle : item.fromName ?? 'Someone'} Wants To Join`}
                  </p>
                  <p className="text-muted-foreground truncate text-xs mt-0.5">
                    {item.type === 'INVITE' ? `From ${item.fromHandle ? '@' + item.fromHandle : item.fromName ?? 'someone'}` : item.householdName}
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
        </div>
      </TabsContent>

      <TabsContent value="outbound" className="mt-0 space-y-2">
        {sentLoading && <p className="text-sm text-muted-foreground py-2">Loading…</p>}
        {!sentLoading && !hasOutbound && (
          <p className="text-sm text-muted-foreground py-4 text-center">No outbound invites or requests.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ─── Paginated history helpers ────────────────────────────────────────────────

const HISTORY_PAGE = 8;

function CollapsibleHistory({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-1 hover:text-foreground transition-colors">
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')} />
        {title} ({count})
      </button>
      {open && children}
    </div>
  );
}

function PaginatedItems<T>({ items, renderItem }: { items: T[]; renderItem: (item: T, i: number) => React.ReactNode }) {
  const [visible, setVisible] = useState(HISTORY_PAGE);
  const remaining = items.length - visible;
  return (
    <div className="space-y-1.5">
      {items.slice(0, visible).map((item, i) => renderItem(item, i))}
      {remaining > 0 && (
        <button type="button"
          onClick={() => setVisible((v) => v + HISTORY_PAGE)}
          className="w-full text-center text-xs text-primary hover:text-primary/80 py-1 font-medium transition-colors">
          Show {Math.min(HISTORY_PAGE, remaining)} more
        </button>
      )}
    </div>
  );
}

// ─── Share recipe view modal ──────────────────────────────────────────────────

function ShareRecipeViewModal({ share, open, onClose, onCopy }: {
  share: ShareItem | null; open: boolean; onClose: () => void;
  onCopy: (s: ShareItem) => void;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [servings, setServings] = useState(4);
  const [system, setSystem] = useMeasureSystem();

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['share-recipe-detail', share?.copiedRecipeId],
    queryFn: () => api.get<RecipeDetail>(`/api/recipe-book/recipes/${share!.copiedRecipeId}`),
    enabled: open && !!share?.copiedRecipeId,
  });

  useEffect(() => {
    if (open) { setImgIdx(0); setLightboxIdx(null); }
  }, [open]);

  useEffect(() => {
    if (detail) setServings(detail.baseServings);
  }, [detail?.id]);

  if (!share) return null;

  const images = detail?.images.length
    ? [...detail.images].sort((a, b) => a.sortOrder - b.sortOrder)
    : share.recipeImage ? [{ url: share.recipeImage, sortOrder: 0 }] : [];
  const isInBook = !!share.copiedRecipeId;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]" hideClose>
        <DialogClose className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 border border-border/60 shadow-md text-foreground hover:bg-muted transition-colors backdrop-blur-sm">
          <X className="h-4 w-4" /><span className="sr-only">Close</span>
        </DialogClose>

        {images.length > 0 && (
          <div className="relative w-full h-44 shrink-0 bg-muted overflow-hidden">
            <img src={images[imgIdx].url} alt={share.recipeTitle ?? ''} className="w-full h-full object-cover" />
            <button type="button" onClick={() => setLightboxIdx(imgIdx)}
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-white text-[10px] font-medium hover:bg-black/70 transition-colors z-10">
              <Maximize2 className="h-3 w-3" />Expand
            </button>
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/80 flex items-center justify-center shadow backdrop-blur-sm hover:bg-background transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/80 flex items-center justify-center shadow backdrop-blur-sm hover:bg-background transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <button key={i} type="button" onClick={() => setImgIdx(i)}
                      className={cn('h-1.5 w-1.5 rounded-full transition-colors', i === imgIdx ? 'bg-white' : 'bg-white/50')} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-bold leading-tight">{share.recipeTitle ?? 'Untitled Recipe'}</h2>
              {isInBook && <Badge variant="default" className="text-[10px] shrink-0">In Book</Badge>}
            </div>
            {detail?.categoryName && (
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{detail.categoryName}</p>
            )}
            {share.recipeDescription && (
              <p className="text-sm text-foreground/75 leading-relaxed">{share.recipeDescription}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {share.fromUserImage && (
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage src={share.fromUserImage} />
                <AvatarFallback className="text-[10px]">{initials(share.fromUserName, share.fromUserHandle ?? '?')}</AvatarFallback>
              </Avatar>
            )}
            <p className="text-xs text-muted-foreground">
              From <span className="font-medium text-foreground">{share.fromUserName ?? share.fromUserHandle ?? 'someone'}</span>
            </p>
          </div>

          {detailLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">Loading recipe…</p>
          )}

          {detail && (
            <>
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <ChefHat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">Servings</span>
                    <span className="text-xs font-semibold">{servings}</span>
                  </div>
                  <div className="flex items-center rounded-full border p-0.5 bg-muted/30 shrink-0">
                    <button type="button" onClick={() => setSystem('metric')}
                      className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors font-medium',
                        system === 'metric' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                      Metric
                    </button>
                    <button type="button" onClick={() => setSystem('imperial')}
                      className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors font-medium',
                        system === 'imperial' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                      Imperial
                    </button>
                  </div>
                </div>
                <Slider
                  min={1} max={20} step={1}
                  value={[servings]}
                  onValueChange={([v]) => setServings(v)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredients</p>
                <ul className="space-y-1.5">
                  {[...detail.ingredients].sort((a, b) => a.sortOrder - b.sortOrder).map((ing) => {
                    const { qty, unit } = convertQty(
                      scaleQty(ing.quantity, detail.baseServings, servings),
                      ing.unit,
                      system
                    );
                    return (
                      <li key={ing.id} className="flex items-baseline gap-2 text-sm">
                        <span className="shrink-0 font-medium tabular-nums">
                          {qty ? `${qty}${unit ? ` ${unit}` : ''}` : ''}
                        </span>
                        <span className="text-foreground/85">{ing.name}</span>
                        {ing.note && <span className="text-muted-foreground text-xs">({ing.note})</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {detail.steps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Steps</p>
                  <ol className="space-y-3">
                    {detail.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5">{i + 1}</span>
                        <span className="text-foreground/85 leading-relaxed">{convertStepText(step, system)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}

          <Button className="w-full gap-2" size="sm" onClick={() => { onCopy(share); onClose(); }}>
            <Copy className="h-3.5 w-3.5" />Save a Copy
          </Button>
        </div>

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

// ─── Shares section ───────────────────────────────────────────────────────────

function SharesSection({ seenNotifIds, onMarkSeen }: {
  seenNotifIds: Set<string>;
  onMarkSeen: (ids: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const [renameShare, setRenameShare] = useState<{ id: string; title: string; mode: 'accept' | 'recopy' } | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [viewShare, setViewShare] = useState<ShareItem | null>(null);

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
            Inbound{[...pendingShares, ...recipeRequests].filter(s => !seenNotifIds.has(s.id)).length > 0 && <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none">{[...pendingShares, ...recipeRequests].filter(s => !seenNotifIds.has(s.id)).length}</span>}
          </TabsTrigger>
          <TabsTrigger value="outbound" className="flex-1 text-[11px] h-7 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Outbound
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbound" className="mt-0 space-y-2">
          {inboundCount > 0 && [...pendingShares, ...recipeRequests].some(s => !seenNotifIds.has(s.id)) && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                onClick={() => onMarkSeen([...pendingShares, ...recipeRequests].map(s => s.id))}>
                Mark all as read
              </Button>
            </div>
          )}
          {loadingReceived && <p className="text-sm text-muted-foreground py-2">Loading…</p>}

          {!loadingReceived && inboundCount === 0 && pastReceived.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No sharing activity yet.</p>
          )}

          {recipeRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Requests For Your Recipes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            </div>
          )}

          {pendingShares.length > 0 && (
            <div className="space-y-2">
              {recipeRequests.length > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Shared With You</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            </div>
          )}

          {pastReceived.length > 0 && (
            <div className="pt-1">
              <CollapsibleHistory title="History" count={pastReceived.length}>
                <PaginatedItems
                  items={pastReceived}
                  renderItem={(s) => (
                    <div key={s.id} className="rounded-2xl border bg-card overflow-hidden flex flex-col cursor-pointer" onClick={() => setViewShare(s)}>
                      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                        <Avatar className="h-9 w-9 shrink-0 ring-2 ring-border">
                          <AvatarImage src={s.fromUserImage ?? undefined} />
                          <AvatarFallback className="text-xs font-semibold">{initials(s.fromUserName, s.fromUserHandle ?? '?')}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{s.fromUserName ?? 'Unknown'}</p>
                          {s.fromUserHandle && <p className="text-xs text-muted-foreground">@{s.fromUserHandle}</p>}
                        </div>
                        {s.status === 'ACCEPTED' && s.copiedRecipeId
                          ? <Badge variant="default" className="text-[10px] shrink-0">In Book</Badge>
                          : <Badge variant="outline" className="text-[10px] border-border/60 shrink-0">{s.status}</Badge>
                        }
                      </div>
                      <div className="mx-3 mb-3 rounded-xl border bg-background/60 overflow-hidden">
                        {s.recipeImage && <img src={s.recipeImage} alt={s.recipeTitle ?? ''} className="w-full h-36 object-cover" />}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{s.recipeTitle ?? 'Untitled'}</p>
                            {s.recipeDescription && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{s.recipeDescription}</p>}
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setViewShare(s); }}
                            className="flex items-center gap-1 text-[11px] font-medium rounded-full border border-border/60 px-2.5 py-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground shrink-0">
                            <BookOpen className="h-3 w-3" />View
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                />
              </CollapsibleHistory>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            </div>
          )}

          {/* Pending shares I sent (awaiting recipient acceptance) */}
          {pendingSentOther.length > 0 && (
            <div className="space-y-1.5">
              {pendingRequests.length > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Shares Awaiting Acceptance</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            </div>
          )}

          {pastSent.length > 0 && (
            <div className="pt-1">
              <CollapsibleHistory title="History" count={pastSent.length}>
                <PaginatedItems
                  items={pastSent}
                  renderItem={(s) => (
                    <div key={s.id} className="rounded-2xl border bg-card overflow-hidden flex flex-col cursor-pointer" onClick={() => setViewShare(s as unknown as ShareItem)}>
                      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                        <Avatar className="h-9 w-9 shrink-0 ring-2 ring-border">
                          <AvatarImage src={s.toUserImage ?? undefined} />
                          <AvatarFallback className="text-xs font-semibold">{initials(s.toUserName, s.toUserHandle ?? '?')}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{s.toUserName ?? 'Unknown'}</p>
                          {s.toUserHandle && <p className="text-xs text-muted-foreground">@{s.toUserHandle}</p>}
                        </div>
                        <Badge variant={s.status === 'ACCEPTED' ? 'default' : 'outline'} className="text-[10px] shrink-0 border-border/60">
                          {s.status === 'ACCEPTED' ? 'In Their Book' : s.status}
                        </Badge>
                      </div>
                      <div className="mx-3 mb-3 rounded-xl border bg-background/60 overflow-hidden">
                        {s.recipeImage && <img src={s.recipeImage} alt={s.recipeTitle ?? ''} className="w-full h-36 object-cover" />}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{s.recipeTitle ?? 'Untitled'}</p>
                            {s.recipeDescription && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{s.recipeDescription}</p>}
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setViewShare(s as unknown as ShareItem); }}
                            className="flex items-center gap-1 text-[11px] font-medium rounded-full border border-border/60 px-2.5 py-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground shrink-0">
                            <BookOpen className="h-3 w-3" />View
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                />
              </CollapsibleHistory>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ShareRecipeViewModal
        share={viewShare}
        open={!!viewShare}
        onClose={() => setViewShare(null)}
        onCopy={(s) => openRename(s, 'recopy')}
      />
    </>
  );
}
