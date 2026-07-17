export const queryKeys = {
  household: {
    mine: () => ['households', 'mine'] as const,
    pending: () => ['households', 'pending'] as const,
    pendingSent: () => ['households', 'pending-sent'] as const,
    members: (id: string) => ['households', id, 'members'] as const,
  },
  users: {
    me: () => ['users', 'me'] as const,
    search: (handle: string) => ['users', 'search', handle] as const,
    profile: (handle: string) => ['users', 'profile', handle] as const,
    community: (search: string) => ['users', 'community', search] as const,
    pinRecipe: (handle: string, recipeId: string) => ['users', 'pin-recipe', handle, recipeId] as const,
  },
  shares: {
    received: () => ['shares', 'received'] as const,
    sent: () => ['shares', 'sent'] as const,
    review: (shareId: string) => ['shares', shareId, 'review'] as const,
  },
  recipeBook: {
    categories: () => ['recipe-book', 'categories'] as const,
    recipes: (search?: string, categoryId?: string) => ['recipe-book', 'recipes', search ?? '', categoryId ?? ''] as const,
    recipe: (id: string) => ['recipe-book', 'recipes', id] as const,
    pins: () => ['recipe-book', 'pins'] as const,
    canMake: () => ['recipe-book', 'can-make'] as const,
  },
  pantry: {
    categories: () => ['pantry', 'categories'] as const,
    items: (categoryId?: string) => ['pantry', 'items', categoryId ?? ''] as const,
    item: (id: string) => ['pantry', 'items', id] as const,
  },
  shoppingList: {
    categories: () => ['shopping-list', 'categories'] as const,
    items: () => ['shopping-list', 'items'] as const,
  },
  community: {
    posts: (userId?: string, from?: string, to?: string) => ['community', 'posts', userId ?? '', from ?? '', to ?? ''] as const,
    followingPosts: () => ['community', 'posts', 'following'] as const,
    postRecipe: (postId: string) => ['community', 'posts', postId, 'recipe'] as const,
    postReviews: (postId: string) => ['community', 'posts', postId, 'reviews'] as const,
  },
  follows: {
    following: () => ['follows', 'following'] as const,
    followers: () => ['follows', 'followers'] as const,
  },
};
