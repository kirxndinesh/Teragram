import { expect, test, type Page } from '@playwright/test';
import { desktopFixture, nativeCalls } from './desktop-fixture';

const center = (page: Page) => page.getByRole('complementary', { name: 'Transfer activity', exact: true });
async function setup(page: Page) {
  await page.clock.install();
  await desktopFixture(page, { populatedTransfers: true, settings: { startupView: 'photos' } });
  await page.addInitScript(() => { const state = (window as any).__desktopTest; state.jobs = state.jobs.filter((job: any) => job.id === 'upload-active'); });
  await page.goto('/'); await expect(center(page)).toBeVisible();
  await page.mouse.move(80, 80);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
}
async function status(page: Page, status: string, collapsed = false) {
  await page.evaluate(status => {
    const state = (window as any).__desktopTest, job = state.jobs.find((job: any) => job.id === 'upload-active');
    job.status = status; job.revision++; state.emit('transfer-upserted', { ...job });
  }, status);
  if (collapsed) await expect(center(page)).toContainText('Failed');
  else await expect(center(page).getByText(status === 'completed' ? 'success' : status === 'failed' ? 'error' : status, { exact: true })).toBeVisible();
}
async function enqueue(page: Page, id = 'new-upload') {
  await page.evaluate(id => {
    const state = (window as any).__desktopTest;
    const job = { ...state.jobs[0], id, status: 'pending', filename: `${id}.bin`, path: `/fixture/${id}.bin`, revision: 1 };
    state.jobs.push(job); state.emit('transfer-upserted', { ...job });
  }, id);
}

test('completed banner confirms for 2.5 seconds then hides without deleting transfer history', async ({ page }, testInfo) => {
  await setup(page); await status(page, 'completed');
  await expect(center(page).getByText('All transfers complete', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('transfers-complete.png'), animations: 'disabled' });
  await page.clock.fastForward(2499); await expect(center(page)).toBeVisible();
  await page.clock.fastForward(1); await expect(center(page)).toHaveClass(/is-exiting/);
  await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
  expect(await nativeCalls(page, 'cmd_transfer_clear_terminal')).toHaveLength(0);
  expect(await page.evaluate(() => (window as any).__desktopTest.jobs.length)).toBe(1);
  await enqueue(page);
  await expect(center(page)).toBeVisible(); await expect(center(page).getByText('new-upload.bin', { exact: true })).toBeVisible();
  await expect(center(page).getByText('Fixture upload.bin', { exact: true })).toHaveCount(0);
});

test('paused, failed, network-waiting and unlock-waiting jobs never auto-hide', async ({ page }) => {
  await setup(page);
  for (const state of ['paused', 'failed', 'waiting_for_network', 'waiting_for_unlock', 'verifying']) {
    await status(page, state); await page.clock.fastForward(10_000);
    await expect(center(page)).toBeVisible(); await expect(center(page)).not.toHaveClass(/is-exiting/);
    await expect(center(page).getByText('All transfers complete', { exact: true })).toHaveCount(0);
  }
  await status(page, 'paused');
  await center(page).getByRole('button', { name: 'Resume all', exact: true }).click();
  await expect.poll(async () => (await nativeCalls(page, 'cmd_transfer_resume_all')).length).toBe(1);
});

test('hovering delays completion dismissal until one second after leaving', async ({ page }) => {
  await setup(page); await center(page).hover(); await status(page, 'completed');
  await page.clock.fastForward(3000); await expect(center(page)).toBeVisible();
  await page.mouse.move(80, 80); await page.clock.fastForward(999); await expect(center(page)).not.toHaveClass(/is-exiting/);
  await page.clock.fastForward(1); await expect(center(page)).toHaveClass(/is-exiting/);
  await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
});

test('new queued work cancels an exit that has already begun', async ({ page }) => {
  await setup(page); await status(page, 'completed');
  await page.clock.fastForward(2500); await expect(center(page)).toHaveClass(/is-exiting/);
  await enqueue(page); await page.clock.fastForward(5000);
  await expect(center(page)).toBeVisible(); await expect(center(page)).not.toHaveClass(/is-exiting/);
  await expect(center(page).getByText('new-upload.bin', { exact: true })).toBeVisible();
});

test('manual close dismisses a finished or collapsed banner without cancelling work', async ({ page }) => {
  await setup(page); await status(page, 'completed');
  await center(page).getByRole('button', { name: 'Close', exact: true }).click();
  await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
  await enqueue(page);
  await center(page).getByRole('button').filter({ hasText: 'Transfers' }).click();
  await center(page).getByRole('button', { name: 'Close', exact: true }).click();
  await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
  expect(await nativeCalls(page, 'cmd_transfer_cancel')).toHaveLength(0);
  expect(await nativeCalls(page, 'cmd_transfer_cancel_all')).toHaveLength(0);
  await enqueue(page, 'another-upload'); await expect(center(page)).toBeVisible();
});

test('cancelled and skipped jobs can disappear without claiming every file succeeded', async ({ page }) => {
  await setup(page); await status(page, 'cancelled');
  await expect(center(page).getByText('All transfers complete', { exact: true })).toHaveCount(0);
  await page.clock.fastForward(2500); await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
  await page.evaluate(() => {
    const state = (window as any).__desktopTest;
    const job = { ...state.jobs[0], id: 'skipped-download', direction: 'download', kind: 'download', filename: 'skipped.bin', status: 'completed', downloadOutcome: 'skipped', revision: 1, messageId: 42 };
    state.jobs.push(job); state.emit('transfer-upserted', { ...job });
  });
  await expect(center(page)).toBeVisible();
  await expect(center(page).getByText('Skipped — existing file kept', { exact: true })).toBeVisible();
  await expect(center(page).getByText('All transfers complete', { exact: true })).toHaveCount(0);
  await page.clock.fastForward(2500); await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
});

test('downloads keep a mixed queue visible and confirm only after the final job completes', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const state = (window as any).__desktopTest;
    const job = { ...state.jobs[0], id: 'movie-download', direction: 'download', kind: 'download', filename: 'movie.mp4', status: 'cooldown', revision: 1, messageId: 42 };
    state.jobs.push(job); state.emit('transfer-upserted', { ...job });
  });
  await expect(center(page).getByText('movie.mp4', { exact: true })).toBeVisible();
  await status(page, 'completed'); await page.clock.fastForward(10_000);
  await expect(center(page)).toBeVisible();
  await expect(center(page).getByText('All transfers complete', { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    const state = (window as any).__desktopTest, job = state.jobs.find((item: any) => item.id === 'movie-download');
    job.status = 'completed'; job.downloadOutcome = 'saved'; job.revision++; state.emit('transfer-upserted', { ...job });
  });
  await expect(center(page).getByText('All transfers complete', { exact: true })).toBeVisible();
  await page.clock.fastForward(2500); await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
});

test('retry of a dismissed job receives a fresh completion window', async ({ page }) => {
  await setup(page); await status(page, 'completed');
  await page.clock.fastForward(2500); await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
  await status(page, 'uploading'); await expect(center(page)).toBeVisible();
  await status(page, 'completed'); await page.clock.fastForward(2499); await expect(center(page)).toBeVisible();
  await page.clock.fastForward(1); await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
});

test('reduced-motion users get completion feedback without the slide animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  expect(await center(page).evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await status(page, 'completed'); await page.clock.fastForward(2500);
  expect(await center(page).evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
});

test('keyboard focus protects the completion message until focus leaves', async ({ page }) => {
  await setup(page); await page.keyboard.press('Tab');
  await center(page).getByRole('button').filter({ hasText: 'Transfers' }).focus();
  await status(page, 'completed'); await page.clock.fastForward(3000); await expect(center(page)).not.toHaveClass(/is-exiting/);
  await page.getByRole('button', { name: 'My Cloud', exact: true }).focus();
  await page.clock.fastForward(1000); await expect(center(page)).toHaveClass(/is-exiting/);
  await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
});

test('dismissed active work stays hidden on progress but reappears on failure or explicit tray navigation', async ({ page }) => {
  await setup(page);
  await center(page).getByRole('button').filter({ hasText: 'Transfers' }).click();
  await center(page).getByRole('button', { name: 'Close', exact: true }).click();
  await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
  await page.evaluate(() => {
    const state = (window as any).__desktopTest, job = state.jobs[0];
    job.progress = 80; job.revision++; state.emit('transfer-upserted', { ...job });
  });
  await page.clock.fastForward(1000); await expect(center(page)).toHaveCount(0);
  await status(page, 'failed', true); await expect(center(page)).toBeVisible();
  await center(page).getByRole('button', { name: 'Close', exact: true }).click();
  await page.clock.fastForward(220); await expect(center(page)).toHaveCount(0);
  await page.evaluate(() => (window as any).__desktopTest.emit('desktop-navigation-request', { target: 'transfers' }));
  await expect(center(page)).toBeVisible();
  await expect(center(page).getByText('Fixture upload.bin', { exact: true })).toBeVisible();
});
