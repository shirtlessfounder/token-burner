import "server-only";

// In-memory sliding-window rate limiter. Per-instance — a determined
// attacker hitting different vercel regions can bypass — but for the
// claim-codes endpoint that's fine; it stops casual scraper bots cold
// and keeps the table from filling under launch-day Twitter traffic.
//
// Upgrade path when needed: swap to Upstash redis sliding window for
// cross-region accuracy. The signature here is the contract.

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

const sweepIfNeeded = (bucket: Bucket, windowStart: number): void => {
  while (bucket.timestamps.length > 0 && bucket.timestamps[0] < windowStart) {
    bucket.timestamps.shift();
  }
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export const consumeRateLimit = (
  key: string,
  {
    limit,
    windowMilliseconds,
    now = Date.now(),
  }: {
    limit: number;
    windowMilliseconds: number;
    now?: number;
  },
): RateLimitResult => {
  const windowStart = now - windowMilliseconds;
  const bucket = buckets.get(key) ?? { timestamps: [] };
  sweepIfNeeded(bucket, windowStart);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterMs = oldest + windowMilliseconds - now;
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return {
    ok: true,
    remaining: limit - bucket.timestamps.length,
    retryAfterSeconds: 0,
  };
};

export const getClientIp = (request: Request): string => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
};
