import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SourceDisplayProps {
  source: string | null | undefined;
  className?: string;
}

export function SourceDisplay({ source, className }: SourceDisplayProps) {
  if (!source) return null;
  const isUrl = source.startsWith('https://');
  if (isUrl) {
    let displayHost = source;
    try {
      displayHost = new URL(source).hostname.replace(/^www\./, '');
    } catch {}
    return (
      <a
        href={source}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-3 w-3" />
        {displayHost}
      </a>
    );
  }
  return <span className={cn('text-xs text-muted-foreground', className)}>{source}</span>;
}

interface RecipeMetaLineProps {
  categoryName?: string | null;
  source?: string | null;
  className?: string;
}

export function RecipeMetaLine({ categoryName, source, className }: RecipeMetaLineProps) {
  const hasCategory = !!categoryName;
  const hasSource = !!source;
  if (!hasCategory && !hasSource) return null;
  const isUrl = hasSource && source!.startsWith('https://');
  return (
    <div className={cn('space-y-1', className)}>
      {hasCategory && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Category:</span> {categoryName}
        </p>
      )}
      {hasSource && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Source/Author:</span>{' '}
          {isUrl
            ? (() => {
                let displayHost = source!;
                try { displayHost = new URL(source!).hostname.replace(/^www\./, ''); } catch {}
                return (
                  <a
                    href={source!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" />{displayHost}
                  </a>
                );
              })()
            : source
          }
        </p>
      )}
    </div>
  );
}
