# THREAD. React storefront

The supplied HTML and visual reference are adapted into React components, with
French copy, DA pricing, a persistent cart, payment on delivery, and a private
admin dashboard. No demo inventory or delivery prices are inserted into your store.

## Run locally

Start the API in one terminal:

```powershell
cd server
npm run dev
```

Start the frontend in another terminal, from the project root:

```powershell
cd client
npm install
npm run dev
```

Open http://localhost:5173. The admin page is http://localhost:5173/admin.
Create your admin account with `npm run admin:create` from `server` if needed.
Use the dashboard to add product photos, sizes, colors, stock and actual delivery
fees. Product photos support local uploads and legacy URLs. Missing photos have
an explicit placeholder. The decorative hero is not a representation of inventory.

## Pages and behavior

- Home, collection, product detail, about, cart drawer, checkout and confirmation.
- Mobile navigation, keyboard-accessible cart dialog, loading and error states.
- Cart is saved in localStorage. Checkout retries reuse a UUID key in sessionStorage.
- Admin tokens stay in memory: refreshing requires login again.
- Orders: search/filter, detail, status updates, cancellation before shipping.
- Products: create/edit, variants, activation and safe stock updates.
- Photos: after saving a new product, select local files in its editor, preview,
  upload, choose a cover, or remove them. Up to six JPG/PNG/WebP photos at 5 MiB
  each. The public product detail shows selectable thumbnails.
- Delivery: set fees by wilaya code, enable/disable delivery.
- Collection search/sorting applies to loaded products; load more to expand it.
- Actual prices and availability are verified by the backend at checkout.

`npm run build` creates `dist`. For deployment serve the API under `/api` on the
same origin, or configure `VITE_API_URL` before building and set server `CLIENT_URL`
to the frontend origin. Google Fonts has system/Georgia fallbacks.

## Checks

```powershell
npx playwright install chromium
npm run test:e2e
```

Tests use the configured development PostgreSQL database and temporary API/Vite
ports 3098/5180. They create uniquely named fixtures and remove only those records.
Desktop/mobile screenshots are written to `test-results`.

## Hero artwork

Built-in imagegen tool, saved as `public/images/thread-hero.png`.
Final generation prompt:

> Create a photorealistic fashion editorial banner image for a minimalist T-shirt store. Wide landscape 3:2 composition, warm neutral cream studio wall, soft daylight and subtle film grain. Adult male model with dark curly hair wearing a plain premium ivory oversized cotton T-shirt and beige trousers, seated casually, positioned on the RIGHT half, cropped from upper thighs upward, looking off camera. LEFT half mostly empty warm beige wall for text overlay. Restrained tasteful contemporary clothing campaign, natural fabric folds, realistic anatomy. No text, no logos, no watermark. This is a decorative website hero photo, not a product listing.

The product gallery scrolls horizontally with touch/trackpad, mouse dragging, arrows, keyboard arrow keys and thumbnails. It respects reduced-motion preferences and shows the current photo count.

Admin login uses the dedicated /admin path with its own layout and lazy-loaded code. The storefront has no admin links or customer login. Configure the production host to serve index.html for /admin (SPA fallback). The URL itself is public; authenticated server-side API checks enforce admin-only access.


## Hero slideshow

The homepage crossfades between two local images every six seconds. Hover, keyboard
focus, a hidden browser tab, or reduced-motion preferences stop autoplay. Manual
navigation pauses autoplay until the play control is used.

Second image generated with the built-in imagegen tool, saved to
`public/images/thread-hero-olive.png`. Final prompt:

> Photorealistic premium minimalist fashion campaign banner, landscape 3:2. Warm cream and pale stone studio, soft natural sunlight, subtle film texture. Adult female model with dark hair wearing a plain olive green oversized cotton T-shirt and cream trousers, relaxed standing pose, on RIGHT third of frame, looking away naturally. LEFT half empty warm light beige wall for black website text overlay. Restrained elegant editorial look, realistic fabric and anatomy. No text, logos, watermarks. Decorative homepage hero for a neutral minimalist T-shirt shop.

Admin notifications: the bell shows new orders and status changes with unread
counts. Notifications are refreshed every 15 seconds while the panel is closed;
clicking opens the related order. Read state persists independently per admin.
Shipped/delivered orders can be marked returned after confirming physical receipt;
the backend restores stock once and records the event.
