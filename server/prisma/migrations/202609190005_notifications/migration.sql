CREATE TABLE "admin_notifications" (
  "id" SERIAL PRIMARY KEY,
  "order_id" INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "admin_notifications_order_id_idx" ON "admin_notifications"("order_id");
CREATE TABLE "notification_reads" (
  "notification_id" INTEGER NOT NULL REFERENCES "admin_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "admin_id" INTEGER NOT NULL REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("notification_id", "admin_id")
);
CREATE INDEX "notification_reads_admin_id_idx" ON "notification_reads"("admin_id");
