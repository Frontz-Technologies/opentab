export async function getCachedOrCompute<T>(
  _key: string,
  compute: () => Promise<T>,
): Promise<T> {
  // Redis caching disabled — no REDIS_URL configured.
  // Calls compute() directly. When Redis is added, this wrapper
  // will check/set cache with a 5-minute TTL.
  return compute();
}

export async function invalidateReportCache(_orgId: string): Promise<void> {
  // No-op without Redis
}
