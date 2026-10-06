// Fixed-window in-memory rate limiter. State lives per server instance (there is no database in v1),
// which is enough to blunt brute-force attempts and runaway refresh loops.

type Bucket = { count: number; resetAt: number };

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** Records a hit. Returns whether it is allowed and seconds until the window resets. */
  hit(key: string): { ok: boolean; retryAfter: number; remaining: number } {
    const t = this.now();
    let b = this.buckets.get(key);
    if (!b || b.resetAt <= t) {
      b = { count: 0, resetAt: t + this.windowMs };
      this.buckets.set(key, b);
    }
    b.count += 1;
    if (this.buckets.size > 10_000) this.sweep(t);
    const retryAfter = Math.max(1, Math.ceil((b.resetAt - t) / 1000));
    return { ok: b.count <= this.limit, retryAfter, remaining: Math.max(0, this.limit - b.count) };
  }

  reset() {
    this.buckets.clear();
  }

  private sweep(t: number) {
    for (const [k, b] of this.buckets) if (b.resetAt <= t) this.buckets.delete(k);
  }
}

const FIFTEEN_MIN = 15 * 60 * 1000;

/** 10 login attempts per IP per 15 minutes. */
export const loginLimiter = new RateLimiter(10, FIFTEEN_MIN);
/** Demo sign-ins never reach StudentVUE, so they get a looser, separate budget. */
export const demoLoginLimiter = new RateLimiter(100, FIFTEEN_MIN);
/** 30 gradebook calls per session per 15 minutes. */
export const gradebookLimiter = new RateLimiter(30, FIFTEEN_MIN);
/** Document list + downloads per session. */
export const documentsLimiter = new RateLimiter(60, FIFTEEN_MIN);
/** District lookups per IP. */
export const districtLimiter = new RateLimiter(30, FIFTEEN_MIN);

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
