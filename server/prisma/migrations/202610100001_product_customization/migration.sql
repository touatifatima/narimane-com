ALTER TABLE "products" ADD COLUMN "customization_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "customization_product_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "orders" ADD COLUMN "customization_image_url" TEXT;
