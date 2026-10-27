import { expect, test } from '@playwright/test';
import { desktopFixture, openSettings } from './desktop-fixture';

test('Folders label selects overview while its chevron only expands the tree', async ({ page }) => {
  await desktopFixture(page, { gallery: true }); await page.goto('/');
  await page.locator('.cloud-sidebar').getByRole('button', { name: 'Folders', exact: true }).click();
  await expect(page.locator('.cloud-content-heading h1')).toHaveText('Folders');
  await expect(page.locator('.one-folder-card')).toHaveCount(3);
  await page.locator('.cloud-folder-navigation').hover();
  await page.getByRole('button', { name: 'Collapse folders', exact: true }).click();
  await expect(page.locator('.cloud-channel-list')).not.toBeVisible();
  await expect(page.locator('.cloud-channel-list').getByRole('button')).toHaveCount(0);
  await expect(page.locator('.cloud-content-heading h1')).toHaveText('Folders');
  await page.locator('.one-folder-card').filter({ hasText: 'MTI' }).getByRole('button').first().click();
  await expect(page.locator('.cloud-content-heading h1')).toHaveText('MTI');
  await expect(page.locator('.cloud-folder-section')).toHaveCount(0);
  await expect(page.locator('.cloud-type-tabs button')).toHaveText(['Photos', 'Videos', 'Files', 'Documents', 'Audio']);
});

test('Photos sorting is reactive and allocation controls are borderless icons', async ({ page }) => {
  await desktopFixture(page, { gallery: true, settings: { startupView: 'photos', fileSortField: 'date' } }); await page.goto('/');
  const toolbar = page.locator('.cloud-view-controls');
  const allocation = toolbar.getByRole('button', { name: 'Manage allocated folders', exact: true });
  await expect(allocation).toBeVisible(); await expect(allocation).not.toContainText('Manage');
  await page.getByRole('button', { name: 'Sort files', exact: true }).click();
  await page.getByRole('group', { name: 'Sort files', exact: true }).getByRole('button', { name: 'Name', exact: true }).click();
  await expect(page.locator('.cloud-media-caption strong').first()).toHaveText('Alpine morning.jpg');
  await page.getByRole('group', { name: 'Sort files', exact: true }).getByRole('button', { name: 'Name', exact: true }).click();
  await expect(page.locator('.cloud-media-caption strong').first()).toHaveText('Weekend film.mp4');
  await page.keyboard.press('Escape'); await allocation.click();
  await expect(page.getByRole('dialog', { name: 'Allocated photo folders', exact: true })).toBeVisible();
});

test('mini rail icons are centered in matching 44 pixel circles', async ({ page }) => {
  await desktopFixture(page, { gallery: true }); await page.goto('/'); await page.locator('.cloud-brand').click();
  await expect(page.locator('.cloud-sidebar')).toHaveCSS('width', '68px');
  const centers = await page.locator('.cloud-sidebar nav > .cloud-nav-item, .cloud-sidebar .cloud-accordion-trigger').evaluateAll(items => items.map(item => {
    const rect = item.getBoundingClientRect(); const icons = [...item.querySelectorAll('svg')].filter(icon => getComputedStyle(icon).display !== 'none'); const icon = icons[0].getBoundingClientRect();
    return { width: rect.width, height: rect.height, offset: Math.abs((rect.x + rect.width / 2) - (icon.x + icon.width / 2)) };
  }));
  expect(centers.every(value => value.width === 44 && value.height === 44 && value.offset < 1)).toBe(true);
});

test('About displays v1.0 and thumbnail slider has no painted border', async ({ page }) => {
  await desktopFixture(page); await page.goto('/'); await openSettings(page);
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(dialog.getByRole('slider', { name: 'Thumbnail size', exact: true })).toHaveCSS('border-top-width', '0px');
  await dialog.getByRole('button', { name: 'About', exact: true }).click(); await expect(dialog).toContainText('v1.0');
});

test('Favorites renders its locally cached metadata without a folder network scan', async ({page})=>{
  await desktopFixture(page,{gallery:true,settings:{startupView:'photos'}});await page.goto('/');
  const tile=page.locator('.cloud-media-tile').filter({has:page.getByRole('button',{name:'Open Alpine morning.jpg',exact:true})});
  await tile.hover();await tile.getByRole('button',{name:'Favorite Alpine morning.jpg',exact:true}).click();
  const scans=await page.evaluate(()=>(window as any).__desktopTest.calls.filter((call:any)=>['cmd_scan_folder_files','cmd_fetch_files'].includes(call.command)).length);
  await page.locator('.cloud-sidebar').getByRole('button',{name:'Favorites',exact:true}).click();
  await expect(page.locator('.cloud-content-heading h1')).toHaveText('Favorites');
  await expect(page.getByText('Alpine morning.jpg',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__desktopTest.calls.filter((call:any)=>['cmd_scan_folder_files','cmd_fetch_files'].includes(call.command)).length)).toBe(scans);
});
