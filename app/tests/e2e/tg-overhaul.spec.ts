import { expect, test } from '@playwright/test';
import { desktopFixture } from './desktop-fixture';

test('a plain file click previews while the checkbox alone selects', async ({ page }) => {
  await desktopFixture(page, { settings: { viewMode: 'list', startupView: 'cloud' } });
  await page.goto('/');
  await page.getByText('Saved Messages', { exact: true }).first().click();
  const file = page.getByText('Holiday saved photo.jpg', { exact: true });
  await expect(file).toBeVisible();
  await file.click();
  await expect(page.locator('.viewer-overlay')).toBeVisible();
  await expect(page.locator('.cloud-bulk-bar')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('checkbox', { name: 'Select Holiday saved photo.jpg', exact: true }).check();
  await expect(page.locator('.cloud-bulk-bar')).toBeVisible();
  await expect(page.locator('.viewer-overlay')).toHaveCount(0);
});

test('Photos aggregates folders, persists allocations and never requests sponsors', async ({ page }) => {
  await desktopFixture(page, { supporterState: 'inactive', gatewaySeen: false, settings: { startupView: 'cloud' } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Photos', exact: true }).first().click();
  await expect(page.locator('.cloud-media-tile')).toHaveCount(2);
  await page.getByRole('button', { name: 'Manage allocated folders', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Allocated photo folders', exact: true });
  await dialog.getByRole('checkbox', { name: 'Saved Messages' }).uncheck();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.cloud-media-tile')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'Photos', exact: true }).first().click();
  await expect(page.locator('.cloud-media-tile')).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).__desktopTest.calls.filter((call: any) => /supporter|sponsor/i.test(call.command)))).toEqual([]);
  await expect(page.locator('iframe[src*="ad"], iframe[src*="sponsor"]')).toHaveCount(0);
});

test('same Telegram message IDs in different folders stay distinct for bulk actions and previews', async ({ page }) => {
  await desktopFixture(page, { gallery: true, settings: { startupView: 'photos', downloadDirectory: '/synthetic/Downloads' } });
  await page.goto('/');
  const alpine = page.locator('[data-file-key="9:42"]');
  const portrait = page.locator('[data-file-key="10:42"]');
  await alpine.getByRole('checkbox').check();
  await expect(portrait.getByRole('checkbox')).not.toBeChecked();
  await portrait.getByRole('checkbox').check();
  await expect(page.locator('.cloud-bulk-bar')).toContainText('2 items selected');
  await page.locator('.cloud-bulk-bar').getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__desktopTest.calls.filter((c: any) => c.command === 'cmd_set_file_activity_flag').map((c: any) => [c.args.folderId, c.args.messageId]).sort())).toEqual([[10, 42], [9, 42]].sort());
  await expect(page.locator('.cloud-bulk-bar')).toHaveCount(0);
  await portrait.getByRole('button', { name: 'Open Quiet portrait.jpg', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Quiet portrait.jpg', exact: true });
  await expect(viewer).toBeVisible();
  await viewer.getByRole('button', { name: 'File info', exact: true }).click();
  await expect(viewer.locator('dd').filter({ hasText: 'Aswathy' })).toBeVisible();
  await viewer.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(viewer).toContainText('125%');
  await viewer.getByRole('button', { name: 'Delete', exact: true }).click();
  const confirmation = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Cancel', exact: true }) });
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(viewer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.viewer-overlay')).toHaveCount(0);
});

test('Shift selection follows the visible sort order after a checkbox anchor', async ({ page }) => {
  await desktopFixture(page, { gallery: true, settings: { startupView: 'cloud' } });
  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Select Quiet portrait.jpg', exact: true }).check();
  await page.getByText('Studio notes.jpg', { exact: true }).click({ modifiers: ['Shift'] });
  await expect(page.locator('.cloud-bulk-bar')).toContainText('2 items selected');
  await expect(page.getByRole('checkbox', { name: 'Select Quiet portrait.jpg', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Select Studio notes.jpg', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Select Alpine morning.jpg', exact: true })).not.toBeChecked();
  await expect(page.locator('.viewer-overlay')).toHaveCount(0);
});
