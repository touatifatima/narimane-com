import { test, expect } from '@playwright/test';

for (const mode of ['url', 'upload', 'retry']) {
  test(`create product with ${mode}`, async ({ page }) => {
    let creates = 0, uploads = 0, saved;
    await page.route('**/api/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      let data = {};
      if (path.endsWith('/login')) data = { token: 'test', admin: { email: 'admin@example.com' } };
      else if (path.endsWith('/images')) {
        uploads++;
        if (mode === 'retry' && uploads === 1) return route.fulfill({ status: 500, json: { error: 'Import indisponible' } });
        expect(request.headers()['content-type']).toContain('multipart/form-data');
        data = { images: [{ id: 1, url: '/test.png' }] };
      } else if (path.endsWith('/products') && request.method() === 'POST') {
        creates++;
        saved = { ...request.postDataJSON(), id: 123 };
        expect(saved.is_active).toBe(mode === 'url');
        data = { product: saved };
      } else if (path.endsWith('/products/123') && request.method() === 'PATCH') {
        saved = { ...saved, ...request.postDataJSON() };
        data = { product: saved };
      } else if (path.endsWith('/products')) data = { products: [], pagination: { has_more: false } };
      else if (path.endsWith('/orders')) data = { orders: [], pagination: { has_more: false } };
      else data = { notifications: [], unread_count: 0, pagination: { has_more: false } };
      await route.fulfill({ json: data });
    });
    await page.goto('/admin');
    await page.getByLabel('Adresse e-mail').fill('admin@example.com');
    await page.getByLabel('Mot de passe').fill('password');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.getByRole('button', { name: 'Produits', exact: true }).click();
    await page.getByRole('button', { name: 'Ajouter un produit' }).click();
    await page.getByLabel('Nom', { exact: true }).fill('Test photo');
    await page.getByLabel('Prix (DA)').fill('2400');
    if (mode === 'url') await page.getByLabel('URL de la photo').fill('https://example.com/photo.png');
    else {
      await page.getByLabel('Importer une image', { exact: true }).check();
      await page.getByLabel('Choisir une photo').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64') });
      await expect(page.getByAltText('Aperçu de la photo du produit')).toBeVisible();
      expect(creates).toBe(0);
    }
    await page.getByRole('button', { name: 'Enregistrer le produit' }).click();
    if (mode === 'retry') {
      await expect(page.getByRole('alert')).toContainText('Finalisation incomplète');
      await page.getByRole('button', { name: 'Enregistrer le produit' }).click();
    }
    await expect(page.getByRole('heading', { name: 'Modifier la pièce' })).toBeVisible();
    expect(creates).toBe(1);
    expect(uploads).toBe(mode === 'url' ? 0 : mode === 'retry' ? 2 : 1);
    expect(saved.is_active).toBe(true);
    expect(saved.image_url).toBe(mode === 'url' ? 'https://example.com/photo.png' : '');
  });
}
