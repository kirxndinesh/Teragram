import { expect, test, type Locator } from '@playwright/test';
import { desktopFixture, nativeCalls } from './desktop-fixture';

async function footerGeometry(dialog: Locator) {
  const footer = dialog.locator('footer'), cancel = footer.getByRole('button', { name: 'Cancel', exact: true });
  const primary = footer.getByRole('button').last();
  await expect(footer).toHaveCSS('gap', '12px');
  for (const button of [cancel, primary]) {
    await expect(button).toHaveCSS('height', '40px');
    await expect(button).toHaveCSS('border-radius', '10px');
    await expect(button).toHaveCSS('font-size', '14px');
  }
  const a = (await cancel.boundingBox())!, b = (await primary.boundingBox())!;
  expect(b.x - a.x - a.width).toBeGreaterThanOrEqual(11);
  expect(a.y).toBeCloseTo(b.y, 0);
}

for (const theme of ['dark', 'light'] as const) {
  test(`Create Folder stacks fields and wraps its callout in ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1000, height: 650 });
    await desktopFixture(page, { gallery: true, theme, settings: { startupView: 'photos' } });
    await page.goto('/');
    await page.getByLabel('Add files', { exact: true }).click();
    await page.getByRole('button', { name: 'Create Folder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Create Folder', exact: true });
    await expect(dialog).toHaveCSS('border-radius', '20px');
    expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(440);
    const input = dialog.getByRole('textbox', { name: 'Folder name', exact: true });
    const label = dialog.getByText('Folder name', { exact: true });
    await expect(input).toHaveCSS('height', '42px');
    const labelBox = (await label.boundingBox())!, inputBox = (await input.boundingBox())!, box = (await dialog.boundingBox())!;
    expect(inputBox.y - labelBox.y - labelBox.height).toBeGreaterThanOrEqual(7);
    expect(inputBox.x + inputBox.width).toBeLessThan(box.x + box.width);
    await expect(dialog.locator('.folder-info > span')).toHaveCSS('white-space', 'normal');
    expect(await dialog.locator('.folder-info').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await footerGeometry(dialog);
    const submit = dialog.getByRole('button', { name: 'Create private folder', exact: true });
    await expect(submit).toBeDisabled(); await expect(submit).toHaveCSS('opacity', '0.5');
    await input.fill('   '); await expect(submit).toBeDisabled();
    await input.fill('Project files'); await expect(submit).toBeEnabled();
    await page.setViewportSize({ width: 500, height: 500 });
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`create-folder-${theme}.png`) });
    await submit.click(); await expect(dialog).toHaveCount(0);
    expect((await nativeCalls(page, 'cmd_create_folder')).at(-1)?.args).toMatchObject({ name: 'Project files' });
  });

  test(`Import channel search, selection and fixed footer fit in ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1000, height: 650 });
    await desktopFixture(page, { gallery: true, theme, settings: { startupView: 'photos' } });
    await page.addInitScript(() => {
      const bridge = (window as any).__TAURI_INTERNALS__, invoke = bridge.invoke;
      bridge.invoke = async (command: string, args: any) => {
        if (command === 'cmd_list_import_channels') return Array.from({ length: 48 }, (_, index) => ({ id: index + 300, title: `Channel ${String(index + 1).padStart(2, '0')}`, username: null, members: index + 1, kind: 'channel' }));
        if (command === 'cmd_get_channel_details') return null;
        return invoke(command, args);
      };
    });
    await page.goto('/');
    await page.locator('.cloud-folder-navigation').getByRole('button', { name: 'Folders', exact: true }).click();
    await page.locator('.cloud-folder-overview-toolbar').getByRole('button', { name: 'Add Existing Channel', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Existing Channel', exact: true });
    const search = dialog.getByRole('textbox', { name: 'Search channels and groups', exact: true });
    await search.focus(); await expect(search).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(search).toHaveCSS('border-top-width', '0px');
    await expect(dialog.locator('.channel-import-search')).toHaveCSS('height', '42px');
    await expect(dialog.getByText('1 member', { exact: true })).toBeVisible();
    await expect(dialog.getByText('2 members', { exact: true })).toBeVisible();
    const first = dialog.getByRole('checkbox', { name: 'Channel 01', exact: true });
    await expect(first).toHaveCSS('appearance', 'none');
    await expect(first).toHaveCSS('width', '20px');
    await expect(first).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    const add = dialog.getByRole('button', { name: /^Add to Folders/ });
    await expect(add).toBeDisabled(); await footerGeometry(dialog);
    await dialog.getByText('Channel 01', { exact: true }).click(); await expect(first).toBeChecked();
    await expect(first.locator('..').locator('svg')).toHaveCSS('opacity', '1');
    await expect(add).toBeEnabled();
    const footerBox = (await dialog.locator('footer').boundingBox())!;
    await dialog.getByRole('checkbox', { name: 'Channel 48', exact: true }).scrollIntoViewIfNeeded();
    expect((await dialog.locator('footer').boundingBox())!.y).toBeCloseTo(footerBox.y, 0);
    expect((await dialog.locator('.channel-import-list').boundingBox())!.height).toBeLessThanOrEqual(320);
    await search.fill('Channel 01'); await expect(dialog.getByRole('checkbox')).toHaveCount(1);
    await first.focus(); await page.keyboard.press('Space'); await expect(first).not.toBeChecked();
    await page.keyboard.press('Space'); await expect(first).toBeChecked();
    await page.screenshot({ path: testInfo.outputPath(`import-channel-${theme}.png`) });
    await add.click(); await expect(dialog).toHaveCount(0);
    expect((await nativeCalls(page, 'cmd_import_channels')).at(-1)?.args).toMatchObject({ ownerId: '101', channelIds: [300] });
  });
}
