import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { BookOpenText, ShoppingCart, Refrigerator, Home } from 'lucide-react';
import { authClient } from '@/lib/auth';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

const navItems = [
  { to: '/', label: 'Home', icon: Home, exact: true },
  { to: '/recipes', label: 'Recipes', icon: BookOpenText, exact: false },
  { to: '/pantry', label: 'Pantry', icon: Refrigerator, exact: false },
  { to: '/shopping-list', label: 'Shopping', icon: ShoppingCart, exact: false },
] as const;

function AppLayout() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!isPending && !session) {
      void navigate({ to: '/sign-in' });
    }
  }, [session, isPending, navigate]);

  if (isPending || !session) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="border-primary/30 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <nav className="bg-background/95 border-t fixed bottom-0 left-0 right-0 z-50 supports-[backdrop-filter]:backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2 pb-[env(safe-area-inset-bottom)]">
          {navItems.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to as string);
            return (
              <Link
                key={to}
                to={to as '/'}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-xs transition-colors',
                  active
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
