<div align="center">

# THREAD.

**Les essentiels. Tout simplement.**

A minimalist T-shirt storefront built for Algeria, with a French shopping experience,
cash-on-delivery checkout, and a dedicated store-management dashboard.

[Explore the live storefront](https://tshirt-ecommerce-client.vercel.app) · [Quick start](#quick-start) · [Configuration](#configuration) · [Deployment](#deployment)

**React 19 · Vite · Express 5 · PostgreSQL · Prisma · Supabase Storage**

</div>

![THREAD. desktop storefront with warm editorial photography and French navigation](docs/images/storefront-desktop.png)

<details>
<summary>View the mobile storefront</summary>

<p align="center">
  <img src="docs/images/storefront-mobile.png" alt="THREAD. mobile storefront with responsive navigation and cash-on-delivery information" width="320" />
</p>

</details>

*Actual screenshots of the public live storefront, captured on October 10, 2026.
The deployed design may be ahead of the code on this repository's default branch.
Hero photography is decorative; it does not represent available inventory.*

## What you can do

### Shop

- Browse a responsive storefront with an editorial hero slideshow and collection pages.
- Explore product photos and choose available size and color variants.
- Search and sort loaded products, with pagination to discover more.
- Keep a shopping cart across visits using local browser storage.
- Check out in French with prices in Algerian dinars (DZD), wilaya-based delivery fees, and payment on delivery.
- Receive an order confirmation after the server verifies prices and available stock.

### Manage the store

- Sign in at `/admin` with an administrator account created from the command line.
- Create and edit products, variants, stock, visibility, and product photos.
- Configure delivery fees and availability by wilaya.
- Search orders and move them through confirmation, shipping, and delivery.
- Cancel eligible orders or record a received return, restoring stock once.
- Follow new orders and status changes through in-app notifications with per-admin read state.

### Behind the checkout

Order creation and stock reservation run in a database transaction. Checkout retries
reuse an idempotency key to avoid duplicate orders. The server calculates prices and
delivery fees, and orders retain a snapshot of purchased items and charges.
Admin passwords are hashed; session tokens are kept in browser memory and require
sign-in again after a refresh.

## Stack and structure

| Layer | Technology |
| --- | --- |
| Storefront and admin | React 19, Vite, CSS, Lucide icons |
| HTTP API | Node.js 22, Express 5 |
| Database | PostgreSQL with Prisma ORM and committed SQL migrations |
| Product photos | Supabase Storage; local filesystem fallback for development; Sharp image processing |
| Browser checks | Playwright |
| Hosting configuration | Vercel frontend/backend projects; optional Render blueprint |

```text
tshirt-ecommerce/
├── client/
│   ├── public/images/       # Storefront hero artwork
│   ├── src/                # Storefront, cart, checkout, and admin UI
│   ├── tests/              # Playwright browser checks
│   └── vercel.json         # API proxy and admin route rewrites
├── server/
│   ├── api/                # Vercel serverless entry point
│   ├── routes/             # Public and authenticated API routes
│   ├── prisma/             # Database schema and migrations
│   ├── scripts/            # Admin setup, delivery seed, and integration checks
│   └── storage.js          # Product image storage
├── docs/images/            # README screenshots
└── render.yaml             # Alternative Render deployment blueprint
```

## Quick start

You need **Node.js 22.x**, npm, Git, and a running PostgreSQL database.
Create an empty database named `tshirt_store` before applying migrations.
Supabase Storage is optional for local development.

### 1. Clone and install

```sh
git clone https://github.com/touatifatima/tshirt-ecommerce.git
cd tshirt-ecommerce
cd server
npm ci
cd ../client
npm ci
cd ..
```

### 2. Configure the server

Copy `server/.env.example` to `server/.env`. In PowerShell:

```powershell
Copy-Item server/.env.example server/.env
```

For a local database, use these values and replace the password:

```dotenv
PORT=3000
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/tshirt_store
```

Use your PostgreSQL instance's actual port; the example file may use `5433`.
For local filesystem photo uploads, remove or leave empty both `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` in your `.env`. Placeholder strings enable Supabase mode
and must not be left as working configuration.

### 3. Initialize the database and admin

```sh
cd server
npm run db:deploy
npm run admin:create
```

The interactive admin command asks for an email and a hidden password of 12–128
characters. No default admin account is created.

Optionally populate the delivery settings:

```sh
npm run db:seed-rates
```

The seed includes 69 wilaya entries from the project's list. It creates missing
entries with a **600 DZD starting fee** and enables all listed entries, including
existing ones. Review fees and delivery availability in the admin dashboard before
accepting orders. Products must be added through the dashboard; there is no demo
inventory seed.

### 4. Start both apps

In one terminal, from the repository root:

```sh
cd server
npm run dev
```

In a second terminal, from the repository root:

```sh
cd client
npm run dev
```

| Destination | Local URL |
| --- | --- |
| Storefront | http://localhost:5173 |
| Admin dashboard | http://localhost:5173/admin |
| API health | http://localhost:3000/api/health |
| Database health | http://localhost:3000/api/health/db |

Vite forwards `/api` requests to port `3000` by default. Add products, variants,
stock, and delivery rates in the dashboard to complete the shopping flow.

## Configuration

Server values belong in `server/.env` locally or in your backend host's environment settings.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string, including any provider-required SSL options |
| `PORT` | Local API port; defaults to `3000` |
| `CLIENT_URL` | Allowed frontend origin; defaults to `http://localhost:5173` |
| `SUPABASE_URL` | Supabase project URL for hosted product photos |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase key for photo uploads and deletion |
| `SUPABASE_STORAGE_BUCKET` | Public image bucket name; defaults to `product-images` |

Create the public storage bucket before uploading photos with Supabase enabled.
Keep credentials out of Git and out of frontend variables.

Frontend configuration is optional: set `VITE_API_URL` in `client/.env` to call a
separate backend directly. Leave it empty to use the `/api` proxy. Vite reads this
value at build time, so rebuild after changing it. For a different local API port,
set `API_PROXY_TARGET` in the environment when starting Vite.

## Useful commands

Run each command from the directory shown.

| Directory | Command | Purpose |
| --- | --- | --- |
| `client` | `npm run dev` | Start the frontend development server |
| `client` | `npm run build` | Build the frontend into `client/dist` |
| `client` | `npm run preview` | Preview the frontend build; requires an accessible API configuration |
| `server` | `npm start` | Start the API without file watching |
| `server` | `npm run db:deploy` | Apply committed migrations |
| `server` | `npm run db:migrate -- --name describe_change` | Create a development migration |
| `server` | `npm run db:generate` | Regenerate Prisma Client |
| `server` | `npm run db:studio` | Open the database editor |

### Checks

Use a separate development/test database. These checks access PostgreSQL and some
create temporary records, so configure `server/.env` accordingly.

```sh
cd server
npm run test:products
npm run test:orders
npm run test:admin
```

For browser checks, from the repository root:

```sh
cd client
npx playwright install chromium
npm run test:e2e
```

Playwright starts the API on port `3098` and Vite on `5180`. Leave both ports free.
The suite covers storefront and admin behavior and writes artifacts to `client/test-results`.

## Deployment

The repository includes Vercel configurations for two projects:

1. **Backend:** select `server` as the root directory, configure the database and
   Supabase variables, and set `CLIENT_URL` to your frontend's origin. The
   `vercel-build` script applies database migrations.
2. **Frontend:** select `client` as the root directory, build with `npm run build`,
   and use `dist` as the output directory.
3. **Connect them:** update the `/api/:path*` destination in `client/vercel.json`
   to your backend URL. The checked-in destination is project-specific. Alternatively,
   set `VITE_API_URL` before building and configure backend `CLIENT_URL` accordingly.
4. **Verify:** check `/api/health/db`, sign in at `/admin`, then verify products,
   photo uploads, delivery settings, and an intentional test order.

Use Supabase Storage for Vercel photo uploads; local files are not persistent there.
Use a separate database for preview deployments because builds run migrations.
The `/admin` rewrite supports direct navigation to the dashboard; API authentication
controls access to store data.

For a single-service setup, build `client/dist` before starting the server. Express
serves that build when it exists. `render.yaml` provides an alternative deployment
blueprint; configure persistent image storage for that host as well.

## Scope

The store currently uses **cash on delivery**. It has no online card-payment gateway,
customer accounts, or carrier tracking integration. Notifications are inside the
admin dashboard. Returns represent complete, resellable orders received back by
the store; partial and damaged returns are not modeled.

For endpoint details and database notes, see [the server documentation](server/README.md).
For UI behavior and artwork notes, see [the client documentation](client/README.md).

---

Built by [@touatifatima](https://github.com/touatifatima).
