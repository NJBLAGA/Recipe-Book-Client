import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/shopping-list')({
  component: ShoppingListPage,
});

function ShoppingListPage() {
  return (
    <div className="px-4 pt-12">
      <h1 className="text-2xl font-semibold">Shopping List</h1>
      <p className="text-muted-foreground mt-1 text-sm">Coming soon.</p>
    </div>
  );
}
