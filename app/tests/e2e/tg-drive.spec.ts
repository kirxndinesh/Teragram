import { expect, test } from '@playwright/test';
import axe from 'axe-core';
import { desktopFixture, nativeCalls, openSettings } from './desktop-fixture';

for (const theme of ['light', 'dark'] as const) {
  test(`Teragram dashboard and masonry in ${theme}`, async ({ page }, testInfo) => {
    await desktopFixture(page, { gallery: true, theme, settings: { startupView: 'cloud', quickAccessExpanded: false } });
    await page.goto('/');
    await expect(page.locator('.cloud-content-heading h1')).toHaveText('My Cloud');
    await expect(page.locator('.cloud-brand')).toContainText('Teragram');
    await expect(page.locator('.cloud-table-row')).toHaveCount(8);
    await expect(page.locator('.cloud-storage-widget')).toContainText('48.77 MB');
    const checkPills = async () => {
      const pills = page.locator('.cloud-folder-pills > button, .cloud-type-tabs > button');
      for (const pill of await pills.all()) {
        await expect(pill).toHaveCSS('border-radius', '9999px');
        await expect(pill).toHaveCSS('height', '36px');
        await expect(pill).toHaveCSS('padding-inline-start', '16px');
        await expect(pill).toHaveCSS('font-size', '14px');
        await expect(pill).toHaveCSS('font-weight', '500');
        await expect(pill).toHaveCSS('border-top-width', '0px');
      }
      expect(await pills.count()).toBeGreaterThan(0);
      const unselected = page.locator('.cloud-filter-pill[aria-pressed=false]').first();
      await page.mouse.move(900, 70);
      await expect(unselected).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const sidebarColor = await page.locator('.cloud-quick-navigation .cloud-nav-item').evaluate(element => getComputedStyle(element).color);
      await expect(unselected).toHaveCSS('color', sidebarColor);
      await unselected.hover();
      await expect(unselected).toHaveCSS('background-color', theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)');
      await expect(unselected).toHaveCSS('color', theme === 'dark' ? 'rgb(237, 237, 237)' : 'rgb(32, 33, 36)');
      await page.mouse.move(900, 70);
      await expect(page.locator('.cloud-filter-pill[aria-pressed=true]').first()).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('.cloud-files-heading')).toHaveCount(0);
    };
    await checkPills();
    await expect(page.locator('.cloud-quick-links')).not.toBeVisible();
    await expect(page.locator('.cloud-quick-links').getByRole('button')).toHaveCount(0);
    await page.addScriptTag({ content: axe.source });
    const audit = async () => { await expect(page.locator('.cloud-view-transition')).toHaveCSS('opacity','1'); return page.evaluate(async () => (await (window as any).axe.run(document)).violations.map((v: any) => ({ id: v.id, targets: v.nodes.map((n: any) => ({target:n.target,details:n.failureSummary})) }))); };
    expect(await audit()).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`tg-drive-${theme}.png`) });
    await page.locator('.cloud-type-tabs').getByRole('button', { name: 'Documents', exact: true }).click();
    await expect(page.locator('.cloud-table-row')).toHaveCount(1);
    await expect(page.getByText('Project brief.pdf', { exact: true })).toBeVisible();
    await page.locator('.cloud-sidebar').getByRole('button', { name: 'Photos', exact: true }).click();
    await expect(page.locator('.cloud-media-tile')).toHaveCount(6);
    await expect.poll(() => page.locator('.cloud-media-open img').count()).toBe(6);
    await checkPills();
    const ratios = await page.locator('.cloud-media-open img').evaluateAll(images => images.map(image => (image as HTMLImageElement).naturalWidth / (image as HTMLImageElement).naturalHeight));
    expect(ratios.some(ratio => ratio < 1)).toBe(true);
    expect(ratios.some(ratio => ratio > 1)).toBe(true);
    expect(await audit()).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`tg-drive-photos-${theme}.png`) });
    await page.locator('.cloud-sidebar').getByRole('button', { name: 'Saved Messages', exact: true }).click();
    await checkPills();
    await page.locator('.cloud-sidebar').getByText('MTI', { exact: true }).click();
    await checkPills();
    await page.locator('.cloud-sidebar').getByRole('button', { name: 'Quick Access', exact: true }).click();
    await page.locator('.cloud-sidebar').getByRole('button', { name: 'Favorites', exact: true }).click();
    await checkPills();
    await page.locator('.cloud-sidebar').getByRole('button', { name: 'Photos', exact: true }).click();
    for (const width of [1000, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const panel = await page.locator('.tg-main').boundingBox();
      expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
    }
  });
}

test('Teragram settings preserve native controls and persist workspace preferences', async ({ page }, testInfo) => {
  await desktopFixture(page, { gallery: true, theme: 'light', settings: { startupView: 'cloud' } });
  await page.goto('/');
  await openSettings(page);
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(dialog.getByLabel('Startup view', { exact: true })).toBeVisible();
  await dialog.getByLabel('Startup view', { exact: true }).selectOption('photos');
  await dialog.getByLabel('Thumbnail size', { exact: true }).fill('1.25');
  await dialog.getByRole('button', { name: 'Default download directory', exact: true }).click();
  await expect(dialog.getByText('/synthetic/Library', { exact: true })).toBeVisible();
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog.locator('..')).toHaveCSS('opacity', '1');
  await expect(dialog.locator('.cloud-workspace-preferences').locator('..')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('tg-drive-settings.png') });
  await dialog.getByRole('button', { name: 'Telegram account', exact: true }).click();
  await expect(dialog.getByText('12345', { exact: true })).toBeVisible();
  await expect.poll(async () => (await nativeCalls(page, 'cmd_has_api_hash')).length).toBeGreaterThanOrEqual(1);
  await expect(dialog.getByText('Protected', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Folder Sync', exact: true }).click();
  await dialog.getByLabel('Background sync interval', { exact: true }).selectOption('300');
  await expect.poll(async () => (await nativeCalls(page, 'cmd_set_sync_interval')).map(call => call.args)).toEqual([{ seconds: 300, ownerId: '101' }]);
  await dialog.getByRole('button', { name: 'Allocated photo folders', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: 'MTI', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__desktopTest.stores['settings.json'].settings.thumbnailScale)).toBe(1.25);
  await page.reload();
  await expect(page.locator('.cloud-content-heading h1')).toHaveText('Photos');
  await expect(page.locator('.cloud-media-tile')).toHaveCount(6);
});

test('Teragram sign-in retains credential entry', async ({ page }, testInfo) => {
  await desktopFixture(page, { signedOut: true, theme: 'light' });
  await page.goto('/');
  await expect(page.getByLabel('API ID', { exact: true })).toBeVisible();
  await expect(page.locator('.tg-auth-brand')).toHaveText('Teragram');
  await page.screenshot({ path: testInfo.outputPath('tg-drive-sign-in.png') });
  await page.getByLabel('API ID', { exact: true }).fill('12345');
  await page.getByLabel('API Hash', { exact: true }).fill('fixture-client-hash');
  await page.getByRole('button', { name: 'Continue to QR sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Phone Number', exact: true })).toBeVisible();
});
