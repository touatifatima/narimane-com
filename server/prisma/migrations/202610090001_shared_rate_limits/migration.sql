CREATE TABLE "rate_limit_buckets" (
  "key" TEXT PRIMARY KEY,
  "hits" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets" ("expires_at");
ALTER TABLE "rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "rate_limit_buckets" FROM anon, authenticated;
