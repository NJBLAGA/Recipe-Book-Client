import { useQuery } from '@tanstack/react-query';
import { UtensilsCrossed, X, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserBioTarget {
  userId: string;
  name: string | null;
  handle: string | null;
  image: string | null;
}

interface ProfilePin {
  position: number;
  recipeId: string | null;
  recipeTitle: string | null;
  recipeDescription: string | null;
  recipeImage: string | null;
  recipeRating: { avg: number; count: number } | null;
}

interface PublicProfile {
  id: string;
  name: string | null;
  handle: string | null;
  bio: string | null;
  image: string | null;
  isPublic: boolean;
  pins: ProfilePin[];
}

function initials(name: string | null, fallback: string) {
  if (!name) return fallback[0]?.toUpperCase() ?? '?';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function UserBioModal({ target, open, onClose, onViewPin }: {
  target: UserBioTarget | null;
  open: boolean;
  onClose: () => void;
  onViewPin?: (ownerId: string, ownerHandle: string | null, pin: ProfilePin) => void;
}) {
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.users.profile(target?.handle ?? ''),
    queryFn: () => api.get<PublicProfile>(`/api/users/${target!.handle}`),
    enabled: open && !!target?.handle,
  });

  if (!target) return null;

  const ini = initials(target.name, target.handle ?? target.userId);
  const activePins = (profile?.pins ?? []).filter((p) => p.recipeId !== null);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
        <DialogClose className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 border border-border/60 shadow-md text-foreground hover:bg-muted transition-colors backdrop-blur-sm">
          <X className="h-4 w-4" /><span className="sr-only">Close</span>
        </DialogClose>

        {/* Header banner */}
        <div className="relative h-16 bg-muted/40 border-b shrink-0">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <div className="rounded-full p-1 bg-background shadow-md ring-4 ring-background">
              <Avatar className="h-14 w-14">
                <AvatarImage src={target.image ?? undefined} />
                <AvatarFallback className="text-xl font-bold">{ini}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 pt-10 pb-5 px-5 space-y-4">
          <div className="text-center space-y-0.5">
            <p className="font-bold text-base">{target.name ?? 'User'}</p>
            {target.handle && <p className="text-muted-foreground text-sm">@{target.handle}</p>}
          </div>

          {isLoading && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-transparent" />
            </div>
          )}

          {!isLoading && profile?.bio && (
            <div className="rounded-xl bg-muted/50 border border-border/40 px-3 py-2.5">
              <p className="text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
            </div>
          )}

          {!isLoading && profile && !profile.bio && (
            <p className="text-center text-xs text-muted-foreground italic">No bio yet.</p>
          )}

          {!isLoading && activePins.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Pinned Recipes</p>
              <div className="space-y-2.5">
                {activePins.map((pin) => (
                  <div key={pin.position} className="relative flex items-center gap-3 rounded-xl border bg-card p-2.5">
                    <span className="absolute -top-2 -left-2 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow-sm leading-none">
                      {pin.position}
                    </span>
                    {pin.recipeImage
                      ? <img src={pin.recipeImage} alt={pin.recipeTitle ?? ''} className="h-14 w-14 rounded-lg object-cover shrink-0" />
                      : <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <UtensilsCrossed className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                    }
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-semibold truncate">{pin.recipeTitle}</p>
                      {pin.recipeDescription && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{pin.recipeDescription}</p>
                      )}
                      {pin.recipeRating && pin.recipeRating.count > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          ★ {pin.recipeRating.avg.toFixed(1)} ({pin.recipeRating.count})
                        </p>
                      )}
                    </div>
                    {pin.recipeId && onViewPin && (
                      <button
                        type="button"
                        onClick={() => onViewPin(target!.userId, target!.handle, pin)}
                        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && !target.handle && (
            <p className="text-center text-xs text-muted-foreground">This user hasn't set a handle yet — their profile isn't public.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
