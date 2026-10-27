import { expect, test } from '@playwright/test';
import { desktopFixture, openSettings } from './desktop-fixture';

test('Photos starts first, one toolbar owns view controls, and About contains only product details', async ({ page }) => {
  await desktopFixture(page, { gallery: true, settings: { startupView: 'cloud', startupViewVersion: 0 } });
  await page.goto('/');
  await expect(page).toHaveTitle('Teragram');
  await expect(page.locator('.cloud-content-heading h1')).toHaveText('Photos');
  await expect(page.locator('.cloud-files-heading h2')).toHaveCount(0);
  expect(await page.locator('.cloud-sidebar nav > button').first().getAttribute('aria-label')).toBe('Photos');
  await expect(page.locator('.cloud-header').getByRole('button', { name: 'Search filters', exact: true })).toHaveCount(0);
  await page.locator('.cloud-workspace-toolbar').getByRole('button', { name: 'Search filters', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Search scope', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await openSettings(page);
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await dialog.getByRole('button', { name: 'About', exact: true }).click();
  await expect(dialog).toContainText('Teragram');
  await expect(dialog).not.toContainText(/Cameron|caamer|One\s+Gram/);
  await expect(dialog.locator('a')).toHaveCount(0);
});

test('docked navigation remains visible and collapses to a persisted rail', async ({ page }, testInfo) => {
  await desktopFixture(page, { gallery: true, theme: 'dark', settings: { floatSidebar: true, sidebarCollapsed: false } });
  await page.goto('/');
  const sidebar = page.locator('.cloud-sidebar');
  await expect(sidebar).toHaveCSS('width', '248px');
  const surface = await page.locator('.cloud-sidebar-surface').boundingBox();
  const workspace = await page.locator('.cloud-workspace').boundingBox();
  expect(surface!.x + surface!.width).toBeLessThanOrEqual(workspace!.x);
  await page.mouse.move(950, 500);
  await expect(sidebar).toBeVisible();
  await page.locator('.cloud-brand').hover();
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await expect(sidebar).toHaveCSS('width', '68px');
  await expect(page.locator('.cloud-nav-label')).not.toBeVisible();
  await page.reload();
  await expect(sidebar).toHaveCSS('width', '68px');
  await expect(sidebar).not.toHaveAttribute('data-floating');
  await page.screenshot({ path: testInfo.outputPath('onegram-floating-rail.png') });
});

test('sidebar animation keeps label geometry and icon anchors stable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await desktopFixture(page, { gallery: true, settings: { sidebarCollapsed: false } }); await page.goto('/');
  // Navigation can finish before the lazy workspace has a visible layout.
  // boundingBox() only waits for attachment and can return null at startup.
  await expect(page.locator('.cloud-sidebar')).toHaveCSS('width', '248px', { timeout: 30_000 });
  const photoIcon = page.locator('.cloud-sidebar nav > button').first().locator('svg');
  await expect(photoIcon).toBeVisible();
  const beforeX = await photoIcon.evaluate(icon => icon.getBoundingClientRect().left);
  await page.keyboard.press('ControlOrMeta+b');
  const samples = await page.evaluate(async () => {
    const samples: { width: number; icon: number; height: number }[] = [];
    for (let i = 0; i < 20; i++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const aside = document.querySelector('.cloud-sidebar')!;
      const item = aside.querySelector('nav > button')!;
      samples.push({ width: aside.getBoundingClientRect().width, icon: item.querySelector('svg')!.getBoundingClientRect().left, height: item.getBoundingClientRect().height });
    }
    return samples;
  });
  expect(samples.every(s => Math.abs(s.icon - beforeX) < 1)).toBe(true);
  expect(samples.every(s => s.height <= 44)).toBe(true);
  await expect(page.locator('.cloud-sidebar')).toHaveCSS('width', '68px');
});

test('portrait cards and image preview hug media rather than rendering side bars', async ({ page }, testInfo) => {
  await desktopFixture(page, { gallery: true, thumbnailWidth: 100, settings: { startupView: 'photos' } }); await page.goto('/');
  await expect(page.locator('.cloud-media-open img')).toHaveCount(6);
  const sizes = await page.locator('.cloud-media-tile:has(img)').evaluateAll(tiles => tiles.map(tile => ({ card: tile.getBoundingClientRect().width, image: tile.querySelector('img')!.getBoundingClientRect().width })));
  expect(sizes.every(s => Math.abs(s.card - s.image) <= 2)).toBe(true);
  await page.getByRole('button', { name: 'Open Alpine morning.jpg', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Alpine morning.jpg', exact: true });
  await expect(viewer.locator('.preview-original')).toHaveCSS('opacity', '1');
  const image = await viewer.locator('.preview-original').boundingBox();
  const box = await viewer.boundingBox();
  expect(image!.width).toBeLessThanOrEqual(box!.width);
  expect(image!.height).toBeLessThanOrEqual(box!.height);
  expect(box!.width).toBeCloseTo(Math.min(1280*.88,1140),0);
  await page.screenshot({ path: testInfo.outputPath('onegram-fitted-preview.png') });
});
