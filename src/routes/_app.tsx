import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { BookOpenText, ShoppingCart, Refrigerator, Users, UserCircle, Clock, X } from 'lucide-react';
import { authClient } from '@/lib/auth';
import { useHousehold } from '@/hooks/useHousehold';
import { useMe } from '@/hooks/useMe';
import { cn } from '@/lib/utils';
import { TimerProvider, useTimerContext } from '@/contexts/TimerContext';
import { FloatingTimer } from '@/components/FloatingTimer';
import { TimerWidget } from '@/components/TimerWidget';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

const navItems = [
  { to: '/recipes',       label: 'Recipe Book',  shortLabel: 'Recipes',   icon: BookOpenText, exact: false },
  { to: '/community',    label: 'Community',     shortLabel: 'Community', icon: Users,        exact: false },
  { to: '/profile',      label: 'Profile',       shortLabel: 'Profile',   icon: UserCircle,   exact: false },
  { to: '/pantry',       label: 'My Pantry',     shortLabel: 'Pantry',    icon: Refrigerator, exact: false },
  { to: '/shopping-list', label: 'Shopping List', shortLabel: 'Shopping', icon: ShoppingCart, exact: false },
];

function Spinner() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="border-primary/30 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
    </div>
  );
}

function TimerDialog() {
  const { timerOpen, setTimerOpen } = useTimerContext();
  return (
    <Dialog open={timerOpen} onOpenChange={setTimerOpen}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm p-0 gap-0">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Cooking Timer</h2>
          </div>
          <DialogClose className="rounded-full p-1 hover:bg-accent transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        <div className="px-5 py-5">
          <TimerWidget />
        </div>
      </DialogContent>
    </Dialog>
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
    sessionStorage.getItem('householdSkipped') === 'true';

  // Clear the waiting flag as soon as the user joins a household
  useEffect(() => {
    if (household !== null) {
      sessionStorage.removeItem('householdSkipped');
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
    <TimerProvider>
      <TimerDialog />
      <FloatingTimer />
    <div className="flex min-h-svh flex-col">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <nav className="bg-background/95 border-t fixed bottom-0 left-0 right-0 z-50 supports-[backdrop-filter]:backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-around px-2 py-1.5 pb-[env(safe-area-inset-bottom)] sm:px-4 sm:py-2 lg:px-8">
          {visibleNavItems.map(({ to, label, shortLabel, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            const showAvatar = to === '/profile' && !!me?.image;
            return (
              <Link
                key={to}
                to={to as '/'}
                className={cn(
                  'flex flex-row items-center gap-1.5 rounded-xl transition-colors min-w-0',
                  'px-1.5 py-1.5 text-[9px]',
                  'sm:gap-2 sm:px-3 sm:py-2 sm:text-[11px]',
                  'lg:gap-2.5 lg:px-4 lg:text-sm',
                  active
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {showAvatar ? (
                  <div
                    className={cn(
                      'h-4 w-4 shrink-0 overflow-hidden rounded-full lg:h-5 lg:w-5',
                      active
                        ? 'ring-1 ring-primary ring-offset-2 ring-offset-background'
                        : 'ring-1 ring-border',
                    )}
                  >
                    <img src={me!.image!} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <Icon className={cn('h-4 w-4 shrink-0 lg:h-5 lg:w-5', active && 'stroke-[2.5]')} />
                )}
                <span className="truncate leading-none">
                  <span className="sm:hidden">{shortLabel}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
    </TimerProvider>
  );
}
