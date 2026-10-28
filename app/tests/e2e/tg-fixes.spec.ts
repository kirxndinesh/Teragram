import { expect, test } from '@playwright/test';
import { desktopFixture, openSettings, nativeCalls } from './desktop-fixture';

test('General delegates theme mode to Themes and aligns appearance controls', async ({ page }, testInfo) => {
  await desktopFixture(page, { gallery: true }); await page.goto('/'); await openSettings(page);
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(dialog.getByRole('heading', { name: 'Appearance & Startup', exact: true })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Theme', exact: true })).toHaveCount(0);
  const widths = await dialog.locator('.cloud-workspace-preferences label > :last-child').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
  await page.screenshot({ path: testInfo.outputPath('tg-drive-general-polish.png'), animations: 'disabled' });
  const videoMode = dialog.getByRole('combobox', { name: 'Default video upload', exact: true });
  await videoMode.scrollIntoViewIfNeeded();
  const control = await videoMode.boundingBox();
  const footer = await dialog.locator(':scope > div').last().boundingBox();
  expect(control!.y + control!.height).toBeLessThan(footer!.y);
});

test('wide header keeps search bounded and actions against the far edge', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await desktopFixture(page, { gallery: true }); await page.goto('/');
  const avatar = page.locator('.cloud-header').getByLabel('Connection menu', { exact: true });
  await expect(avatar).toBeVisible();
  const search = await page.locator('label:has(input[data-file-search])').boundingBox();
  const profile = await avatar.boundingBox();
  expect(search!.width).toBeLessThanOrEqual(560);
  expect(1800 - profile!.x - profile!.width).toBeLessThanOrEqual(28);
});

test('photo preview floats, reveals original progressively, toggles fullscreen and animates closing', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await desktopFixture(page, { gallery: true, holdPreviews: true, settings: { startupView: 'photos' } });
  await page.goto('/');
  await expect(page.locator('.cloud-media-open img')).toHaveCount(6, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Open Alpine morning.jpg', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Alpine morning.jpg', exact: true });
  await expect(viewer).toBeVisible();
  const bounds = await viewer.boundingBox();
  expect(bounds!.width).toBeLessThan(1280 * .9); expect(bounds!.x).toBeGreaterThan(30);
  await expect(viewer.locator('.preview-thumbnail')).toBeVisible();
  expect((await nativeCalls(page, 'cmd_get_display_preview')).length).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__desktopTest.releasePreviews());
  await expect(viewer.locator('.preview-original')).toHaveCSS('opacity', '1');
  await expect(viewer.locator('.preview-original')).toHaveJSProperty('naturalWidth', 2500);
  await page.screenshot({ path: testInfo.outputPath('tg-drive-floating-preview.png'), animations: 'disabled' });
  await viewer.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await expect(viewer).toHaveClass(/is-fullscreen/);
  await page.keyboard.press('Escape');
  await expect(viewer).toBeVisible(); await expect(viewer).not.toHaveClass(/is-fullscreen/);
  // Closing is shorter than a cross-process assertion poll on busy runners.
  // Observe the actual class transition before the real backdrop click.
  const closing = await viewer.evaluateHandle(element => {
    const state = { seen: false };
    const observer = new MutationObserver(() => {
      if (element.classList.contains('is-closing')) {
        state.seen = element.isConnected;
        observer.disconnect();
      }
    });
    observer.observe(element, { attributes: true, attributeFilter: ['class'] });
    return state;
  });
  await page.locator('.media-preview-backdrop').click({ position: { x: 8, y: 8 } });
  await expect.poll(() => closing.evaluate(state => state.seen)).toBe(true);
  await expect(viewer).toHaveCount(0);
  await closing.dispose();
});

test('missing metadata resolves captions, generated names and dates while hiding ghosts in cloud and folders', async ({ page }) => {
  const base = { folder_id: 10, size: 3000, mime_type: 'video/mp4', file_ext: 'mp4', icon_type: 'file', encryption_state: 'plain', tags: [], collectionIds: [] };
  const files = [
    { ...base, id: 101, key: '10:101', name: 'Named.mp4', caption: 'Ignore caption', message: { date: 1792972800 } },
    { ...base, id: 102, key: '10:102', name: '', document: { file_name: 'Document.mp4' }, message: { date: 1792972800 } },
    { ...base, id: 103, key: '10:103', name: '', caption: 'Caption title\nIgnore second line', message: { date: 1792972800 } },
    { ...base, id: 104, key: '10:104', name: '', created_at: '2026-10-26 00:00:00 UTC' },
    { ...base, id: 105, key: '10:105', name: '', size: 0, mime_type: '', file_ext: '', media: null },
  ];
  await desktopFixture(page, { gallery: true, metadataFiles: files, settings: { startupView: 'cloud', viewMode: 'list' } });
  await page.goto('/');
  await expect(page.locator('.cloud-table-row')).toHaveCount(4);
  for (const name of ['Named.mp4', 'Document.mp4', 'Caption title', 'Video_2026-10-26_#104.mp4']) await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.locator('.cloud-table-row').filter({ hasText: '—' })).toHaveCount(0);
  await expect(page.locator('.cloud-table-row').filter({ hasText: 'Caption title' }).locator('.lucide-file-play')).toBeVisible();
  await page.locator('.cloud-channel-list').getByText('Aswathy', { exact: true }).click();
  await expect(page.locator('.cloud-table-row')).toHaveCount(4);
});


test('scaled gallery and folder cards upgrade undersized bitmap sources', async ({ page }) => {
  await desktopFixture(page, { gallery: true, thumbnailWidth: 100, settings: { startupView: 'photos', thumbnailScale: 1.5, viewMode: 'grid' } });
  await page.goto('/');
  await expect(page.locator('.cloud-media-tile')).toHaveCount(6); await expect(page.locator('.cloud-media-open img').first()).toBeVisible();
  await expect.poll(() => page.locator('.cloud-media-open img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth >= 800))).toBe(true);
  await page.locator('.cloud-sidebar').getByText('MTI', { exact: true }).click();
  const image = page.locator('.cloud-document-grid img').first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThanOrEqual(640);
});
