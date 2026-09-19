-- All monetary amounts are in Algerian dinars (DZD).
CREATE TABLE products (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0 AND price < 10000000000),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_variants (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  size TEXT NOT NULL CHECK (length(trim(size)) > 0),
  color TEXT NOT NULL CHECK (length(trim(color)) > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (product_id, size, color)
);

CREATE TABLE orders (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  customer_name TEXT NOT NULL CHECK (length(trim(customer_name)) > 0),
  phone TEXT NOT NULL CHECK (length(trim(phone)) > 0),
  wilaya TEXT NOT NULL CHECK (length(trim(wilaya)) > 0),
  commune TEXT NOT NULL CHECK (length(trim(commune)) > 0),
  address TEXT NOT NULL CHECK (length(trim(address)) > 0),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'cash_on_delivery'
    CHECK (payment_method = 'cash_on_delivery'),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0 AND subtotal < 10000000000),
  delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (delivery_fee >= 0 AND delivery_fee < 10000000000),
  total NUMERIC(13, 2) GENERATED ALWAYS AS (subtotal + delivery_fee) STORED,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  -- Preserve what was purchased even if the product is later edited.
  product_name TEXT NOT NULL CHECK (length(trim(product_name)) > 0),
  size TEXT NOT NULL CHECK (length(trim(size)) > 0),
  color TEXT NOT NULL CHECK (length(trim(color)) > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0 AND unit_price < 10000000000),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC GENERATED ALWAYS AS (unit_price * quantity) STORED
);

CREATE INDEX orders_status_created_at_idx ON orders(status, created_at DESC);
CREATE INDEX orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX order_items_order_id_idx ON order_items(order_id);
CREATE INDEX order_items_variant_id_idx ON order_items(variant_id);

CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
