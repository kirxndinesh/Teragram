import { expect, test, type Page } from '@playwright/test';
import { desktopFixture, nativeCalls } from './desktop-fixture';

const reads = async (page: Page) => page.evaluate(() => (window as any).__desktopTest.calls
  .filter((call: any) => ['cmd_get_files', 'cmd_search_local', 'cmd_get_thumbnail', 'cmd_get_display_preview'].includes(call.command)).length);
const ready = async (page: Page) => {
  await expect(page.locator('.cloud-media-tile.is-ready').first()).toBeVisible();
  await expect(page.locator('.cloud-media-fallback.is-loading')).toHaveCount(0);
};
const watchLoading = async (page: Page) => page.evaluate(() => {
  (window as any).__galleryFlashes = 0;
  const observer = new MutationObserver(() => {
    if (document.querySelector('.cloud-loading, .cloud-media-fallback.is-loading')) (window as any).__galleryFlashes++;
  });
  observer.observe(document.querySelector('.cloud-workspace')!, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  (window as any).__galleryObserver = observer;
});

test('returning to Photos uses ready thumbnails without new reads or loading flashes', async ({ page }) => {
  await desktopFixture(page, { gallery: true, thumbnailWidth: 1000, settings: { startupView: 'photos', quickAccessExpanded: true } });
  await page.goto('/'); await ready(page);
  const sources = await page.locator('.cloud-media-open img').evaluateAll(images => images.map(image => image.getAttribute('src')).sort());
  const before = await reads(page);
  for (const destination of ['My Cloud', 'Folders', 'Recents']) {
    await page.locator('.cloud-sidebar').getByRole('button', { name: destination, exact: true }).click();
    await expect(page.locator('.cloud-content-heading h1')).toHaveText(destination);
    const destinationReads = await reads(page);
    await watchLoading(page);
    await page.locator('.cloud-sidebar').getByRole('button', { name: 'Photos', exact: true }).click();
    await ready(page);
    expect(await page.evaluate(() => (window as any).__galleryFlashes)).toBe(0);
    expect(await reads(page)).toBe(destinationReads);
    expect(await page.locator('.cloud-media-open img').evaluateAll(images => images.map(image => image.getAttribute('src')).sort())).toEqual(sources);
    await page.evaluate(() => (window as any).__galleryObserver.disconnect());
  }
  expect(await reads(page)).toBeGreaterThanOrEqual(before);
});

test('Photos restores its own scroll position on the first returning frame', async ({ page }) => {
  const files = Array.from({ length: 36 }, (_, index) => ({ id: index + 100, folder_id: 9, name: `Photo ${index}.jpg`, size: 1024, mime_type: 'image/jpeg', file_ext: 'jpg', created_at: '2026-10-20T12:00:00Z', type: 'file' }));
  await desktopFixture(page, { gallery: true, thumbnailWidth: 1000, metadataFiles: files, settings: { startupView: 'photos' } });
  await page.goto('/'); await expect(page.locator('.cloud-media-tile')).toHaveCount(36);
  await expect(page.locator('.cloud-media-tile.is-ready').first()).toBeVisible();
  await page.locator('.cloud-workspace').evaluate(element => { element.scrollTop = 700; });
  await expect.poll(() => page.locator('.cloud-workspace').evaluate(element => element.scrollTop)).toBe(700);
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Folders', exact: true }).click();
  await expect(page.locator('.cloud-workspace')).toHaveJSProperty('scrollTop', 0);
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Photos', exact: true }).click();
  const offset = await page.evaluate(() => new Promise<number>(resolve => requestAnimationFrame(() => resolve(document.querySelector('.cloud-workspace')!.scrollTop))));
  expect(offset).toBe(700);
});

test('folder categories filter the shared index and remember the media tab across navigation', async ({ page }) => {
  await page.clock.install();
  const files = [
    { id: 42, folder_id: 9, name: 'Photo.jpg', size: 1024, mime_type: 'image/jpeg', file_ext: 'jpg', type: 'file' },
    { id: 46, folder_id: 9, name: 'Movie.mp4', size: 1024, mime_type: 'video/mp4', file_ext: 'mp4', type: 'file' },
    { id: 48, folder_id: 9, name: 'Notes.pdf', size: 1024, mime_type: 'application/pdf', file_ext: 'pdf', type: 'file' },
    { id: 49, folder_id: 9, name: 'Song.mp3', size: 1024, mime_type: 'audio/mpeg', file_ext: 'mp3', type: 'file' },
  ];
  await desktopFixture(page, { gallery: true, thumbnailWidth: 1000, metadataFiles: files, settings: { startupView: 'photos' } });
  await page.goto('/'); await ready(page);
  await page.locator('.cloud-sidebar').getByText('MTI', { exact: true }).click();
  await expect(page.locator('.cloud-content-heading h1')).toHaveText('MTI');
  await expect.poll(async () => (await nativeCalls(page, 'cmd_get_files')).length).toBeGreaterThan(0);
  const before = (await nativeCalls(page, 'cmd_get_files')).length;
  const catalog = (await nativeCalls(page, 'cmd_search_local')).length;
  for (const category of ['Photos', 'Videos', 'Files', 'Documents', 'Audio', 'Photos']) {
    await page.locator('.cloud-type-tabs').getByRole('button', { name: category, exact: true }).click();
    await expect(page.locator('.cloud-type-tabs').getByRole('button', { name: category, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await ready(page);
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Photos', exact: true }).click();
  await page.clock.setSystemTime(Date.now() + 6 * 60_000);
  await page.locator('.cloud-sidebar').getByText('MTI', { exact: true }).click();
  await expect(page.locator('.cloud-type-tabs').getByRole('button', { name: 'Photos', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await ready(page);
  expect((await nativeCalls(page, 'cmd_get_files')).length).toBe(before);
  expect((await nativeCalls(page, 'cmd_search_local')).length).toBe(catalog);
});

test('My Cloud category changes also reuse the index with all-folder search enabled', async ({ page }) => {
  await desktopFixture(page, { gallery: true, thumbnailWidth: 1000, settings: { startupView: 'cloud' } });
  await page.goto('/'); await expect(page.locator('.cloud-table-row')).toHaveCount(8);
  await page.getByRole('button', { name: 'Search filters', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search scope', exact: true }).selectOption('all');
  await page.getByRole('dialog', { name: 'Search filters', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  const before = (await nativeCalls(page, 'cmd_search_local')).length;
  for (const category of ['Photos', 'Videos', 'Files', 'Documents', 'Audio']) {
    await page.locator('.cloud-type-tabs').getByRole('button', { name: category, exact: true }).click();
    await expect(page.locator('.cloud-type-tabs').getByRole('button', { name: category, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  expect((await nativeCalls(page, 'cmd_search_local')).length).toBe(before);
});

test('inventory reconciliation retains ready media and ignores foreign account events', async ({ page }) => {
  await desktopFixture(page, { gallery: true, thumbnailWidth: 1000, settings: { startupView: 'photos' } });
  await page.goto('/'); await ready(page);
  const before = await reads(page);
  await page.evaluate(() => (window as any).__desktopTest.emit('file-inventory-changed', { ownerId: '202', folderId: 9 }));
  await page.waitForTimeout(100);
  expect(await reads(page)).toBe(before);
  await watchLoading(page);
  await page.evaluate(() => { const state = (window as any).__desktopTest; state.searchHold = true; state.emit('file-inventory-changed', { ownerId: '101', folderId: 9 }); });
  await expect.poll(async () => (await nativeCalls(page, 'cmd_search_local')).length).toBeGreaterThan(1);
  await expect(page.locator('.cloud-media-tile.is-ready')).toHaveCount(6);
  await expect(page.locator('.cloud-loading')).toHaveCount(0);
  await page.evaluate(() => (window as any).__desktopTest.releaseSearch());
  await ready(page);
  expect(await page.evaluate(() => (window as any).__galleryFlashes)).toBe(0);
  const thumbnailReads = await nativeCalls(page, 'cmd_get_thumbnail');
  expect(thumbnailReads.filter(call => call.args.folderId !== 9)).toHaveLength(3);
  expect(thumbnailReads.length).toBeLessThanOrEqual(9);
});

test('returning after Load more retains the mounted range and deep scroll position', async ({ page }) => {
  const files = Array.from({ length: 125 }, (_, index) => ({ id: index + 100, folder_id: 9, name: `Frame ${index}.jpg`, size: 30_000_000, mime_type: 'image/jpeg', file_ext: 'jpg', type: 'file' }));
  await desktopFixture(page, { gallery: true, thumbnailWidth: 1000, metadataFiles: files, settings: { startupView: 'photos' } });
  await page.goto('/'); await expect(page.locator('.cloud-media-tile')).toHaveCount(120);
  await page.locator('.cloud-load-more').click();
  await expect(page.locator('.cloud-media-tile')).toHaveCount(125);
  await page.locator('.cloud-workspace').evaluate(element => { element.scrollTop = element.scrollHeight; });
  // Capture at the actual navigation boundary: late initial thumbnails may
  // legitimately adjust browser scroll anchoring before the click occurs.
  await page.locator('.cloud-folder-navigation .cloud-nav-item').evaluate(button => button.addEventListener('click', () => {
    (window as any).__leavingGalleryScroll = document.querySelector('.cloud-workspace')!.scrollTop;
  }, { capture: true, once: true }));
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Folders', exact: true }).click();
  const offset = await page.evaluate(() => (window as any).__leavingGalleryScroll);
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Photos', exact: true }).click();
  await expect(page.locator('.cloud-media-tile')).toHaveCount(125);
  expect(await page.locator('.cloud-workspace').evaluate(element => element.scrollTop)).toBeCloseTo(offset, 0);
});

test('vault lock removes decrypted gallery frames even while another view is open', async ({ page }) => {
  const files = [{ id: 42, folder_id: 9, name: 'Decrypted private photo.jpg', size: 1024, mime_type: 'image/jpeg', file_ext: 'jpg', type: 'file', encryption_state: 'encrypted_unlocked' }];
  await desktopFixture(page, { gallery: true, thumbnailWidth: 1000, metadataFiles: files, settings: { startupView: 'photos' } });
  await page.addInitScript(() => {
    const bridge = (window as any).__TAURI_INTERNALS__, invoke = bridge.invoke;
    bridge.invoke = async (command: string, args: any) => {
      const result = await invoke(command, args);
      if (command === 'cmd_search_local' && (window as any).__desktopTest.vaultLocked) return { ...result, files: [], total: 0, nextOffset: null };
      return result;
    };
  });
  await page.goto('/'); await ready(page);
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Folders', exact: true }).click();
  await page.evaluate(() => { const state = (window as any).__desktopTest; state.vaultLocked = true; state.emit('vault-locked', {}); });
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Photos', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Decrypted private photo.jpg', exact: true })).toHaveCount(0);
  await expect(page.locator('.cloud-media-tile')).toHaveCount(0);
  await page.evaluate(() => { const state = (window as any).__desktopTest; state.vaultLocked = false; state.emit('vault-unlocked', {}); });
  await ready(page);
  await expect(page.getByRole('img', { name: 'Decrypted private photo.jpg', exact: true })).toBeVisible();
});

test('account round trips discard the previous session index instead of reusing it', async ({ page }) => {
  await desktopFixture(page, { settings: { startupView: 'photos' } });
  await page.addInitScript(() => {
    const bridge = (window as any).__TAURI_INTERNALS__, invoke = bridge.invoke;
    bridge.invoke = async (command: string, args: any) => {
      const result = await invoke(command, args);
      if (command === 'cmd_search_local' && (window as any).__desktopTest.returnedAccount) return { ...result, files: result.files.map((file: any) => ({ ...file, name: file.name.replace('Holiday', 'Returned') })) };
      return result;
    };
  });
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Open Holiday saved photo.jpg', exact: true })).toBeVisible();
  await page.evaluate(() => { (window as any).__desktopTest.owner = '202'; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.getByRole('button', { name: 'Open Work saved photo.jpg', exact: true })).toBeVisible();
  await page.evaluate(() => { const state = (window as any).__desktopTest; state.owner = '101'; state.returnedAccount = true; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.getByRole('button', { name: 'Open Returned saved photo.jpg', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Holiday saved photo.jpg', exact: true })).toHaveCount(0);
});

test('known unavailable video thumbnails return without flashing their loading skeleton', async ({ page }) => {
  await desktopFixture(page, { gallery: true, thumbnailWidth: 1000, blackVideoThumbnail: true, settings: { startupView: 'photos' } });
  await page.goto('/'); await ready(page);
  await expect(page.locator('[data-file-key="10:46"]')).toContainText('Preview unavailable');
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Folders', exact: true }).click();
  await watchLoading(page);
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Photos', exact: true }).click();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__galleryFlashes)).toBe(0);
});

test('session URLs survive navigation after the decoded-thumbnail LRU has overflowed', async ({ page }) => {
  const files = Array.from({ length: 270 }, (_, index) => ({ id: index + 100, folder_id: 9, name: `Library ${index}.jpg`, size: 30_000_000, mime_type: 'image/jpeg', file_ext: 'jpg', type: 'file' }));
  await desktopFixture(page, { gallery: true, thumbnailWidth: 1000, metadataFiles: files, settings: { startupView: 'photos' } });
  await page.goto('/'); await expect(page.locator('.cloud-media-tile')).toHaveCount(120);
  await page.locator('.cloud-load-more').click(); await expect(page.locator('.cloud-media-tile')).toHaveCount(240);
  await page.locator('.cloud-load-more').click(); await expect(page.locator('.cloud-media-tile')).toHaveCount(270);
  await page.evaluate(async () => {
    const tiles = [...document.querySelectorAll('.cloud-media-tile')];
    for (let index = 0; index < tiles.length; index += 3) {
      tiles[index].scrollIntoView();
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
  });
  await expect(page.locator('.cloud-media-tile.is-ready')).toHaveCount(270, { timeout: 15_000 });
  const before = (await nativeCalls(page, 'cmd_get_thumbnail')).length;
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Folders', exact: true }).click();
  await watchLoading(page);
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Photos', exact: true }).click();
  await expect(page.locator('.cloud-media-tile.is-ready')).toHaveCount(270);
  expect(await page.evaluate(() => (window as any).__galleryFlashes)).toBe(0);
  expect((await nativeCalls(page, 'cmd_get_thumbnail')).length).toBe(before);
});
