import axe from 'axe-core';
import { expect, test } from '@playwright/test';
import { desktopFixture, nativeCalls, openSettings } from './desktop-fixture';

test('neutral shell uses sidebar storage and a compact header', async ({ page }, testInfo) => {
  await desktopFixture(page, { gallery: true, theme: 'dark', settings: { startupView: 'photos' } });
  await page.goto('/');
  await expect(page.locator('.tg-main')).toHaveCSS('background-color', 'rgb(30, 31, 32)');
  await expect(page.locator('.cloud-storage')).toHaveCount(0);
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Storage', exact: true }).click();
  const storage = page.getByRole('dialog', { name: 'Storage', exact: true });
  await expect(storage).toContainText('48.77 MB');
  await expect(storage).toContainText('Videos');
  await page.screenshot({ path: testInfo.outputPath('tg-drive-storage.png') });
  await page.keyboard.press('Escape');
  await page.getByLabel('Add files', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Upload Folder', exact: true })).toBeVisible();
  await expect(page.locator('.cloud-new-options').getByRole('button', { name: 'Create Folder', exact: true })).toBeVisible();
});

test('Themes has three modes and a validated persistent accent', async ({ page }, testInfo) => {
  await desktopFixture(page, { theme: 'dark', settings: { startupView: 'cloud' } });
  await page.goto('/');
  await openSettings(page);
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await dialog.getByRole('button', { name: 'Themes', exact: true }).click();
  await expect(dialog.getByText('common.default', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('group', { name: 'Theme', exact: true }).getByRole('button')).toHaveCount(3);
  const hex = dialog.getByLabel('Hex color', { exact: true });
  await hex.fill('');
  await hex.pressSequentially('#E11D48', { delay: 30 });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim())).toBe('#E11D48');
  await hex.fill('#BADHEX');
  await expect(hex).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim())).toBe('#E11D48');
  await page.reload();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim())).toBe('#E11D48');
  await expect(page.locator('.cloud-sidebar')).toBeVisible();
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => (await (window as any).axe.run('.cloud-sidebar')).violations.map((v: any) => v.id));
  expect(violations).toEqual([]);
  await openSettings(page);
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Themes', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('group', { name: 'Theme', exact: true }).getByRole('button', { name: 'System', exact: true }).click();
  await expect(page.getByLabel('Hex color', { exact: true })).toHaveCSS('color', 'rgb(31, 31, 31)');
  await expect(page.locator('input[placeholder="Search settings"]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const themeAudit = await page.evaluate(async () => (await (window as any).axe.run('[role=dialog]')).violations.map((v: any) => ({ id: v.id, targets: v.nodes.map((n: any) => n.target) })));
  expect(themeAudit).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('tg-drive-themes.png'), animations: 'disabled' });
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('MP4 lightbox has one HUD and no duplicate native or history controls', async ({ page }) => {
  await desktopFixture(page, { gallery: true, settings: { startupView: 'photos' } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Weekend film.mp4', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Weekend film.mp4', exact: true });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('video')).toHaveCount(1);
  await expect(viewer.locator('video[controls]')).toHaveCount(0);
  await expect(viewer.locator('.media-hud-bottom')).toHaveCount(1);
  await expect(viewer.getByRole('button', { name: 'Restart', exact: true })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Mark finished', exact: true })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Skip back 10 seconds', exact: true })).toBeVisible();
  await expect(viewer.getByRole('combobox', { name: 'Playback speed', exact: true })).toBeVisible();
  expect((await nativeCalls(page, 'cmd_get_stream_info')).length).toBeGreaterThan(0);
});

test('real MP4 playback uses the unified controls and hides HUD after inactivity', async ({ page }, testInfo) => {
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(new URL('../fixtures/polish-video.mp4', import.meta.url));
  await desktopFixture(page, { gallery: true, theme: 'dark', settings: { startupView: 'photos' } });
  await page.route('http://localhost:14201/stream/**', async route => {
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? '');
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(bytes.length - 1, Number(range[2])) : bytes.length - 1;
    await route.fulfill({ status: range ? 206 : 200, contentType: 'video/mp4', body: bytes.subarray(start, end + 1), headers: { 'accept-ranges': 'bytes', 'content-length': String(end - start + 1), 'access-control-allow-origin': '*', ...(range ? { 'content-range': `bytes ${start}-${end}/${bytes.length}` } : {}) } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Weekend film.mp4', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Weekend film.mp4', exact: true });
  const video = viewer.locator('video');
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).readyState), { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  await video.evaluate(element => { const media = element as HTMLVideoElement; media.loop = true; });
  await viewer.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('1.5');
  expect(await video.evaluate(element => (element as HTMLVideoElement).playbackRate)).toBe(1.5);
  await viewer.locator('.media-volume').hover();
  await viewer.getByRole('slider', { name: 'Playback volume', exact: true }).fill('0.5');
  expect(await video.evaluate(element => (element as HTMLVideoElement).volume)).toBe(.5);
  await viewer.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('volume', .5);
  await viewer.getByRole('button', { name: 'Unmute', exact: true }).click();
  await expect(video).toHaveJSProperty('muted', false);
  await expect(video).toHaveJSProperty('volume', .5);
  await viewer.getByRole('slider', { name: 'Seek in media', exact: true }).fill('1');
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(.9);
  if (await viewer.getByRole('button', { name: 'Play', exact: true }).isVisible()) await viewer.getByRole('button', { name: 'Play', exact: true }).click();
  await page.mouse.move(550, 300);
  await expect(viewer).toHaveClass(/hud-hidden/, { timeout: 7000 });
  await page.mouse.move(560, 310);
  await expect(viewer).not.toHaveClass(/hud-hidden/);
  await viewer.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(video).toHaveJSProperty('paused', true);
  await expect(viewer.locator('.media-hud-bottom')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('tg-drive-media-hud.png') });
});

test('gallery replaces a decoded black video frame with media placeholders', async ({ page }) => {
  await desktopFixture(page, { gallery: true, blackVideoThumbnail: true, settings: { startupView: 'photos' } });
  await page.goto('/');
  const videoTile = page.locator('[data-file-key="10:46"]');
  await expect(videoTile.locator('.cloud-media-fallback')).toBeVisible();
  await expect(videoTile).toContainText('Preview unavailable');
  await expect(videoTile.locator('.cloud-video-badge')).toContainText('0:19');
  await expect(videoTile.locator('img')).toHaveCount(0);
  await expect(page.locator('.cloud-media-open img')).toHaveCount(5);
});


test('missing thumbnails keep a loading skeleton and resolve to a media placeholder', async ({ page }) => {
  await desktopFixture(page, { gallery: true, missingThumbnails: true, holdThumbnails: true, theme: 'dark', settings: { startupView: 'photos' } });
  await page.goto('/');
  await expect(page.locator('.cloud-media-fallback.is-loading')).toHaveCount(6);
  await page.evaluate(() => (window as any).__desktopTest.releaseThumbnails());
  await expect(page.locator('.cloud-media-fallback.is-loading')).toHaveCount(0);
  await expect(page.locator('.cloud-media-fallback')).toHaveCount(6);
  await expect(page.locator('.cloud-media-open img')).toHaveCount(0);
  await expect(page.locator('.cloud-video-badge')).toContainText('0:19');
});
