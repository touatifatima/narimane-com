CREATE TABLE "admins" (
  "id" SERIAL PRIMARY KEY,
  "email" TEXT NOT NULL CHECK (length(trim("email")) > 0 AND "email" = lower(trim("email"))),
  "password_hash" TEXT NOT NULL CHECK (length(trim("password_hash")) > 0),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

CREATE TABLE "delivery_rates" (
  "id" SERIAL PRIMARY KEY,
  "wilaya_code" TEXT NOT NULL CHECK (length(trim("wilaya_code")) > 0),
  "wilaya_name" TEXT NOT NULL CHECK (length(trim("wilaya_name")) > 0),
  "fee" DECIMAL(12,2) NOT NULL CHECK ("fee" >= 0 AND "fee" < 10000000000),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "delivery_rates_wilaya_code_key" ON "delivery_rates"("wilaya_code");
