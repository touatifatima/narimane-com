CREATE TABLE "product_images" (
  "id" SERIAL PRIMARY KEY,
  "product_id" INTEGER NOT NULL REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "product_images_product_id_position_idx" ON "product_images"("product_id", "position");
