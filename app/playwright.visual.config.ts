import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Teragram's current local desktop UI, including gallery snapshots and axe.
// Historical supporter purchase fixtures are not part of this application.
export default defineConfig(base, {
  testMatch: [
    '**/visual/design-gallery.spec.ts',
    '**/visual/accessibility-dashboard.spec.ts',
    '**/visual/confirmation-dialog.spec.ts',
    '**/visual/download-collision.spec.ts',
    '**/visual/storage-cleanup.spec.ts',
    '**/visual/workspace-features.spec.ts',
  ],
  use: {
    launchOptions: process.env.TG_DRIVE_BROWSER
      ? { executablePath: process.env.TG_DRIVE_BROWSER }
      : {},
  },
});
