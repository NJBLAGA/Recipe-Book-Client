import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { toast } from 'sonner';
import { BookOpenText, Users, Search, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
});

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

function OnboardingPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { household, isLoading: householdLoading } = useHousehold(!sessionPending && !!session);

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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.household.mine() });
      void navigate({ to: '/' });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create household');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/households/join-requests/${id}/accept`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.household.mine() });
      void navigate({ to: '/' });
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

  const requestMutation = useMutation({
    mutationFn: (householdId: string) => api.post(`/api/households/${householdId}/requests`),
    onSuccess: (_data, householdId) => {
      setRequestedHouseholds((prev) => new Set([...prev, householdId]));
      toast.success('Join request sent');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send request');
    },
  });

  if (sessionPending || householdLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="border-primary/30 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    void navigate({ to: '/sign-in' });
    return null;
  }

  if (household !== null) {
    void navigate({ to: '/' });
    return null;
  }

  const invites = pending?.invites ?? [];
  const usersWithHousehold = (searchResults ?? []).filter((u) => u.householdId !== null);

  return (
    <div className="flex min-h-svh flex-col items-center justify-start px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
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

        {/* ── Create a household ───────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="text-primary h-4 w-4" />
              <CardTitle className="text-base">Start fresh</CardTitle>
            </div>
            <CardDescription>Create a new household and invite others to join</CardDescription>
          </CardHeader>
          <CardContent>
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
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating…' : 'Create household'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* ── Pending invites ──────────────────────── */}
        {invites.length > 0 && (
          <>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs">or accept an invitation</span>
              <Separator className="flex-1" />
            </div>

            <div className="space-y-3">
              {invites.map((invite) => (
                <Card key={invite.id}>
                  <CardContent className="pt-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{invite.householdName}</p>
                        <p className="text-muted-foreground text-sm">
                          Invited by{' '}
                          <span className="text-foreground">
                            {invite.fromName ?? invite.fromHandle ?? 'someone'}
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ── Request to join ──────────────────────── */}
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">or find someone to join</span>
          <Separator className="flex-1" />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="text-primary h-4 w-4" />
              <CardTitle className="text-base">Join a household</CardTitle>
            </div>
            <CardDescription>
              Search by handle and request to join their household
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                      <FormLabel>Search by handle</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="@handle"
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
                  {searching ? 'Searching…' : 'Search'}
                </Button>
              </form>
            </Form>

            {searchQuery.length >= 2 && usersWithHousehold.length === 0 && !searching && (
              <p className="text-muted-foreground mt-3 text-center text-sm">No results found</p>
            )}

            {usersWithHousehold.length > 0 && (
              <div className="mt-4 space-y-2">
                {usersWithHousehold.map((u) => {
                  const alreadyRequested = requestedHouseholds.has(u.householdId!);
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {u.name ?? u.handle ?? 'Unknown'}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {u.householdName}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={alreadyRequested ? 'secondary' : 'default'}
                        disabled={alreadyRequested || requestMutation.isPending}
                        onClick={() => !alreadyRequested && requestMutation.mutate(u.householdId!)}
                      >
                        {alreadyRequested ? 'Requested' : 'Request'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Wait for an invite ──────────────────────── */}
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">or not right now</span>
          <Separator className="flex-1" />
        </div>

        <div className="rounded-lg border p-4 text-center space-y-3">
          <div>
            <p className="text-sm font-medium">Wait for an invite</p>
            <p className="text-muted-foreground text-xs mt-1">
              Set up your profile and wait to be invited by someone already in a household.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              localStorage.setItem('householdSkipped', 'true');
              void navigate({ to: '/profile' });
            }}
          >
            Continue without a household
          </Button>
        </div>
      </div>
    </div>
  );
}
