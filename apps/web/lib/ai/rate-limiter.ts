type RateLimiterOptions = {
  max: number;
  windowMs: number;
};

type RateLimiterResult = {
  allowed: boolean;
  remaining: number;
};

export function createRateLimiter({ max, windowMs }: RateLimiterOptions) {
  const buckets = new Map<string, number[]>();

  return {
    check(key: string): RateLimiterResult {
      const now = Date.now();
      const windowStart = now - windowMs;
      const current = (buckets.get(key) ?? []).filter(
        (timestamp) => timestamp > windowStart,
      );

      if (current.length >= max) {
        buckets.set(key, current);
        return {
          allowed: false,
          remaining: 0,
        };
      }

      current.push(now);
      buckets.set(key, current);

      return {
        allowed: true,
        remaining: Math.max(0, max - current.length),
      };
    },
  };
}

export const aiRateLimiter = createRateLimiter({
  max: 20,
  windowMs: 60_000,
});
