import type { TelegramFile } from '../types';
import type { FileSearchFilters } from './fileSearch';

export interface GalleryFrame {
    src: string | null; status: 'ready' | 'unavailable'; width?: number; height?: number;
    duration: number | null; upgraded: boolean; stale?: boolean;
}
const frames = new Map<string, { frame: GalleryFrame; bytes: number; owner: string | null; folder: number | null }>();
let frameBytes = 0;
const frameKey = (owner: string | null, file: TelegramFile) => JSON.stringify([owner, file.folder_id ?? null, file.id, file.size, file.created_at, file.mime_type, file.encryption_state]);
export function galleryFrame(owner: string | null, file: TelegramFile): GalleryFrame | undefined {
    const key = frameKey(owner, file), entry = frames.get(key);
    if (entry) { frames.delete(key); frames.set(key, entry); }
    return entry?.frame;
}
export function rememberGalleryFrame(owner: string | null, file: TelegramFile, frame: GalleryFrame): void {
    // This store retains URLs and geometry, not Image/bitmap objects. Decoded
    // original retention remains bounded by imagePreviewCache and the browser.
    const bytes = (frame.src?.length ?? 0) * 2 + 512;
    if (bytes > 128 * 1024 * 1024) return;
    const key = frameKey(owner, file);
    frameBytes += bytes - (frames.get(key)?.bytes ?? 0);
    frames.delete(key); frames.set(key, { frame, bytes, owner, folder: file.folder_id ?? null });
    while (frameBytes > 128 * 1024 * 1024) {
        const oldest = frames.keys().next().value!;
        frameBytes -= frames.get(oldest)!.bytes;
        frames.delete(oldest);
    }
}
export function staleGalleryFolder(owner: string, folder: number | null): void {
    for (const entry of frames.values()) if (entry.owner === owner && entry.folder === folder) entry.frame = { ...entry.frame, stale: true };
}
export const clearGalleryFrames = () => { frames.clear(); frameBytes = 0; };

export interface WorkspaceMemory { scroll: number; limit: number; height?: number; width?: number; scale?: number; filters?: FileSearchFilters; mode?: 'list' | 'grid' }
const views = new Map<string, WorkspaceMemory>();
export const workspaceMemory = (key: string): WorkspaceMemory => views.get(key) ?? { scroll: 0, limit: 120 };
export function rememberWorkspace(key: string, patch: Partial<WorkspaceMemory>): void {
    const next = { ...workspaceMemory(key), ...patch };
    views.delete(key); views.set(key, next);
    if (views.size > 128) views.delete(views.keys().next().value!);
}
export function clearGallerySession(): void { clearGalleryFrames(); views.clear(); }
