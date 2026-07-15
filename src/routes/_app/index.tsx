import { createFileRoute } from '@tanstack/react-router';
import { authClient } from '@/lib/auth';

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: session } = authClient.useSession();
  const name = session?.user.name ?? 'there';

  return (
    <div className="px-4 pt-12">
      <h1 className="text-2xl font-semibold">Hey, {name.split(' ')[0]}</h1>
      <p className="text-muted-foreground mt-1 text-sm">More coming soon.</p>
    </div>
  );
}
