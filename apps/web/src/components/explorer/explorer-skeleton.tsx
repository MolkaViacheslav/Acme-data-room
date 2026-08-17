import { Skeleton } from '@/components/ui/skeleton';

export function ExplorerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-7 w-52" />
      </div>

      <div className="rounded-lg border">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b p-3 last:border-b-0">
            <Skeleton className="size-4 shrink-0 rounded" />
            <Skeleton className="h-4 flex-1 max-w-64" />
            <Skeleton className="hidden h-4 w-20 sm:block" />
            <Skeleton className="hidden h-4 w-36 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
