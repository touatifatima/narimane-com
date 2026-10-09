import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const db = require('../../server/db');
const { hashPassword } = require('../../server/lib/passwords');
const sharp = require('../../server/node_modules/sharp');
const marker = `Browser-${randomUUID()}`;
const password = randomUUID();
let admin, product, rate;

test.beforeAll(async () => {
  admin = await db.admins.create({ data: { email: `${marker.toLowerCase()}@example.invalid`, password_hash: await hashPassword(password) } });
  product = await db.products.create({ data: { name: marker, price: 1900, image_url: '/images/thread-hero.png', description: 'Un T-shirt pour tester la boutique.', product_variants: { create: [{ size: 'M', color: 'black', stock: 10 }, { size: 'L', color: 'black', stock: 0 }] } }, include: { product_variants: true } });
  const existingRates = await db.delivery_rates.findMany({ select: { wilaya_code: true } });
  const usedCodes = new Set(existingRates.map(r => r.wilaya_code));
  const testCode = Array.from({ length: 100 }, (_, i) => String(900 + i)).find(code => !usedCodes.has(code));
  if (!testCode) throw new Error('No free delivery test code.');
  rate = await db.delivery_rates.create({ data: { wilaya_code: testCode, wilaya_name: marker, fee: 450 } });
});
test.afterAll(async () => {
  await db.$transaction(async tx => {
    const orders = await tx.orders.findMany({ where: { customer_name: marker }, select: { id: true } });
    await tx.order_items.deleteMany({ where: { order_id: { in: orders.map(o => o.id) } } });
    await tx.orders.deleteMany({ where: { customer_name: marker } });
    if (product) { await tx.product_variants.deleteMany({ where: { product_id: product.id } }); await tx.products.delete({ where: { id: product.id } }); }
    const extras = await tx.products.findMany({ where: { name: `${marker}-created` } });
    for (const extra of extras) { await tx.product_variants.deleteMany({ where: { product_id: extra.id } }); await tx.products.delete({ where: { id: extra.id } }); }
    if (rate) await tx.delivery_rates.delete({ where: { id: rate.id } });
    if (admin) await tx.admins.delete({ where: { id: admin.id } });
  });
  await db.$disconnect();
});
test('desktop cart, checkout and admin order flow', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('a[href*="admin"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Les essentiels. Tout simplement.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  await page.goto(`/#/product/${product.id}`);
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await expect(page.getByRole('button', { name: 'L', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Ajouter au panier' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: `Augmenter ${marker}` }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Ouvrir le panier, 2 articles' }).click();
  await page.getByRole('link', { name: 'Passer commande' }).click();
  await page.getByLabel('Nom complet').fill(marker);
  await page.getByLabel('Téléphone').fill('0550000000');
  await page.getByLabel('Wilaya', { exact: true }).selectOption(rate.wilaya_code);
  await page.getByLabel('Commune', { exact: true }).fill('Test');
  await page.getByLabel('Adresse complète').fill('Adresse de test');
  await page.getByRole('button', { name: /Confirmer ma commande/ }).click();
  await expect(page.getByRole('heading', { name: 'Vos essentiels sont réservés.' })).toBeVisible();
  const order = await db.orders.findFirst({ where: { customer_name: marker } });
  expect(order.total.toString()).toBe('4250');
  await page.goto('/admin');
  await page.getByLabel('Adresse e-mail').fill(admin.email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Les commandes' })).toBeVisible();
  await page.getByRole('button', { name: /Notifications, .* non lues/ }).click();
  await page.locator('.notification-item').filter({ hasText: `Commande #${order.id}` }).click();
  await expect(page.getByRole('heading', { name: `Commande #${order.id}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Marquer : Confirmée' }).click();
  await expect(page.getByRole('button', { name: 'Marquer : Expédiée' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Annuler la commande' }).click();
  await expect(page.locator('.admin-detail .badge')).toHaveText('Annulée');
  await page.getByRole('button', { name: 'Produits', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter un produit' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(`${marker}-created`);
  await page.getByLabel('Prix (DA)').fill('2400');
  await page.getByRole('button', { name: 'Enregistrer le produit' }).click();
  await expect(page.getByRole('heading', { name: 'Photos du produit' })).toBeVisible();
  const imageBuffer = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#889977' } }).png().toBuffer();
  await page.getByLabel('Ajouter des photos').setInputFiles([
    { name: 'front.png', mimeType: 'image/png', buffer: imageBuffer },
    { name: 'back.png', mimeType: 'image/png', buffer: imageBuffer },
  ]);
  await page.getByRole('button', { name: 'Importer 2 photo(s)' }).click();
  await expect(page.getByRole('button', { name: 'Photo principale', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Supprimer', exact: true })).toHaveCount(2);
  const uploaded = await db.products.findFirst({ where: { name: `${marker}-created` }, include: { images: { orderBy: { position: 'asc' } } } });
  const imageResponse = await page.request.get(uploaded.images[0].url);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()['content-type']).toContain('image/webp');
  await page.getByRole('button', { name: 'Définir comme principale' }).click();
  await expect.poll(async () => (await db.product_images.findFirst({ where: { product_id: uploaded.id }, orderBy: { position: 'asc' } })).id).toBe(uploaded.images[1].id);
  const storefront = await page.context().newPage();
  await storefront.goto(`/#/product/${uploaded.id}`);
  await expect(storefront.getByRole('button', { name: 'Voir la photo 2' })).toBeVisible();
  await storefront.getByRole('button', { name: 'Voir la photo 2' }).click();
  await expect(storefront.getByRole('button', { name: 'Voir la photo 2' })).toHaveAttribute('aria-pressed', 'true');
  await storefront.getByRole('button', { name: 'Photo précédente' }).click();
  await expect(storefront.getByRole('button', { name: 'Voir la photo 1' })).toHaveAttribute('aria-pressed', 'true');
  // Wait for smooth scrolling to settle before beginning a mouse drag.
  await expect.poll(() => storefront.locator('.gallery-track').evaluate(el => Math.round(el.scrollLeft))).toBe(0);
  const gallery = await storefront.locator('.gallery-track').boundingBox();
  await storefront.mouse.move(gallery.x + gallery.width * 0.8, gallery.y + gallery.height * 0.4);
  await storefront.mouse.down();
  await storefront.mouse.move(gallery.x + gallery.width * 0.2, gallery.y + gallery.height * 0.4, { steps: 12 });
  await storefront.mouse.up();
  await expect(storefront.getByRole('button', { name: 'Voir la photo 2' })).toHaveAttribute('aria-pressed', 'true');
  await storefront.locator('.gallery-track').focus();
  await storefront.keyboard.press('ArrowLeft');
  await expect(storefront.getByRole('button', { name: 'Voir la photo 1' })).toHaveAttribute('aria-pressed', 'true');
  await storefront.close();
  const unauthorized = await page.request.post(`/api/admin/products/${uploaded.id}/images`, { multipart: { images: { name: 'test.png', mimeType: 'image/png', buffer: imageBuffer } } });
  expect(unauthorized.status()).toBe(401);
  const auth = await page.request.post('/api/admin/login', { data: { email: admin.email, password } });
  const token = (await auth.json()).token;
  const invalid = await page.request.post(`/api/admin/products/${uploaded.id}/images`, { headers: { Authorization: `Bearer ${token}` }, multipart: { images: { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not an image') } } });
  expect(invalid.status()).toBe(400);
  for (let i = 0; i < 2; i++) {
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Supprimer', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Supprimer', exact: true })).toHaveCount(1 - i);
  }
  // Public storage URLs can remain cached after deletion. Check the source of truth.
  expect(await db.product_images.count({ where: { product_id: uploaded.id } })).toBe(0);
  for (const photo of uploaded.images) {
    if (photo.url.includes('/storage/v1/object/public/product-images/')) {
      const key = decodeURIComponent(photo.url.split('/storage/v1/object/public/product-images/')[1]);
      expect(await db.$queryRaw`SELECT name FROM storage.objects WHERE bucket_id = 'product-images' AND name = ${key}`).toHaveLength(0);
    } else {
      expect((await page.request.get(photo.url)).status()).toBe(404);
    }
  }
  const batch = new FormData();
  for (let i = 0; i < 6; i++) batch.append('images', new Blob([imageBuffer], { type: 'image/png' }), `photo-${i}.png`);
  const six = await fetch(`http://localhost:5180/api/admin/products/${uploaded.id}/images`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: batch });
  expect(six.status).toBe(201);
  const sixImages = (await six.json()).images;
  const seventh = await page.request.post(`/api/admin/products/${uploaded.id}/images`, { headers: { Authorization: `Bearer ${token}` }, multipart: { images: { name: 'seventh.png', mimeType: 'image/png', buffer: imageBuffer } } });
  expect(seventh.status()).toBe(409);
  for (const photo of sixImages) expect((await page.request.delete(`/api/admin/products/${uploaded.id}/images/${photo.id}`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200);
  const oversized = await page.request.post(`/api/admin/products/${uploaded.id}/images`, { headers: { Authorization: `Bearer ${token}` }, multipart: { images: { name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) } } });
  expect(oversized.status()).toBe(413);
  await page.getByRole('button', { name: 'Retour aux produits' }).click();
  await expect(page.getByRole('cell', { name: `${marker}-created`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Livraison', exact: true }).click();
  await expect(page.getByRole('cell', { name: `${rate.wilaya_code} — ${marker}` })).toBeVisible();
  await page.getByLabel('Code wilaya').fill(rate.wilaya_code);
  await page.getByLabel('Nom', { exact: true }).fill(marker);
  await page.getByLabel('Frais (DA)').fill('550');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const rateRow = page.getByRole('row').filter({ hasText: marker });
  await expect(rateRow.getByRole('cell', { name: '550 DA', exact: true })).toBeVisible();
  await rateRow.getByRole('button', { name: 'Désactiver', exact: true }).click();
  await expect(rateRow.getByRole('cell', { name: 'Désactivée', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('mobile navigation, cart focus and layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('a[href*="admin"]')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'La collection' }).click();
  await expect(page.getByRole('heading', { name: 'Les T-shirts' })).toBeVisible();
  await page.goto(`/#/product/${product.id}`);
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter au panier' }).click();
  await expect(page.getByRole('button', { name: 'Fermer le panier' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

