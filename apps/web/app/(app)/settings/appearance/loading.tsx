export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-44 bg-surface-container-high rounded-lg" />
      <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
        <div className="h-5 w-24 bg-surface-container-high rounded" />
        <div className="flex gap-4">
          <div className="h-20 w-32 bg-surface-container-high rounded-xl" />
          <div className="h-20 w-32 bg-surface-container-high rounded-xl" />
        </div>
      </div>
    </div>
  );
}
