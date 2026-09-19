ALTER TABLE "orders" DROP CONSTRAINT "orders_status_check";
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check"
  CHECK ("status" IN ('new', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'));
