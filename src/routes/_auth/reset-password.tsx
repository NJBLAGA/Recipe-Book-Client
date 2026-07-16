import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { toast } from 'sonner';
import { BookOpenText, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
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

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
    error: typeof search.error === 'string' ? search.error : '',
  }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const resetMutation = useMutation({
    mutationFn: (newPassword: string) =>
      api.post('/api/auth/reset-password', { newPassword, token }),
    onSuccess: () => {
      window.location.href = '/sign-in?passwordReset=true';
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Reset failed — the link may have expired');
    },
  });

  if (error === 'INVALID_TOKEN' || (!token && !error)) {
    return (
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Link expired or invalid</h2>
          <p className="text-muted-foreground text-sm">
            This reset link has already been used or has expired. Request a new one.
          </p>
        </div>
        <Button className="w-full" asChild>
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
        <Button variant="outline" className="w-full" asChild>
          <Link to="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="flex flex-col items-center gap-3">
        <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-2xl">
          <BookOpenText className="h-6 w-6" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="text-muted-foreground mt-1 text-sm">Must be at least 8 characters</p>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => resetMutation.mutate(v.newPassword))}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      autoFocus
                      className="pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirm((v) => !v)}
                      className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={resetMutation.isPending}>
            {resetMutation.isPending ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
