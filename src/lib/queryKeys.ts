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
  },
  shares: {
    received: () => ['shares', 'received'] as const,
    sent: () => ['shares', 'sent'] as const,
    review: (shareId: string) => ['shares', shareId, 'review'] as const,
  },
  recipeBook: {
    pins: () => ['recipe-book', 'pins'] as const,
    recipes: (search: string) => ['recipe-book', 'recipes', search] as const,
  },
  community: {
    posts: (userId?: string, since?: string) => ['community', 'posts', userId ?? '', since ?? 'all'] as const,
    followingPosts: () => ['community', 'posts', 'following'] as const,
    postRecipe: (postId: string) => ['community', 'posts', postId, 'recipe'] as const,
    postReviews: (postId: string) => ['community', 'posts', postId, 'reviews'] as const,
  },
  follows: {
    following: () => ['follows', 'following'] as const,
    followers: () => ['follows', 'followers'] as const,
  },
};
