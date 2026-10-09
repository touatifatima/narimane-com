const { createHash } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');

// PostgreSQL counters are shared by every serverless instance. Store only hashes.
class PostgresStore {
  constructor(db, scope) {
    this.db = db;
    this.prefix = `${process.env.RATE_LIMIT_NAMESPACE || 'store'}:${scope}:`;
    this.localKeys = false;
  }
  init(options) { this.windowMs = options.windowMs; }
  key(value) { return createHash('sha256').update(this.prefix + value).digest('hex'); }
  async increment(value) {
    const key = this.key(value);
    const rows = await this.db.$queryRaw`
      INSERT INTO rate_limit_buckets (key, hits, expires_at)
      VALUES (${key}, 1, clock_timestamp() + ${this.windowMs} * interval '1 millisecond')
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN rate_limit_buckets.expires_at <= clock_timestamp() THEN 1 ELSE rate_limit_buckets.hits + 1 END,
        expires_at = CASE WHEN rate_limit_buckets.expires_at <= clock_timestamp()
          THEN clock_timestamp() + ${this.windowMs} * interval '1 millisecond' ELSE rate_limit_buckets.expires_at END
      RETURNING hits, expires_at`;
    // Bounded cleanup keeps expired counters from accumulating indefinitely.
    if (Math.random() < 0.01) {
      await this.db.$executeRaw`DELETE FROM rate_limit_buckets WHERE key IN
        (SELECT key FROM rate_limit_buckets WHERE expires_at < now() LIMIT 1000)`;
    }
    return { totalHits: rows[0].hits, resetTime: rows[0].expires_at };
  }
  async decrement(value) {
    await this.db.$executeRaw`UPDATE rate_limit_buckets SET hits = GREATEST(0, hits - 1) WHERE key = ${this.key(value)}`;
  }
  async resetKey(value) {
    await this.db.$executeRaw`DELETE FROM rate_limit_buckets WHERE key = ${this.key(value)}`;
  }
}

function limiter(db, scope, limit, windowMs, message) {
  return rateLimit({ store: new PostgresStore(db, scope), windowMs, limit,
    standardHeaders: 'draft-7', legacyHeaders: false, passOnStoreError: false,
    message: { error: message },
  });
}

module.exports = { PostgresStore, limiter };
