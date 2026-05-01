export default function Loading() {
  return (
    <main>
      <div className="max-w-2xl">
        <div className="bg-surface-container-low rounded-xl p-6 animate-pulse">
          <div className="h-4 w-3/4 bg-surface-container rounded mb-4" />
          <div className="h-4 w-1/3 bg-surface-container rounded mb-2" />
          <div className="h-4 w-2/3 bg-surface-container rounded" />
        </div>
      </div>
    </main>
  );
}
