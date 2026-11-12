-- The last good answer per price cache key (prices.ts), so a restart keeps
-- serving prices without refetching them, and through an upstream outage.
CREATE TABLE price_cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  fetched_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
