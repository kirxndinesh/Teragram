import { expect, test } from '@playwright/test';
import { desktopFixture } from './desktop-fixture';

for (const theme of ['light', 'dark'] as const) {
  test(`accordion rows and hover-only chevrons in ${theme}`, async ({ page }) => {
    await desktopFixture(page, { gallery: true, theme, settings: { startupView: 'photos', quickAccessExpanded: false, foldersExpanded: true } });
    await page.goto('/');
    const quick = page.locator('.cloud-quick-navigation');
    const quickRow = quick.getByRole('button', { name: 'Quick Access', exact: true });
    const quickChevron = quick.locator('.cloud-tree-chevron');
    const folders = page.locator('.cloud-folder-navigation');
    const folderRow = folders.getByRole('button', { name: 'Folders', exact: true });
    const folderChevron = folders.locator('.cloud-tree-chevron');
    await expect(folders.getByRole('button', { name: 'Add Existing Channel', exact: true })).toHaveCount(0);
    await page.mouse.move(900, 70);
    await expect(quickChevron).toHaveCSS('opacity', '0');
    await expect(folderChevron).toHaveCSS('pointer-events', 'none');
    await quickRow.hover(); await expect(quickChevron).toHaveCSS('opacity', '1');
    await quickRow.click(); await expect(quickRow).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Favorites', exact: true })).toBeVisible();
    await expect(page.locator('.cloud-content-heading h1')).toHaveText('Photos');
    await quickChevron.click(); await expect(quickRow).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Favorites', exact: true })).toHaveCount(0);
    await quickRow.locator('svg').first().click(); await expect(quickRow).toHaveAttribute('aria-expanded', 'true');
    await quickRow.locator('span').first().click(); await expect(quickRow).toHaveAttribute('aria-expanded', 'false');
    await folderRow.click(); await expect(page.locator('.cloud-content-heading h1')).toHaveText('Folders');
    await expect(folderChevron).toHaveAttribute('aria-expanded', 'true');
    await folderRow.click(); await expect(folderChevron).toHaveAttribute('aria-expanded', 'false');
    await folders.hover(); await expect(folderChevron).toHaveCSS('opacity', '1');
    await folderChevron.click(); await expect(folderChevron).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.cloud-content-heading h1')).toHaveText('Folders');
    await page.mouse.move(900, 70); await folderChevron.blur();
    await expect(folderChevron).toHaveCSS('opacity', '0');
    await folderRow.focus(); await expect(folderChevron).toHaveCSS('opacity', '1');
    await quickRow.focus(); await page.keyboard.press('Enter'); await expect(quickRow).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Space'); await expect(quickRow).toHaveAttribute('aria-expanded', 'false');
  });

  test(`Folders has one heading and two matching icon actions in ${theme}`, async ({ page }) => {
    await desktopFixture(page, { gallery: true, theme }); await page.goto('/');
    await page.locator('.cloud-folder-navigation').getByRole('button', { name: 'Folders', exact: true }).click();
    await expect(page.locator('.cloud-workspace').getByRole('heading', { name: 'Folders', exact: true })).toHaveCount(1);
    const toolbar = page.locator('.cloud-folder-overview-toolbar');
    const add = toolbar.getByRole('button', { name: 'Add Existing Channel', exact: true });
    const create = toolbar.getByRole('button', { name: 'Create Folder', exact: true });
    await expect(toolbar.getByRole('button')).toHaveCount(2);
    for (const action of [add, create]) {
      await expect(action).toHaveText(''); await expect(action).toHaveCSS('width', '36px');
      await expect(action).toHaveCSS('height', '36px'); await expect(action).toHaveCSS('border-radius', '10px');
      await expect(action).toHaveCSS('border-top-width', '0px'); await expect(action.locator('svg')).toHaveAttribute('width', '20');
    }
    await expect(add).toHaveAttribute('title', 'Add Existing Channel');
    await expect(create).toHaveAttribute('title', 'Create Folder');
    const a = (await add.boundingBox())!; const b = (await create.boundingBox())!;
    expect(a.y).toBeCloseTo(b.y, 0); expect(b.x-a.x-a.width).toBeCloseTo(8, 0);
    await add.click(); await expect(page.getByRole('dialog', { name: 'Add Existing Channel', exact: true })).toBeVisible();
    await page.keyboard.press('Escape'); await create.click();
    await expect(page.getByRole('dialog', { name: 'Create Folder', exact: true })).toBeVisible();
  });
}
