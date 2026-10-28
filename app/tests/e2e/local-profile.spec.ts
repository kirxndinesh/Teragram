import { expect, test } from '@playwright/test';
import { desktopFixture, nativeCalls, openSettings } from './desktop-fixture';

// The local Teragram frontend has no sponsor or purchase UI. Existing native
// entitlements remain covered by the Worker/native compatibility journeys.
for (const supporterState of ['inactive', 'active', 'needs_refresh', 'expired'] as const) {
  test(`local desktop stays usable without sponsor or purchase requests for ${supporterState} legacy state`, async ({ page }) => {
    await page.clock.install();
    await desktopFixture(page, { gallery: true, supporterState, settings: { startupView: 'photos' } });
    const sponsorRequests: string[] = [];
    page.on('request', request => {
      if (/\/ad-banner|\/ad-gateway/.test(request.url())) sponsorRequests.push(request.url());
    });
    await page.goto('/');
    await expect(page.locator('.cloud-content-heading h1')).toHaveText('Photos', { timeout: 30_000 });
    await openSettings(page);
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
    await settings.getByRole('button', { name: 'About', exact: true }).click();
    await expect(settings).toContainText('Teragram');
    await expect(settings.locator('#desktop-supporter-section')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.clock.fastForward(24 * 60 * 60_000);
    await expect(page.locator('iframe[src*="/ad-banner"], iframe[src*="/ad-gateway"]')).toHaveCount(0);
    expect(sponsorRequests).toEqual([]);
    for (const command of ['cmd_begin_supporter_checkout', 'cmd_activate_supporter', 'cmd_submit_crash_report']) {
      expect(await nativeCalls(page, command)).toHaveLength(0);
    }
    await page.reload();
    await expect(page.locator('.cloud-content-heading h1')).toHaveText('Photos', { timeout: 30_000 });
    await expect(page.getByRole('dialog', { name: /supporter|purchase/i })).toHaveCount(0);
  });
}
