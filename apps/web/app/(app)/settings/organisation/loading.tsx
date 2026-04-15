export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-44 bg-surface-container-high rounded-lg" />
      <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
        <div className="h-5 w-36 bg-surface-container-high rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-12 bg-surface-container-high rounded-xl" />
          <div className="h-12 bg-surface-container-high rounded-xl" />
        </div>
        <div className="h-12 w-full bg-surface-container-high rounded-xl" />
      </div>
      <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
        <div className="h-5 w-28 bg-surface-container-high rounded" />
        <div className="h-12 w-full bg-surface-container-high rounded-xl" />
        <div className="h-12 w-full bg-surface-container-high rounded-xl" />
      </div>
    </div>
  );
}
