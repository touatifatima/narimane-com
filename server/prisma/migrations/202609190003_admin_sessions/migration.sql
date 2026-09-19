CREATE TABLE "admin_sessions" (
  "token_hash" TEXT PRIMARY KEY,
  "admin_id" INTEGER NOT NULL REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expires_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "admin_sessions_admin_id_idx" ON "admin_sessions"("admin_id");
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");
