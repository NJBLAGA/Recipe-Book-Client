export const queryKeys = {
  household: {
    mine: () => ['households', 'mine'] as const,
    pending: () => ['households', 'pending'] as const,
    members: (id: string) => ['households', id, 'members'] as const,
  },
  users: {
    me: () => ['users', 'me'] as const,
    search: (handle: string) => ['users', 'search', handle] as const,
    profile: (handle: string) => ['users', 'profile', handle] as const,
  },
  shares: {
    received: () => ['shares', 'received'] as const,
    sent: () => ['shares', 'sent'] as const,
  },
};
