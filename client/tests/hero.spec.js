import { test, expect } from '@playwright/test';

test('hero rotates, pauses and supports manual navigation', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const first = page.getByRole('button', { name: 'Afficher l’image 1' });
  const second = page.getByRole('button', { name: 'Afficher l’image 2' });
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await page.clock.runFor(6200);
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.hero').hover();
  await page.clock.runFor(6200);
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Activer le défilement automatique' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Image suivante' }).click();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const image of await page.locator('.hero-slide').all()) {
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  }
});

test('hero respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Afficher l’image 1' })).toHaveAttribute('aria-pressed', 'true');
  await page.clock.runFor(12500);
  await expect(page.getByRole('button', { name: 'Afficher l’image 1' })).toHaveAttribute('aria-pressed', 'true');
});
