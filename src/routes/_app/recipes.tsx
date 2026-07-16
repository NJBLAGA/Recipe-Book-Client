import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/recipes')({
  component: RecipesPage,
});

function RecipesPage() {
  return (
    <div className="px-4 pt-12">
      <h1 className="text-2xl font-semibold">Recipes</h1>
      <p className="text-muted-foreground mt-1 text-sm">Coming soon.</p>
    </div>
  );
}
