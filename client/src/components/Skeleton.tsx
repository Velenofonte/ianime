export function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl bg-surface-card">
      <div className="aspect-[2/3] w-full bg-surface-hover" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 rounded bg-surface-hover" />
        <div className="h-3 w-1/2 rounded bg-surface-hover" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
