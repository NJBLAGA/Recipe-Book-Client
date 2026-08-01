import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { toast } from 'sonner';
import { BookOpenText } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useMe } from '@/hooks/useMe';
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

export const Route = createFileRoute('/complete-profile')({
  component: CompleteProfilePage,
});

const schema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  handle: z
    .string()
    .min(2, 'Handle must be at least 2 characters')
    .max(40, 'Handle must be 40 characters or less')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, and underscores only'),
});

type FormValues = z.infer<typeof schema>;

function CompleteProfilePage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: me, isPending: meLoading } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const prefilled = useRef(false);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { firstName: '', lastName: '', handle: '' },
  });

  useEffect(() => {
    if (me && !prefilled.current) {
      prefilled.current = true;
      form.reset({
        firstName: me.firstName ?? '',
        lastName: me.lastName ?? '',
        handle: '',
      });
    }
  }, [me, form]);

  useEffect(() => {
    if (!sessionPending && !session) {
      void navigate({ to: '/sign-in' });
    }
  }, [session, sessionPending, navigate]);

  useEffect(() => {
    if (!sessionPending && session && !meLoading && me?.handle) {
      void navigate({ to: '/onboarding' });
    }
  }, [session, sessionPending, me, meLoading, navigate]);

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.patch('/api/users/me', {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        handle: values.handle.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.me() });
      void navigate({ to: '/onboarding' });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save profile');
    },
  });

  if (sessionPending || meLoading || !session) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="border-primary/30 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-start px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-2xl">
            <BookOpenText className="h-6 w-6" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Complete your profile</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              A few details before we get you set up
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Jane"
                        autoComplete="given-name"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Smith"
                        autoComplete="family-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="handle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none">
                        @
                      </span>
                      <Input
                        type="text"
                        placeholder="janesmith"
                        autoComplete="off"
                        className="pl-7"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Continue'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
