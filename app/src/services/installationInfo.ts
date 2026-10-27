import { invoke } from '@tauri-apps/api/core';

export interface InstallationInfo {
    managedByPackageManager: boolean;
    packageManager: 'pacman' | null;
}

const SELF_MANAGED_INSTALLATION: InstallationInfo = {
    managedByPackageManager: false,
    packageManager: null,
};

let installationInfoPromise: Promise<InstallationInfo> | null = null;

export function getInstallationInfo(): Promise<InstallationInfo> {
    if (!installationInfoPromise) {
        installationInfoPromise = invoke<InstallationInfo>('cmd_get_installation_info')
            .catch(() => SELF_MANAGED_INSTALLATION);
    }
    return installationInfoPromise;
}
