import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { toast } from 'sonner';
import { BookOpenText, Sparkles, Users, Mail, CheckCircle2, XCircle, Search, Home } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { authClient } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useHousehold } from '@/hooks/useHousehold';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
});

type Panel = 'create' | 'join' | 'invite';

interface PendingItem {
  id: string;
  householdId: string;
  householdName: string;
  fromName: string | null;
  fromHandle: string | null;
  fromImage: string | null;
  type: 'INVITE' | 'REQUEST';
  status: 'PENDING';
}

interface PendingResponse {
  invites: PendingItem[];
  requests: PendingItem[];
}

interface SearchUser {
  id: string;
  name: string | null;
  handle: string | null;
  image: string | null;
  householdId: string | null;
  householdName: string | null;
}

const createSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const searchSchema = z.object({
  handle: z.string().min(2, 'Enter at least 2 characters'),
});

const OPTIONS: { id: Panel; icon: React.ElementType; label: string }[] = [
  { id: 'create', icon: Sparkles, label: 'Create Household' },
  { id: 'join',   icon: Users,    label: 'Request to Join' },
  { id: 'invite', icon: Mail,     label: 'Accept an Invite' },
];

function OnboardingPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { household, isLoading: householdLoading } = useHousehold(!sessionPending && !!session);

  const [active, setActive] = useState<Panel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestedHouseholds, setRequestedHouseholds] = useState<Set<string>>(new Set());

  const { data: pending } = useQuery({
    queryKey: queryKeys.household.pending(),
    queryFn: () => api.get<PendingResponse>('/api/households/pending'),
    enabled: !sessionPending && !!session,
    retry: false,
  });

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: queryKeys.users.search(searchQuery),
    queryFn: () =>
      api.get<SearchUser[]>(`/api/users/search?handle=${encodeURIComponent(searchQuery)}`),
    enabled: searchQuery.length >= 2,
  });

  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: standardSchemaResolver(createSchema),
    defaultValues: { name: '' },
  });

  const searchForm = useForm<z.infer<typeof searchSchema>>({
    resolver: standardSchemaResolver(searchSchema),
    defaultValues: { handle: '' },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post('/api/households', { name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.household.mine() });
      void navigate({ to: '/recipes' });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create household');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/households/join-requests/${id}/accept`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.household.mine() });
      void navigate({ to: '/recipes' });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to accept invite');
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/households/join-requests/${id}/decline`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.household.pending() });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to decline invite');
    },
  });

  const pendingRequestRef = useRef<Set<string>>(new Set());

  const requestMutation = useMutation({
    mutationFn: (householdId: string) => api.post(`/api/households/${householdId}/requests`),
    onSuccess: (_data, householdId) => {
      setRequestedHouseholds((prev) => new Set([...prev, householdId]));
      pendingRequestRef.current.delete(householdId);
      toast.success('Join request sent');
    },
    onError: (_err, householdId) => {
      pendingRequestRef.current.delete(householdId);
      toast.error(_err instanceof ApiError ? _err.message : 'Failed to send request');
    },
  });

  useEffect(() => {
    if (!sessionPending && !householdLoading && !session) {
      void navigate({ to: '/sign-in' });
    }
  }, [sessionPending, householdLoading, session, navigate]);

  useEffect(() => {
    if (!sessionPending && !householdLoading && household !== null) {
      void navigate({ to: '/' });
    }
  }, [sessionPending, householdLoading, household, navigate]);

  if (sessionPending || householdLoading || !session || household !== null) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="border-primary/30 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  const invites = pending?.invites ?? [];
  const usersWithHousehold = (searchResults ?? []).filter((u) => u.householdId !== null);

  return (
    <div className="flex min-h-svh flex-col items-center justify-start px-4 py-12">
      <div className="w-full max-w-sm space-y-8">

        {/* ── Household explanation ─────────────────── */}
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full mt-0.5">
              <Home className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">This app is built around households</p>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                Your recipe book, pantry, and shopping list all belong to a household and are shared with everyone in it. You need to create or join one before you can access any features.
              </p>
            </div>
          </div>
        </div>

        {/* ── Header ───────────────────────────────── */}
        <div className="flex flex-col items-center gap-3" data-tour="onboarding-header">
          <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-2xl">
            <BookOpenText className="h-6 w-6" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Set up your household to get started
            </p>
          </div>
        </div>

        {/* ── Option selector ───────────────────────── */}
        <div className="grid grid-cols-3 gap-3" data-tour="onboarding-join">
          {OPTIONS.map(({ id, icon: Icon, label }) => {
            const isActive = active === id;
            const isDimmed = active !== null && !isActive;
            return (
              <button
                key={id}
                type="button"
                data-tour={id === 'create' ? 'onboarding-create' : undefined}
                onClick={() => setActive(isActive ? null : id)}
                className={[
                  'flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-200',
                  isActive
                    ? 'border-primary bg-primary/8 scale-[1.03] shadow-sm'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40',
                  isDimmed ? 'opacity-40' : 'opacity-100',
                ].join(' ')}
              >
                <div className={[
                  'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                  isActive ? 'bg-primary/15' : 'bg-muted',
                ].join(' ')}>
                  <Icon className={['h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground'].join(' ')} />
                </div>
                <span className={['text-xs font-medium leading-tight', isActive ? 'text-foreground' : 'text-muted-foreground'].join(' ')}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Active panel ─────────────────────────── */}
        {active === 'create' && (
          <div className="rounded-xl border p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <p className="font-medium text-sm">Create a new household</p>
              <p className="text-muted-foreground text-xs mt-0.5">Invite other users to join your household after it's created</p>
            </div>
            <Form {...createForm}>
              <form
                onSubmit={createForm.handleSubmit((v) => createMutation.mutate(v.name))}
                className="space-y-3"
              >
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Household name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. The Blagas" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Setting up…' : 'Create household'}
                </Button>
              </form>
            </Form>
          </div>
        )}

        {active === 'join' && (
          <div className="rounded-xl border p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <p className="font-medium text-sm">Request to join a household</p>
              <p className="text-muted-foreground text-xs mt-0.5">Search for a user by their handle (e.g. @jonsmith) and send a join request to their household</p>
            </div>
            <Form {...searchForm}>
              <form
                onSubmit={searchForm.handleSubmit((v) => setSearchQuery(v.handle))}
                className="space-y-3"
              >
                <FormField
                  control={searchForm.control}
                  name="handle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username / handle</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. jonsmith"
                          autoComplete="off"
                          autoCapitalize="none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" variant="outline" className="w-full" disabled={searching}>
                  <Search className="mr-2 h-4 w-4" />
                  {searching ? 'Searching…' : 'Search'}
                </Button>
              </form>
            </Form>

            {searchQuery.length >= 2 && usersWithHousehold.length === 0 && !searching && (
              <p className="text-muted-foreground text-center text-sm">No results found</p>
            )}

            {usersWithHousehold.length > 0 && (
              <div className="space-y-2">
                {usersWithHousehold.map((u) => {
                  const alreadyRequested = requestedHouseholds.has(u.householdId!);
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">
                          {u.name ?? u.handle ?? 'Unknown'}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">{u.householdName}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={alreadyRequested ? 'secondary' : 'default'}
                        disabled={alreadyRequested || requestMutation.isPending}
                        onClick={() => {
                          if (alreadyRequested || pendingRequestRef.current.has(u.householdId!)) return;
                          pendingRequestRef.current.add(u.householdId!);
                          requestMutation.mutate(u.householdId!);
                        }}
                      >
                        {alreadyRequested ? 'Requested' : 'Request'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {active === 'invite' && (
          <div className="rounded-xl border p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <p className="font-medium text-sm">Accept an invite from a household</p>
              <p className="text-muted-foreground text-xs mt-0.5">Accept or decline invitations sent to you by household members</p>
            </div>

            {invites.length === 0 ? (
              <p className="text-muted-foreground text-center text-sm py-4">
                No pending invites
              </p>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => (
                  <div key={invite.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{invite.householdName}</p>
                        <p className="text-muted-foreground text-xs">
                          Invited by{' '}
                          <span className="text-foreground">
                            {invite.fromHandle ? `@${invite.fromHandle}` : invite.fromName ?? 'someone'}
                          </span>
                        </p>
                      </div>
                      <Badge variant="secondary">Invite</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => acceptMutation.mutate(invite.id)}
                        disabled={acceptMutation.isPending}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => declineMutation.mutate(invite.id)}
                        disabled={declineMutation.isPending}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Skip ─────────────────────────────────── */}
        <p className="text-center text-xs text-muted-foreground">
          Not ready?{' '}
          <button
            type="button"
            className="underline-offset-4 hover:underline hover:text-foreground transition-colors"
            onClick={() => {
              sessionStorage.setItem('householdSkipped', 'true');
              void navigate({ to: '/profile' });
            }}
          >
            Continue without a household
          </button>
        </p>

      </div>
    </div>
  );
}
