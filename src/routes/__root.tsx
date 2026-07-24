import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Component, ErrorInfo, ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { queryClient } from '@/lib/query';
import { TourProvider } from '@/contexts/TourContext';
import { TourOverlay } from '@/components/TourOverlay';

interface ErrorBoundaryState { hasError: boolean }

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            An unexpected error occurred. Reload the page to continue.
          </p>
          <button
            className="rounded-lg border px-4 py-2 text-sm hover:bg-accent transition-colors"
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TourProvider>
          <TourOverlay />
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
          <Toaster position="top-center" />
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </TourProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
