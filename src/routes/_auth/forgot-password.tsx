import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { toast } from 'sonner';
import { BookOpenText, Mail } from 'lucide-react';
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

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
});

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});

type FormValues = z.infer<typeof schema>;

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { email: '' },
  });

  const resetMutation = useMutation({
    mutationFn: (email: string) =>
      api.post('/api/auth/request-password-reset', {
        email,
        redirectTo: window.location.origin + '/reset-password',
      }),
    onSuccess: (_, email) => {
      setSentTo(email);
      setSent(true);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  if (sent) {
    return (
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="bg-muted mx-auto flex h-16 w-16 items-center justify-center rounded-full">
          <Mail className="text-primary h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Check your email</h2>
          <p className="text-muted-foreground text-sm">
            If <span className="text-foreground font-medium">{sentTo}</span> is registered, you'll
            receive a reset link shortly. Check your spam folder if it doesn't arrive.
          </p>
        </div>
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
          <h1 className="text-2xl font-semibold tracking-tight">Forgot password?</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Enter your email and we'll send you a reset link
          </p>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => resetMutation.mutate(v.email))}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={resetMutation.isPending}>
            {resetMutation.isPending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      </Form>

      <p className="text-muted-foreground text-center text-sm">
        Remembered it?{' '}
        <Link
          to="/sign-in"
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
