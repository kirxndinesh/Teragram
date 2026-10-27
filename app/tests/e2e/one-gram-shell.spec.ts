import { expect, test } from '@playwright/test';
import { desktopFixture, openSettings } from './desktop-fixture';

for (const theme of ['dark', 'light'] as const) {
  test(`Teragram Material shell and stationary chrome in ${theme}`, async ({ page }, testInfo) => {
    await desktopFixture(page, { gallery: true, theme });
    await page.goto('/');
    await expect(page).toHaveTitle('Teragram');
    await expect(page.locator('.cloud-brand')).toHaveText('Teragram');
    await expect(page.locator('.cloud-brand img')).toHaveAttribute('src', '/teragram-logo.svg');
    await expect(page.locator('.cloud-workspace')).toHaveCSS('border-radius', '24px');
    await expect(page.locator('.cloud-workspace')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(19, 19, 20)' : 'rgb(255, 255, 255)');
    await expect(page.getByRole('button', { name: 'Your library', exact: true })).toHaveCount(0);
    await expect(page.locator('.cloud-header .cloud-upload-menu')).toHaveCount(0);
    await page.getByRole('button', { name: 'Grid view', exact: true }).click();
    await expect(page.locator('.cloud-document-grid')).toBeVisible();
    await page.locator('.cloud-sidebar').getByRole('button', { name: 'Photos', exact: true }).click();
    await expect(page.locator('.cloud-media-tile')).toHaveCount(6);
    const header = await page.locator('.cloud-header').boundingBox();
    await page.locator('.cloud-workspace').evaluate(el => el.scrollTop = el.scrollHeight);
    expect(await page.locator('.cloud-header').boundingBox()).toEqual(header);
    await page.screenshot({ path: testInfo.outputPath(`one-gram-${theme}.png`), animations: 'disabled' });
  });
}

test('sidebar rail persists, keeps navigation and does not steal typing shortcuts', async ({ page }) => {
  await desktopFixture(page, { gallery: true }); await page.goto('/');
  await page.locator('.cloud-brand').hover();
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await expect(page.locator('.cloud-sidebar')).toHaveCSS('width', '68px');
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Photos', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('Photos');
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Photos', exact: true }).click();
  await expect(page.locator('.cloud-content-heading h1')).toHaveText('Photos');
  await page.reload();
  await expect(page.locator('.cloud-sidebar')).toHaveCSS('width', '68px');
  await page.keyboard.press('ControlOrMeta+b');
  await expect(page.locator('.cloud-sidebar')).toHaveCSS('width', '248px');
  await page.locator('[data-file-search]').focus();
  await page.keyboard.press('ControlOrMeta+b');
  await expect(page.locator('.cloud-sidebar')).toHaveCSS('width', '248px');
});

test('removed Float Sidebar setting cannot be restored by legacy preferences', async ({ page }) => {
  await desktopFixture(page, { gallery: true, settings: { floatSidebar: true } }); await page.goto('/');
  await openSettings(page);
  await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).not.toContainText('Float Sidebar');
  await expect(page.locator('.cloud-sidebar')).not.toHaveAttribute('data-floating');
});

test('New menu keeps upload actions and creates folders from the sidebar', async ({ page }) => {
  await desktopFixture(page, { gallery: true }); await page.goto('/');
  const sidebar = page.locator('.cloud-sidebar');
  await sidebar.getByLabel('Add files', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Upload File', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload Folder', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sidebar.locator('details')).not.toHaveAttribute('open');
  await sidebar.getByLabel('Add files', { exact: true }).click();
  await page.locator('.cloud-new-options').getByRole('button', { name: 'Create Folder', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create Folder', exact: true })).toBeVisible();
});

test('the recessed workspace scrolls a large virtualized list and retains folder actions', async ({ page }) => {
  const files = Array.from({ length: 320 }, (_, index) => ({ id: index + 200, key: `10:${index + 200}`, folder_id: 10, name: `Report ${String(index + 1).padStart(3, '0')}.txt`, size: 2048, mime_type: 'text/plain', icon_type: 'file', file_ext: 'txt', created_at: '2026-10-26 00:00:00 UTC', encryption_state: 'plain', tags: [], collectionIds: [] }));
  await desktopFixture(page, { gallery: true, metadataFiles: files, settings: { startupView: 'cloud', viewMode: 'list' } });
  await page.goto('/');
  await expect(page.getByText('Report 001.txt', { exact: true })).toBeVisible();
  await page.locator('.cloud-folder-navigation').getByRole('button', { name: 'Folders', exact: true }).click();
  await page.locator('.one-folder-card').filter({ hasText: 'MTI' }).getByRole('button', { name: 'Folder settings', exact: true }).click();
  await expect(page.locator('.one-folder-menu').getByRole('button', { name: 'Rename', exact: true })).toBeVisible();
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'My Cloud', exact: true }).click();
  await page.locator('.cloud-workspace').evaluate(element => element.scrollTo(0, element.scrollHeight));
  await expect(page.getByText('Report 320.txt', { exact: true })).toBeVisible();
  expect(await page.locator('.cloud-table-row').count()).toBeLessThan(60);
  await expect(page.locator('.cloud-header')).toBeInViewport();
  await expect(page.locator('.cloud-brand')).toBeInViewport();
});
