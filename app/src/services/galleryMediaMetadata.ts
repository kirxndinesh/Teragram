import { invoke } from '@tauri-apps/api/core';
import type { TelegramFile } from '../types';
import { imageCacheVersion } from './imagePreviewCache';

export interface GalleryMediaMetadata { duration_secs?: number | null; width?: number | null; height?: number | null }
const requests = new Map<string, Promise<GalleryMediaMetadata | null>>();
let active = 0;
const waiting: (() => void)[] = [];
/** Bounded, viewport-requested metadata. Owner and vault generation are part of every cache key. */
export function galleryMediaMetadata(ownerId: string, file: TelegramFile): Promise<GalleryMediaMetadata | null> {
  const generation = imageCacheVersion();
  const key = JSON.stringify([ownerId, generation, file.folder_id ?? null, file.id]);
  const existing = requests.get(key); if (existing) return existing;
  const request = (async () => {
    if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve)); else active++;
    try {
      if (imageCacheVersion() !== generation) return null;
      const metadata = await invoke<GalleryMediaMetadata>('cmd_get_video_metadata', { messageId: file.id, folderId: file.folder_id ?? null });
      return imageCacheVersion() === generation ? metadata : null;
    } catch { return null; }
    finally { const next = waiting.shift(); if (next) next(); else active--; }
  })();
  requests.set(key, request);
  if (requests.size > 256) requests.delete(requests.keys().next().value!);
  return request;
}
