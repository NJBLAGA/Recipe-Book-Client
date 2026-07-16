import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { BookOpenText, ShoppingCart, Refrigerator, Home, UserCircle } from 'lucide-react';
import { authClient } from '@/lib/auth';
import { useHousehold } from '@/hooks/useHousehold';
import { useMe } from '@/hooks/useMe';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

const navItems = [
  { to: '/', label: 'Home', icon: Home, exact: true },
  { to: '/recipes', label: 'Recipes', icon: BookOpenText, exact: false },
  { to: '/profile', label: 'Profile', icon: UserCircle, exact: false },
  { to: '/pantry', label: 'Pantry', icon: Refrigerator, exact: false },
  { to: '/shopping-list', label: 'Shopping', icon: ShoppingCart, exact: false },
];

function Spinner() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="border-primary/30 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
    </div>
  );
}

function AppLayout() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { household, isLoading: householdLoading } = useHousehold(!sessionPending && !!session);
  const { data: me } = useMe();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // User deliberately chose "wait for an invite" on the onboarding screen
  const householdSkipped =
    !sessionPending &&
    !!session &&
    !householdLoading &&
    household === null &&
    localStorage.getItem('householdSkipped') === 'true';

  // Clear the waiting flag as soon as the user joins a household
  useEffect(() => {
    if (household !== null) {
      localStorage.removeItem('householdSkipped');
    }
  }, [household]);

  useEffect(() => {
    if (!sessionPending && !session) {
      void navigate({ to: '/sign-in' });
    }
  }, [session, sessionPending, navigate]);

  useEffect(() => {
    if (!sessionPending && session && !householdLoading && household === null && !householdSkipped) {
      void navigate({ to: '/onboarding' });
    }
  }, [session, sessionPending, household, householdLoading, householdSkipped, navigate]);

  // Waiting users can only access /profile — redirect everything else there
  useEffect(() => {
    if (householdSkipped && pathname !== '/profile') {
      void navigate({ to: '/profile' });
    }
  }, [householdSkipped, pathname, navigate]);

  if (sessionPending || !session || householdLoading || (household === null && !householdSkipped)) {
    return <Spinner />;
  }

  const visibleNavItems = householdSkipped
    ? navItems.filter((item) => item.to === '/profile')
    : navItems;

  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <nav className="bg-background/95 border-t fixed bottom-0 left-0 right-0 z-50 supports-[backdrop-filter]:backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-2 pb-[env(safe-area-inset-bottom)]">
          {visibleNavItems.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            const showAvatar = to === '/profile' && !!me?.image;
            return (
              <Link
                key={to}
                to={to as '/'}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[11px] transition-colors',
                  active
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {showAvatar ? (
                  <div
                    className={cn(
                      'h-5 w-5 overflow-hidden rounded-full',
                      active
                        ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                        : 'ring-1 ring-border',
                    )}
                  >
                    <img src={me!.image!} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                )}
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
