import { expect, test } from '@playwright/test';
import { desktopFixture, openSettings } from './desktop-fixture';

test('New menu survives WebKit null focus transitions and queues global uploads to Saved Messages', async ({ page }) => {
  await desktopFixture(page, { gallery: true, encryptionReady: true, pickedUploadPaths: ['/fixture/clip.mp4'], settings: { startupView: 'photos', zipFolders: false } });
  await page.goto('/');
  await page.getByLabel('Add files', { exact: true }).click();
  await page.locator('.cloud-new-menu').dispatchEvent('focusout', { relatedTarget: null });
  await page.getByRole('button', { name: 'Upload File', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Store Upload normally/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__desktopTest.calls.filter((c: any) => c.command === 'cmd_transfer_enqueue_many').length)).toBeGreaterThan(0);
  const jobs = await page.evaluate(() => (window as any).__desktopTest.calls.filter((c: any) => c.command === 'cmd_transfer_enqueue_many'));
  expect(JSON.stringify(jobs)).not.toContain('"folderId":9');
  await page.getByLabel('Add files', { exact: true }).click();
  await page.locator('.cloud-new-menu').dispatchEvent('focusout', { relatedTarget: null });
  await page.locator('.cloud-new-options').getByRole('button', { name: 'Create Folder', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create Folder', exact: true })).toBeVisible();
});

test('legacy floating mode is removed and brand click toggles a persisted docked rail', async ({ page }) => {
  await desktopFixture(page, { gallery: true, settings: { floatSidebar: true } }); await page.goto('/');
  await expect.poll(() => page.evaluate(() => Object.hasOwn((window as any).__desktopTest.stores['settings.json'].settings, 'floatSidebar'))).toBe(false);
  await page.locator('.cloud-brand').click();
  await expect(page.locator('.cloud-sidebar')).toHaveCSS('width', '68px');
  await page.reload(); await expect(page.locator('.cloud-sidebar')).toHaveCSS('width', '68px');
  await page.locator('.cloud-brand').click(); await expect(page.locator('.cloud-sidebar')).toHaveCSS('width', '248px');
  await openSettings(page);
  await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).not.toContainText('Float Sidebar');
});

test('large gallery cards fill their columns without overflowing the workspace', async ({ page }) => {
  await desktopFixture(page, { gallery: true, settings: { startupView: 'photos', thumbnailScale: 1.5 } }); await page.goto('/');
  await expect(page.locator('.cloud-media-tile')).toHaveCount(6);
  await expect(page.locator('.cloud-media-open img').first()).toBeVisible();
  const sizes = await page.locator('.cloud-media-tile:has(img)').evaluateAll(tiles => tiles.map(tile => ({ card: tile.getBoundingClientRect().width, image: tile.querySelector('img')!.getBoundingClientRect().width, column: tile.parentElement!.getBoundingClientRect().width })));
  expect(sizes.every(s => Math.abs(s.card - s.image) < 2 && Math.abs(s.column - s.card) < 2)).toBe(true);
  expect(await page.locator('.cloud-workspace').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
});

test('profile uses Telegram name, username and avatar consistently', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.getByLabel('Connection menu', { exact: true }).click();
  await expect(page.locator('.cloud-account-summary strong')).toHaveText('Alex Morgan');
  await expect(page.locator('.cloud-account-summary small')).toHaveText('@alexmorgan');
  await expect(page.locator('.cloud-account-summary img')).toBeVisible();
  await page.locator('.cloud-connection-popover').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Telegram account', exact: true }).click();
  await expect(page.locator('.cloud-account-badge')).toContainText('Alex Morgan');
});


test('text and code open safely in the floating viewer with wrapping and line numbers', async ({ page }) => {
  await desktopFixture(page, { gallery: true, settings: { startupView: 'cloud', viewMode: 'list' }, metadataFiles: [{ id: 400, folder_id: 9, name: 'Example.ts', file_ext: 'ts', mime_type: 'text/plain', size: 100, encryption_state: 'plain' }] });
  await page.goto('/');
  await page.getByText('Example.ts', { exact: true }).first().click();
  const viewer = page.getByRole('dialog', { name: 'Example.ts', exact: true });
  await expect(viewer.locator('code').first()).toContainText('<script>alert(1)</script>');
  await expect(viewer.locator('script')).toHaveCount(0);
  await expect(viewer.locator('.document-line-number').first()).toHaveText('1');
  await expect(viewer.getByRole('button', { name: 'Word wrap', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await viewer.getByRole('button', { name: 'Word wrap', exact: true }).click();
  await expect(viewer.locator('.document-code')).not.toHaveClass(/is-wrapped/);
  await viewer.getByRole('button', { name: 'Copy Text', exact: true }).click();
  await expect(viewer.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__desktopTest.calls.filter((c: any) => c.command === 'plugin:clipboard-manager|write_text').length)).toBe(1);
  await page.keyboard.press('Escape'); await expect(viewer).toHaveCount(0);
});

test('image zoom stays within a bounded floating frame while controls remain reachable', async ({ page }) => {
  await desktopFixture(page, { gallery: true, settings: { startupView: 'photos' } }); await page.goto('/');
  await page.getByRole('button', { name: 'Open Alpine morning.jpg', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Alpine morning.jpg', exact: true });
  await expect(viewer.locator('.preview-original')).toHaveCSS('opacity', '1');
  const before = await viewer.boundingBox();
  for (let i = 0; i < 6; i++) await viewer.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const after = await viewer.boundingBox();
  expect(Math.abs(before!.width - after!.width)).toBeLessThan(2);
  expect(Math.abs(before!.height - after!.height)).toBeLessThan(2);
  await expect(viewer.locator('.media-hud-top')).toBeInViewport();
  await expect(viewer.getByRole('button', { name: 'Close preview', exact: true })).toBeInViewport();
});

test('Upload Folder opens a directory picker and queues recursive contents to Saved Messages', async ({ page }) => {
  await desktopFixture(page, { gallery: true, encryptionReady: true, pickedUploadPaths: ['/fixture/Album'], settings: { startupView: 'photos', zipFolders: true } });
  await page.goto('/');
  await page.getByLabel('Add files', { exact: true }).click();
  await page.locator('.cloud-new-options').getByRole('button', { name: 'Upload Folder', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Store Upload normally/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__desktopTest.calls.filter((c: any) => c.command === 'cmd_transfer_enqueue_many').length)).toBe(1);
  const calls = await page.evaluate(() => (window as any).__desktopTest.calls);
  expect(calls.some((c: any) => c.command === 'cmd_list_upload_folder')).toBe(true);
  const queued = calls.find((c: any) => c.command === 'cmd_transfer_enqueue_many').args.requests;
  expect(queued).toHaveLength(2);
  expect(queued.every((job: any) => job.folderId === null)).toBe(true);
});
