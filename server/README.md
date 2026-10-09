# Server

Run commands from this directory. Keep the real DATABASE_URL in `.env`.

- `npm install`: install dependencies and generate Prisma Client.
- `npm run dev`: start Express with file watching.
- `npm run db:studio`: open Prisma's database editor.
- `npm run db:generate`: regenerate the client after schema changes.
- `npm run db:migrate -- --name describe_change`: create and apply a development migration.
- `npm run db:deploy`: apply committed migrations to a new database or deployment.
- `node scripts/check-db.js`: verify Prisma writes and calculated totals in a rolled-back transaction.

Models live in `prisma/schema.prisma`. The existing database was baselined with
`0_init`, so no existing application tables were reset. `schema_migrations` is
retained as legacy history; Prisma tracks new migrations in `_prisma_migrations`.

`admins` stores a normalized lowercase email and a password hash (never a plaintext
password). Create an account using `npm run admin:create` in an interactive terminal.
`delivery_rates` stores one DZD fee per wilaya code; disable an entry using
`is_active` when delivery is unavailable. Real rates still need to be entered.
Orders keep a copy of the checkout fee so later rate changes do not affect them.

The baseline SQL preserves PostgreSQL check constraints, identity columns, and
generated totals. Review future generated migration SQL before applying changes
to these features: Prisma does not fully model them. Do not supply `total` or
`line_total` when creating or updating orders; PostgreSQL calculates them.

The API is available at `/api/health`; database health is at `/api/health/db`.

## Product API

- `GET /api/products?page=1&limit=20`: active products, newest first. Maximum
  limit is 100. Returns `products` and `pagination` (`page`, `limit`, `has_more`).
- `GET /api/products/:id`: returns `product`, or 404 for missing/inactive products.
- Each product includes `variants` with ID, size, color, stock, and `available`.
  Inactive variants are hidden; zero-stock variants remain visible but unavailable.
- Prices are decimal strings (for example `"1900.50"`) with `currency: "DZD"`.
- Invalid IDs or pagination return 400. Unexpected failures return a generic 500.
- `npm run test:products` checks these routes against PostgreSQL in a transaction
  and rolls back its test records. Run against the local development database.

An empty product list is expected until real products and variants are entered.
Product creation and editing use the protected admin API described below.

## Checkout API

`GET /api/delivery-rates` returns active wilaya codes, names, and decimal-string
fees in DZD. Enter real delivery rates before accepting orders.

`POST /api/orders` accepts JSON with an `Idempotency-Key` header containing a
UUID v4 (the frontend can use `crypto.randomUUID()`). Keep that key for retries
of the same checkout; use a new key when starting a different checkout.

```json
{
  "customer_name": "Customer name",
  "phone": "0550000000",
  "wilaya_code": "16",
  "commune": "Customer commune",
  "address": "Delivery address",
  "notes": "Optional delivery instructions",
  "items": [
    { "variant_id": 1, "quantity": 2 },
    { "variant_id": 2, "quantity": 1 }
  ]
}
```

Use actual active variant IDs and a configured wilaya code. Prices, delivery fees,
and totals sent by the browser are ignored. Duplicate variant lines are combined.
Checkout allows up to 50 input lines and 99 units per variant. It returns 201 with
an `order` confirmation (reference, status, subtotal, delivery_fee, total, currency,
and payment_method). Retrying the same key and normalized payload returns 200
with the original confirmation. Reusing the key for changed data returns 409.

Stock is reserved immediately by decrementing it in the same serializable
transaction that creates the order. Failed checkouts roll back all stock changes.
Concurrent conflicts are retried up to three attempts; a 409 busy response can
be retried with the same key. Validation failures return 400, unavailable stock
or products return 409, and unavailable delivery returns 422.

Admin cancellation restores reserved stock exactly once before shipping.
Automatic reservation expiry and the frontend cart are not implemented yet.
No public endpoint exposes customer order lists or personal details.

`npm run test:orders` runs integration checks against the development database,
including simultaneous checkouts and retries. It removes only its own test records.

## Admin login and orders

Run `npm run admin:create` to enter an email and a hidden password (12–128
characters). No default admin is created. Passwords use salted scrypt via
[Node crypto](https://nodejs.org/download/release/v22.12.0/docs/api/crypto.html).

- `POST /api/admin/login`: JSON `{ "email": "...", "password": "..." }` returns
  a random session `token`, `expires_at`, and basic admin details.
- Send `Authorization: Bearer <token>` on all following admin requests.
- `GET /api/admin/me`: current admin.
- `POST /api/admin/logout`: revoke the current session.
- `GET /api/admin/orders?page=1&status=new&search=...`: paginated orders;
  optional search matches customer names or phone numbers.
- `GET /api/admin/orders/:id`: order and purchased items.
- `PATCH /api/admin/orders/:id/status`: JSON `{ "status": "confirmed" }`.

Allowed transitions: new → confirmed → shipped → delivered. New or confirmed
orders can also be cancelled. Cancelled/returned orders are final; shipped
or delivered orders can be marked returned after physical receipt of the return. Repeating the current status is
safe. Concurrent cancellations cannot restore stock more than once.

Sessions expire after eight hours and only token hashes are stored in PostgreSQL.
Inactive admins cannot use existing sessions. Keep tokens in frontend memory,
not persistent browser storage, and use HTTPS when deployed. Login is limited
to ten requests per IP per fifteen minutes for this single-server setup; configure
a shared limiter and trusted proxy settings if deployment later needs them.

`npm run test:admin` verifies authentication, expiry, revocation, authorization,
login throttling and cancellation. Tests remove only their own records.
The React dashboard is available at `http://localhost:5173/admin`.

Authenticated delivery settings:
- `GET /api/admin/delivery-rates` lists active and inactive rates.
- `PUT /api/admin/delivery-rates` upserts a rate with `wilaya_code`,
  `wilaya_name`, `fee`, and boolean `is_active`. Numeric codes are normalized
  (for example `1` becomes `01`). Existing order fees remain unchanged.

## Admin products

All these routes require the admin Bearer token:

- `GET /api/admin/products?page=1&search=...`: list products, including inactive
  products and variants. Twenty products per page.
- `GET /api/admin/products/:productId`: full product details.
- `POST /api/admin/products`: create a product and its variants atomically.
- `PATCH /api/admin/products/:productId`: change name, description, price,
  image_url, or is_active. Setting is_active to false hides the product.
- `POST /api/admin/products/:productId/variants`: add size, color, stock and
  optional is_active. Sizes are normalized to uppercase and colors to lowercase.
- `PATCH /api/admin/products/:productId/variants/:variantId`: edit size,
  color or is_active. Duplicate size/color combinations return 409.
- `PATCH /api/admin/products/:productId/variants/:variantId/stock`: send
  `{ "stock": 10, "expected_stock": 4 }` to set available stock to 10 only if it
  is still 4. A stale count returns 409; refresh before retrying.

Example product creation:

```json
{
  "name": "Classic T-shirt",
  "description": "Cotton T-shirt",
  "price": "1900.00",
  "image_url": "https://example.com/tshirt.jpg",
  "variants": [
    { "size": "M", "color": "Black", "stock": 10 },
    { "size": "L", "color": "Black", "stock": 5 }
  ]
}
```

Replace the example URL with your own image URL, or upload local photos below.
Use deactivation instead of deletion to preserve order history. Existing orders
retain purchased names, sizes, colors and prices after product edits.
The admin tests cover validation, duplicate variants, deactivation, stale stock
edits and preservation of order details.

## Product photos

The `product_images` table stores uploaded image URLs and display order. Existing
`products.image_url` values remain as a fallback when no uploads exist. Uploaded
photos take priority on the public product API; the first photo is the cover.

Authenticated endpoints:
- `POST /api/admin/products/:productId/images`: multipart field `images`, up to
  six uploaded photos total per product. The client sends one file per request,
  with a 3.5 MiB limit, to stay below Vercel's Function request-body limit.
- `PATCH /api/admin/products/:productId/images/:imageId/main`: select cover photo.
- `DELETE /api/admin/products/:productId/images/:imageId`: delete a photo and file.

JPG/PNG/WebP files are checked by decoding, limited to 25 megapixels, stripped of
metadata and converted to WebP up to 1800 pixels. Animated images are rejected.
Uploads use [Multer](https://expressjs.com/en/resources/middleware/multer/) and
[Sharp](https://sharp.pixelplumbing.com/api-constructor/).
Photo mutations lock the product row to enforce the total during concurrent uploads.

When `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID`, or the Vercel runtime is present,
processed images are stored in public Vercel Blob storage and their permanent URLs
are saved in PostgreSQL. Local development falls back to
`server/uploads/products` (excluded from Git), served at `/api/uploads/products`.
Legacy external image URLs are not deleted when removing uploaded images.

## Vercel deployment

The Vercel function entry point is `api/index.js`. `vercel-build` applies committed
Prisma migrations to the connected Supabase database. Connect the Supabase and
Vercel Blob resources to the backend project before deploying; their managed
environment variables are used automatically. The production frontend proxies
same-origin `/api/*` requests to the backend through `client/vercel.json`.

### Supabase Storage for deployment

Create a public bucket named `product-images` in Supabase Storage. Then add these
variables to the server environment (the service-role key belongs only on the
server, never in the React client):

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=product-images
```

When these variables exist, uploads and deletes use Supabase Storage and database
rows contain public Supabase URLs. Without them, local development keeps using
`server/uploads/products`. The bucket should be public for customer reads, while
the service-role key keeps writes behind the authenticated admin API. Do not add
anonymous upload or delete policies. Supabase Storage bucket-level restrictions
should allow `image/jpeg`, `image/png`, and `image/webp`, with a 5 MiB limit.

Installation audit reported four high-severity entries in Prisma CLI transitive
dependencies (deepmerge-ts and mysql2 and their dependents). No forced major
downgrade or dependency override was applied. Review upstream fixes before deployment.


## Admin notifications and parcel returns

The dashboard bell polls every 15 seconds while its panel is closed and the tab
is visible. Opening it refreshes the list; an open panel has an explicit refresh
button. Notifications are persistent database records, with independent read
receipts for each admin. Clicking a notification marks it read and opens the order.
These are in-app notifications, not email, SMS or operating-system push alerts.

Authenticated routes:
- `GET /api/admin/notifications?before=<id>`: 30 newest events, unread count,
  and a cursor for older entries.
- `PATCH /api/admin/notifications/:id/read`: mark one event read for this admin.
- `PATCH /api/admin/notifications/read-all`: body `{ "through": 123 }` marks
  events through the displayed latest ID read, preserving newer arrivals.

New checkout orders and actual status transitions create events in the same
transaction as the order change. Retrying checkout or repeating the same status
creates no duplicate notification. Previous orders are not backfilled.

`shipped` or `delivered` → `returned` is allowed only when the admin confirms the
parcel has physically returned. It restores all ordered quantities once, like
cancellation. `returned` is final. This assumes a complete, resellable return;
partial/damaged returns and carrier integration are not implemented. A failed
delivery attempt alone must not be marked returned. No automatic carrier updates.

## Launch hardening (October 2026)

Run migrations before starting the updated backend. The rate_limit_buckets table
uses RLS and has no anon/authenticated grants. Login allows 10 attempts per IP
per 15 minutes; checkout allows 20 per IP per 15 minutes. Counters are atomic and
shared through PostgreSQL across Vercel instances. This reduces automated abuse;
it does not verify that a cash-on-delivery order is genuine. Database failures
fail closed. RATE_LIMIT_NAMESPACE isolates test runs; leave it unset in production.
Expired counters are removed opportunistically. Run npm run test:rate-limits.

Photos are limited to 3.5 MiB each and the frontend uploads one at a time. The
API rejects requests above 4 MiB when Content-Length is available, below Vercel's
request cap. Supabase Storage must be configured on Vercel; filesystem uploads
are for local development only.

The frontend proxy targets https://tshirt-ecommerce-server.vercel.app. Keep
VITE_API_URL unset to use this proxy, or set it to that same backend URL. Set
CLIENT_URL on the backend to https://tshirt-ecommerce-client.vercel.app.
Deploy backend first, then frontend, and verify checkout and admin login.
Use separate databases for preview deployments; builds apply migrations.

Never put working credentials in .env.example. Rotate any credential copied
there and update both the local .env and Vercel backend environment.
Dependency overrides pin patched deepmerge-ts and mysql2 transitive packages
until Prisma incorporates those releases; recheck them when upgrading Prisma.
