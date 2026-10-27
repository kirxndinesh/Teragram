import { expect, test } from '@playwright/test';
import { desktopFixture, nativeCalls } from './desktop-fixture';

for (const code of ['SEARCH_CHANGED', 'INVENTORY_CHANGED']) test(`bulk uploads recover repeated ${code} without a library error or thumbnail reset`, async ({ page }) => {
  await desktopFixture(page, { gallery: true, thumbnailWidth: 1000, settings: { startupView: 'photos' } });
  await page.addInitScript(() => {
    const state = (window as any).__desktopTest, bridge = (window as any).__TAURI_INTERNALS__, invoke = bridge.invoke;
    state.churn = 0; state.churnReads = 0;
    bridge.invoke = async (command: string, args: any) => {
      if (command === 'cmd_search_local' && state.churn > 0) {
        state.churnReads++; state.churn--;
        throw `${state.churnCode}: Inventory changed during upload`;
      }
      const reply = await invoke(command, args);
      if (command === 'cmd_search_local' && state.churnReads > 0) {
        reply.files.push({ ...reply.files[0], id: 999, key: '9:999', name: 'New upload.jpg' }); reply.total++;
      }
      return reply;
    };
  });
  await page.goto('/'); await expect(page.locator('.cloud-media-tile.is-ready')).toHaveCount(6);
  await page.evaluate(code => {
    const state = (window as any).__desktopTest; state.churnCode = code; state.churn = 7;
    (window as any).__libraryAlerts = [];
    new MutationObserver(() => {
      for (const alert of document.querySelectorAll('[role="alert"]')) (window as any).__libraryAlerts.push(alert.textContent);
    }).observe(document.body, { childList: true, subtree: true });
    state.emit('file-inventory-changed', { ownerId: '101', folderId: 9 });
  }, code);
  await expect.poll(() => page.evaluate(() => (window as any).__desktopTest.churnReads), { timeout: 15_000 }).toBe(7);
  await expect(page.locator('.cloud-media-tile.is-ready')).toHaveCount(7);
  await expect(page.locator('.cloud-loading')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__libraryAlerts)).toEqual([]);
  await expect(page.getByText('This operation could not finish. Refresh your library and retry.', { exact: true })).toHaveCount(0);
});

test('175 upload inventory events coalesce and retain a final refresh after an in-flight read', async ({ page }) => {
  await desktopFixture(page, { gallery: true, thumbnailWidth: 1000, settings: { startupView: 'photos' } });
  await page.addInitScript(() => {
    const state = (window as any).__desktopTest, bridge = (window as any).__TAURI_INTERNALS__, invoke = bridge.invoke;
    state.searchReads = 0; state.blockReads = false;
    bridge.invoke = async (command: string, args: any) => {
      if (command === 'cmd_search_local') {
        state.searchReads++;
        if (state.blockReads) await new Promise<void>(resolve => state.releaseRead = resolve);
      }
      return invoke(command, args);
    };
  });
  await page.goto('/'); await expect(page.locator('.cloud-media-tile.is-ready')).toHaveCount(6);
  const before = await page.evaluate(() => (window as any).__desktopTest.searchReads);
  await page.evaluate(() => {
    const state = (window as any).__desktopTest; state.blockReads = true;
    state.emit('file-inventory-changed', { ownerId: '101', folderId: 9 });
  });
  await expect.poll(() => page.evaluate(() => (window as any).__desktopTest.searchReads)).toBe(before + 1);
  await page.evaluate(() => {
    const state = (window as any).__desktopTest;
    for (let index = 0; index < 175; index++) state.emit('file-inventory-changed', { ownerId: '101', folderId: 9 });
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__desktopTest.searchReads)).toBe(before + 1);
  await expect(page.locator('.cloud-media-tile.is-ready')).toHaveCount(6);
  await page.evaluate(() => { const state = (window as any).__desktopTest; state.blockReads = false; state.releaseRead(); });
  await expect.poll(() => page.evaluate(() => (window as any).__desktopTest.searchReads)).toBe(before + 2);
  await expect(page.locator('.cloud-media-tile.is-ready')).toHaveCount(6);
});

test('invalid pagination remains a visible failure rather than being silently retried', async ({ page }) => {
  await desktopFixture(page, { gallery: true, settings: { startupView: 'photos' } });
  await page.addInitScript(() => {
    const bridge = (window as any).__TAURI_INTERNALS__, invoke = bridge.invoke;
    bridge.invoke = (command: string, args: any) => command === 'cmd_search_local' ? Promise.reject('SEARCH_PAGE_INVALID') : invoke(command, args);
  });
  await page.goto('/');
  await expect(page.getByText('This operation could not finish. Refresh your library and retry.', { exact: true })).toBeVisible();
});

test('an upload completion refreshes an open folder despite repeated inventory changes', async ({ page }) => {
  await desktopFixture(page, { gallery: true, populatedTransfers: true, thumbnailWidth: 1000, settings: { startupView: 'photos' } });
  await page.addInitScript(() => {
    const state = (window as any).__desktopTest, bridge = (window as any).__TAURI_INTERNALS__, invoke = bridge.invoke;
    state.folderChurn = 0; state.folderChurnReads = 0;
    bridge.invoke = (command: string, args: any) => {
      if (command === 'cmd_get_files' && state.folderChurn > 0) {
        state.folderChurn--; state.folderChurnReads++; return Promise.reject('INVENTORY_CHANGED: Retry the folder listing');
      }
      return invoke(command, args);
    };
  });
  await page.goto('/'); await expect(page.locator('.cloud-media-tile.is-ready')).toHaveCount(6);
  await page.locator('.cloud-sidebar').getByText('MTI', { exact: true }).click();
  await expect.poll(async () => (await nativeCalls(page, 'cmd_get_files')).length).toBeGreaterThan(0);
  await expect(page.locator('.cloud-loading')).toHaveCount(0);
  const before = (await nativeCalls(page, 'cmd_get_files')).length;
  await page.evaluate(() => {
    const state = (window as any).__desktopTest; state.folderChurn = 7;
    const job = state.jobs.find((item: any) => item.id === 'upload-active');
    job.status = 'completed'; job.revision++; state.emit('transfer-upserted', { ...job });
  });
  await expect.poll(() => page.evaluate(() => (window as any).__desktopTest.folderChurnReads), { timeout: 20_000 }).toBe(7);
  await expect.poll(async () => (await nativeCalls(page, 'cmd_get_files')).length).toBeGreaterThan(before);
  await expect(page.locator('.cloud-scan-status')).toHaveCount(0);
  await expect(page.locator('[role="alert"]')).toHaveCount(0);
  await expect(page.locator('.cloud-content-heading h1')).toHaveText('MTI');
});
