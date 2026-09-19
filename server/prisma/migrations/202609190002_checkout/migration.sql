ALTER TABLE "orders" ADD COLUMN "checkout_key" UUID,
ADD COLUMN "checkout_hash" TEXT;
CREATE UNIQUE INDEX "orders_checkout_key_key" ON "orders"("checkout_key");
