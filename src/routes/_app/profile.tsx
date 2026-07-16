import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useRef, useState } from 'react';
import {
  LogOut,
  Trash2,
  Camera,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  XCircle,
  DoorOpen,
  ArrowLeftRight,
  Mail,
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
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
});

// ─── Types ─────────────────────────────────────────────────────────────────

interface PendingItem {
  id: string;
  householdId: string;
  householdName: string;
  fromName: string | null;
  fromHandle: string | null;
  type: 'INVITE' | 'REQUEST';
}

interface PendingResponse {
  invites: PendingItem[];
  requests: PendingItem[];
}

interface Member {
  id: string;
  userId: string;
  name: string | null;
  handle: string | null;
  role: 'OWNER' | 'USER';
}

interface ShareItem {
  id: string;
  recipeTitle: string | null;
  fromUserId: string;
  toUserId: string;
  status: string;
  createdAt: string;
  fromUserName: string | null;
  toUserName: string | null;
  copiedRecipeId: string | null;
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(1, 'Required').max(50),
  lastName: z.string().min(1, 'Required').max(50),
  bio: z.string().max(200).optional(),
});

const emailSchema = z.object({
  newEmail: z.string().email('Enter a valid email'),
});

// ─── Main page ──────────────────────────────────────────────────────────────

function ProfilePage() {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { data: me, isLoading: meLoading } = useMe();
  const { household } = useHousehold();
  const fileRef = useRef<HTMLInputElement>(null);
  const [emailSent, setEmailSent] = useState(false);

  // ─── Profile form ──────────────────────────────────────────────────────
  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: standardSchemaResolver(profileSchema),
    values: {
      firstName: me?.firstName ?? '',
      lastName: me?.lastName ?? '',
      bio: me?.bio ?? '',
    },
  });

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: standardSchemaResolver(emailSchema),
    defaultValues: { newEmail: '' },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; bio?: string }) =>
      api.patch('/api/users/me', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.me() });
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Update failed'),
  });

  const uploadPictureMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('image', file);
      return api.postForm<{ image: string }>('/api/users/me/picture', fd);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.me() });
      toast.success('Profile picture updated');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Upload failed'),
  });

  const changeEmailMutation = useMutation({
    mutationFn: (newEmail: string) => api.post('/api/auth/change-email', { newEmail }),
    onSuccess: () => {
      setEmailSent(true);
      emailForm.reset();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Request failed'),
  });

  const handleThemeChange = (next: 'system' | 'light' | 'dark') => {
    setTheme(next);
    void api.patch('/api/users/me', { theme: next === 'system' ? null : next });
  };

  const handleLogout = async () => {
    localStorage.removeItem('householdSkipped');
    await authClient.signOut();
    window.location.href = '/sign-in';
  };

  const deleteAccountMutation = useMutation({
    mutationFn: () => api.post('/api/auth/delete-user', {}),
    onSuccess: () => {
      localStorage.removeItem('householdSkipped');
      window.location.href = '/sign-in';
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Delete failed'),
  });

  if (meLoading || !me) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="border-primary/30 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  const initials = [me.firstName, me.lastName]
    .filter(Boolean)
    .map((n) => n![0].toUpperCase())
    .join('') || me.email[0].toUpperCase();

  const currentTheme = theme === 'system' || !theme ? 'system' : theme;

  const isWaiting = !household && localStorage.getItem('householdSkipped') === 'true';

  return (
    <div className="px-4 pb-6 pt-10">
      {isWaiting && (
        <div className="mb-4 rounded-lg border bg-muted/50 p-4 text-center space-y-3">
          <div>
            <p className="text-sm font-medium">Waiting for a household invite</p>
            <p className="text-muted-foreground text-xs mt-1">
              Check the Notifications tab for pending invites, or set up your own household.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              localStorage.removeItem('householdSkipped');
              window.location.href = '/onboarding';
            }}
          >
            Set up a household
          </Button>
        </div>
      )}

      <Tabs defaultValue="profile">
        <TabsList className="mb-6 w-full">
          <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1">Notifications</TabsTrigger>
        </TabsList>

        {/* ══════════════════ PROFILE TAB ══════════════════ */}
        <TabsContent value="profile" className="space-y-6">

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={me.image ?? undefined} alt={me.name ?? me.email} />
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadPictureMutation.isPending}
                className="bg-primary text-primary-foreground absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full shadow"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            {me.handle && (
              <p className="text-muted-foreground text-sm">@{me.handle}</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPictureMutation.mutate(file);
                e.target.value = '';
              }}
            />
          </div>

          <Separator />

          {/* Edit name + bio */}
          <Form {...profileForm}>
            <form
              onSubmit={profileForm.handleSubmit((v) => updateProfileMutation.mutate(v))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={profileForm.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="A few words about yourself…"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </Form>

          <Separator />

          {/* Change email */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-muted-foreground text-sm">{me.email}</p>
            </div>
            {emailSent ? (
              <div className="bg-muted rounded-lg p-3 text-center text-sm">
                <Mail className="text-primary mx-auto mb-1 h-4 w-4" />
                Confirmation sent to your current email. Click the link to confirm.
              </div>
            ) : (
              <Form {...emailForm}>
                <form
                  onSubmit={emailForm.handleSubmit((v) => changeEmailMutation.mutate(v.newEmail))}
                  className="flex gap-2"
                >
                  <FormField
                    control={emailForm.control}
                    name="newEmail"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="New email address"
                            autoComplete="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={changeEmailMutation.isPending}
                    className="shrink-0"
                  >
                    Change
                  </Button>
                </form>
              </Form>
            )}
          </div>

          <Separator />

          {/* Theme */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Appearance</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: 'system', label: 'System', icon: Monitor },
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleThemeChange(value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border py-3 text-xs transition-colors',
                    currentTheme === value
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Session + account */}
          <div className="space-y-2">
            <Button variant="outline" className="w-full gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This is permanent. Your account will be removed. If you own a household with
                    other members, transfer ownership first. If you are the sole member, the
                    household, recipe book, pantry, and shopping list will also be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteAccountMutation.mutate()}
                  >
                    Delete account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>

        {/* ══════════════════ NOTIFICATIONS TAB ══════════════════ */}
        <TabsContent value="notifications" className="space-y-6">
          <HouseholdSection household={household} />
          <Separator />
          <SharesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Household management section ──────────────────────────────────────────

function HouseholdSection({ household }: { household: { id: string; name: string; role: 'OWNER' | 'USER' } | null }) {
  const queryClient = useQueryClient();

  const { data: pending, isLoading } = useQuery({
    queryKey: queryKeys.household.pending(),
    queryFn: () => api.get<PendingResponse>('/api/households/pending'),
    enabled: true,
  });

  const { data: members } = useQuery({
    queryKey: queryKeys.household.members(household?.id ?? ''),
    queryFn: () => api.get<Member[]>(`/api/households/${household!.id}/members`),
    enabled: !!household && household.role === 'OWNER',
  });

  const [transferTo, setTransferTo] = useState('');

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/households/join-requests/${id}/accept`),
    onSuccess: () => {
      if (!household) {
        // Accepted an invite from waiting state — full reload to refresh household
        localStorage.removeItem('householdSkipped');
        window.location.href = '/';
      } else {
        void queryClient.invalidateQueries({ queryKey: queryKeys.household.pending() });
        toast.success('Request accepted');
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

  const leaveMutation = useMutation({
    mutationFn: () => api.post(`/api/households/${household!.id}/leave`),
    onSuccess: () => { window.location.href = '/onboarding'; },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to leave'),
  });

  const transferMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/api/households/${household!.id}/transfer-ownership`, { userId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.household.mine() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.household.members(household!.id) });
      toast.success('Ownership transferred');
      setTransferTo('');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Transfer failed'),
  });

  const allItems = [
    ...(pending?.invites ?? []).map((i) => ({ ...i, direction: 'inbound' as const })),
    ...(pending?.requests ?? []).map((r) => ({ ...r, direction: 'inbound' as const })),
  ];

  const otherMembers = (members ?? []).filter((m) => m.role !== 'OWNER');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Household</h2>
        {household && (
          <p className="text-muted-foreground text-sm">{household.name}</p>
        )}
      </div>

      {/* Pending items */}
      {isLoading && (
        <p className="text-muted-foreground text-sm">Loading…</p>
      )}

      {allItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Pending requests</p>
          {allItems.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {item.type === 'INVITE'
                      ? `Invite to ${item.householdName}`
                      : `${item.fromName ?? item.fromHandle ?? 'Someone'} wants to join`}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {item.type === 'INVITE'
                      ? `From ${item.fromName ?? item.fromHandle ?? 'someone'}`
                      : item.householdName}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {item.type === 'INVITE' ? 'Invite' : 'Request'}
                </Badge>
              </div>
              <div className="flex gap-2">
                {(item.type === 'INVITE' || (item.type === 'REQUEST' && household?.role === 'OWNER')) ? (
                  <>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => acceptMutation.mutate(item.id)}
                      disabled={acceptMutation.isPending}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => declineMutation.mutate(item.id)}
                      disabled={declineMutation.isPending}
                    >
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                      Decline
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transfer ownership */}
      {household?.role === 'OWNER' && otherMembers.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Transfer ownership</p>
          <div className="flex gap-2">
            <select
              className="bg-input border-border flex-1 rounded-md border px-3 py-2 text-sm"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
            >
              <option value="">Select member…</option>
              {otherMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name ?? m.handle ?? m.userId}
                </option>
              ))}
            </select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!transferTo}
                  className="gap-1 shrink-0"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  Transfer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will become a regular member. This cannot be undone without the new owner
                    transferring back.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => transferMutation.mutate(transferTo)}>
                    Transfer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Leave household */}
      {household && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full gap-2 text-destructive hover:text-destructive">
              <DoorOpen className="h-4 w-4" />
              Leave household
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave {household.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                You will lose access to this household's recipe book, pantry, and shopping list.
                You can join or create another household after leaving.
                {household.role === 'OWNER' &&
                  ' As the owner, you must transfer ownership before leaving if other members exist.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => leaveMutation.mutate()}
              >
                Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// ─── Shares section ─────────────────────────────────────────────────────────

function SharesSection() {
  const { data: received, isLoading: loadingReceived } = useQuery({
    queryKey: queryKeys.shares.received(),
    queryFn: () => api.get<ShareItem[]>('/api/shares/received'),
  });

  const { data: sent, isLoading: loadingSent } = useQuery({
    queryKey: queryKeys.shares.sent(),
    queryFn: () => api.get<ShareItem[]>('/api/shares/sent'),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/shares/${id}/accept`),
    onSuccess: () => toast.success('Recipe added to your book'),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/shares/${id}/reject`),
    onSuccess: () => toast.success('Share declined'),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const recopymutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/shares/${id}/recopy`),
    onSuccess: () => toast.success('Recipe re-added to your book'),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.shares.received() });
  };

  const pendingReceived = (received ?? []).filter((s) => s.status === 'PENDING');
  const pastReceived = (received ?? []).filter((s) => s.status !== 'PENDING');

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Recipe sharing</h2>

      {/* Pending shares */}
      {loadingReceived && <p className="text-muted-foreground text-sm">Loading…</p>}

      {pendingReceived.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Shared with you</p>
          {pendingReceived.map((s) => (
            <div key={s.id} className="rounded-lg border p-3 space-y-2">
              <div>
                <p className="text-sm font-medium">{s.recipeTitle ?? 'Untitled recipe'}</p>
                <p className="text-muted-foreground text-xs">
                  From {s.fromUserName ?? 'someone'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => { acceptMutation.mutate(s.id); invalidate(); }}
                  disabled={acceptMutation.isPending}
                >
                  Add to my book
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { rejectMutation.mutate(s.id); invalidate(); }}
                  disabled={rejectMutation.isPending}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past received */}
      {pastReceived.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Received history</p>
          {pastReceived.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{s.recipeTitle ?? 'Untitled'}</p>
                <p className="text-muted-foreground text-xs">From {s.fromUserName ?? 'someone'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={s.status === 'ACCEPTED' ? 'default' : 'secondary'} className="text-[10px]">
                  {s.status}
                </Badge>
                {s.status === 'ACCEPTED' && !s.copiedRecipeId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => recopymutation.mutate(s.id)}
                    disabled={recopymutation.isPending}
                  >
                    Re-copy
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sent history */}
      {!loadingSent && (sent ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Sent</p>
          {(sent ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{s.recipeTitle ?? 'Untitled'}</p>
                <p className="text-muted-foreground text-xs">To {s.toUserName ?? 'someone'}</p>
              </div>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {s.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {!loadingReceived && !loadingSent && (received ?? []).length === 0 && (sent ?? []).length === 0 && (
        <p className="text-muted-foreground text-sm">No recipe sharing history yet.</p>
      )}
    </div>
  );
}
