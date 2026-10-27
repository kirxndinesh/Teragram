import { version as appVersion } from '../../package.json';
import { invoke } from '@tauri-apps/api/core';
type CrashSource = 'react' | 'window' | 'promise';
export function configureLocalCrashLogs() {
  // Discard old pending uploads; a previous consent flag can never restore them.
  try { localStorage.removeItem('telegram-drive-crash-reports'); } catch { /* Storage may be unavailable. */ }
}
/** Crash shape only, written through the native rotating/redacted local logger. */
export function reportCrash(error: unknown, source: CrashSource) {
  const errorType = error instanceof Error && /^[A-Za-z0-9_]{1,96}$/.test(error.name) ? error.name : 'UnknownError';
  const frames = error instanceof Error ? (error.stack ?? '').split('\n').slice(1,7).map(line=>line.match(/\bat\s+([A-Za-z0-9_<>.]+)/)?.[1] ?? '').filter(Boolean) : [];
  void invoke('cmd_record_local_crash',{report:{event:'app_crash',appVersion,source,errorType,frames,platform:'desktop',occurredAt:new Date().toISOString()}}).catch(()=>{});
}
