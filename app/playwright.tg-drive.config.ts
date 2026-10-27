import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig(base, {
  testMatch: [
    '**/teragram-upload-refresh.spec.ts',
    '**/teragram-transfer-banner.spec.ts', '**/transfer-cleanup.spec.ts',
    '**/teragram-folder-dialogs.spec.ts',
    '**/teragram-gallery-cache.spec.ts',
    '**/teragram-sidebar-polish.spec.ts',
    '**/teragram-refinements.spec.ts',
    '**/teragram-motion.spec.ts',
    '**/onegram-v1.spec.ts', '**/onegram-v1-player.spec.ts',
    '**/pdf-preview.spec.ts', '**/onegram-mac.spec.ts', '**/one-gram-shell.spec.ts', '**/onegram-final.spec.ts',
    '**/tg-fixes.spec.ts', '**/tg-polish.spec.ts', '**/tg-overhaul.spec.ts', '**/tg-drive.spec.ts', '**/authentication.spec.ts', '**/search-filters.spec.ts',
    '**/desktop-reliability.spec.ts', '**/upload-protection.spec.ts',
    '**/sync-settings.spec.ts',
  ],
  use: {
    launchOptions: process.env.TG_DRIVE_BROWSER
      ? { executablePath: process.env.TG_DRIVE_BROWSER }
      : {},
  },
});
