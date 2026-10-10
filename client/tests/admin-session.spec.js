import { test, expect } from '@playwright/test';

for (const ending of ['logout', 'expiry', 'revoked']) {
  test(`admin survives refresh and clears session on ${ending}`, async ({ page }) => {
    const token = 'a'.repeat(64);
    let revoked = false;
    await page.route('**/api/admin/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/login')) return route.fulfill({ json: {
        token, expires_at: new Date(Date.now() + 3600000).toISOString(), admin: { email: 'admin@example.com' },
      } });
      expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
      if (revoked) return route.fulfill({ status: 401, json: { error: 'Session expired' } });
      if (path.endsWith('/logout')) return route.fulfill({ status: 204 });
      await route.fulfill({ json: { orders: [], notifications: [], unread_count: 0, pagination: { has_more: false } } });
    });
    await page.goto('/admin');
    await page.getByLabel('Adresse e-mail').fill('admin@example.com');
    await page.getByLabel('Mot de passe').fill('password');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('button', { name: 'Produits', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Produits', exact: true })).toBeVisible();
    if (ending === 'logout') await page.getByRole('button', { name: 'Déconnexion' }).click();
    else if (ending === 'revoked') revoked = true;
    else await page.evaluate(() => {
      const saved = JSON.parse(sessionStorage.getItem('thread-admin-session'));
      saved.expires_at = '2000-01-01T00:00:00Z';
      sessionStorage.setItem('thread-admin-session', JSON.stringify(saved));
    });
    if (ending === 'logout') await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('thread-admin-session'))).toBeNull();
  });
}
