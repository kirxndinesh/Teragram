import { load } from '@tauri-apps/plugin-store';
import type { Settings } from '../types/settings';

const SETTINGS_FILE = 'settings.json';
const SETTINGS_KEY = 'settings';

export interface SettingsStore {
  get<T>(key: string): Promise<T | null | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

type StoreLoader = () => Promise<SettingsStore>;

const loadSettingsStore: StoreLoader = () => load(SETTINGS_FILE);

// A legacy password is retained only until the Rust backend confirms that it
// was migrated into secure credential storage. New passwords are never written
// to the plugin-store JSON file.
let unmigratedLegacyProxyPassword: string | null = null;

export function markProxySecretMigrated(): void {
  unmigratedLegacyProxyPassword = null;
}

export function settingsForPersistence(settings: Settings): Settings {
  const passwordIsUnchangedLegacy = unmigratedLegacyProxyPassword !== null
    && settings.proxyPassword === unmigratedLegacyProxyPassword;
  if (!passwordIsUnchangedLegacy) {
    // Once the user replaces or clears a legacy value, never write the old
    // credential back over the newly secured value.
    unmigratedLegacyProxyPassword = null;
  }
  return {
    ...settings,
    proxyPassword: passwordIsUnchangedLegacy ? settings.proxyPassword : '',
  };
}

export function mergeStoredSettings(defaults: Settings, stored?: Partial<Settings> | null): Settings {
  const sanitized = { ...stored } as Partial<Settings> & { floatSidebar?: boolean };
  delete sanitized.floatSidebar;
  const merged = { ...defaults, ...sanitized };
  if (stored && stored.startupViewVersion !== 1) merged.startupView = 'photos';
  merged.startupViewVersion = 1;
  if (stored?.uploadConcurrencyVersion !== 1 && merged.maxConcurrentUploads === 6) merged.maxConcurrentUploads = 2;
  if (stored?.uploadConcurrencyVersion !== 1 && merged.zipFolders) merged.zipFolders = false;
  merged.uploadConcurrencyVersion = 1;
  if ((merged.proxyType as string) === 'mtproto') merged.proxyType = 'socks5';
  merged.thumbnailScale = Number.isFinite(merged.thumbnailScale) ? Math.min(2, Math.max(0.5, merged.thumbnailScale)) : defaults.thumbnailScale;
  if (!['cloud', 'photos', 'recents'].includes(merged.startupView)) merged.startupView = defaults.startupView;
  if (typeof merged.downloadDirectory !== 'string') merged.downloadDirectory = '';
  if (typeof merged.quickAccessExpanded !== 'boolean') merged.quickAccessExpanded = false;
  for (const key of ['sidebarCollapsed', 'foldersExpanded'] as const) {
    if (typeof merged[key] !== 'boolean') merged[key] = defaults[key];
  }
  const allocations = merged.photoFolderAllocations;
  merged.photoFolderAllocations = allocations && typeof allocations === 'object' && !Array.isArray(allocations)
    ? Object.fromEntries(Object.entries(allocations).filter(([, values]) => Array.isArray(values) && values.every(value => typeof value === 'string')))
    : {};
  return merged;
}

export async function readPersistedSettings(
  defaults: Settings,
  loadStore: StoreLoader = loadSettingsStore,
  onError?: (error: unknown) => void,
): Promise<Settings> {
  try {
    const store = await loadStore();
    const stored = await store.get<Partial<Settings>>(SETTINGS_KEY);
    unmigratedLegacyProxyPassword = stored?.proxyPassword || null;
    const merged = mergeStoredSettings(defaults, stored);
    if (stored && Object.prototype.hasOwnProperty.call(stored, 'floatSidebar')) {
      await store.set(SETTINGS_KEY, settingsForPersistence(merged));
      await store.save();
    }
    return merged;
  } catch (error) {
    onError?.(error);
    return defaults;
  }
}

export async function writePersistedSettings(
  settings: Settings,
  loadStore: StoreLoader = loadSettingsStore,
): Promise<void> {
  const store = await loadStore();
  await store.set(SETTINGS_KEY, settingsForPersistence(settings));
  await store.save();
}
