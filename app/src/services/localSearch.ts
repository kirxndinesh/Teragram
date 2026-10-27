import { isUsableFile } from './filePresentation';
import { invoke } from '@tauri-apps/api/core';
import type { FileSearchFilters } from './fileSearch';
import type { WorkspaceFile } from './workspace';
import { normalizeListedFile } from './fileListRefresh';
export interface LocalSearchQuery extends Partial<FileSearchFilters> {
    query: string; folderKey?: string | null; tags?: string[]; collectionId?: string | null; favoritesOnly?: boolean;
}
export interface LocalSearchReply {
    files: WorkspaceFile[]; indexId: string; total: number; nextOffset: number | null;
    indexed: boolean; complete: boolean; offline: boolean;
}
export async function searchLocal(ownerId: string, query: LocalSearchQuery, current = () => true, signal?: AbortSignal): Promise<LocalSearchReply> {
    const check = () => { if (!current() || signal?.aborted) throw new DOMException('Search cancelled', 'AbortError'); };
    const deadline = Date.now() + 12 * 60_000;
    for (let attempt = 0; ; attempt++) {
        check();
        try {
            let page = await invoke<LocalSearchReply>('cmd_search_local', { ownerId, query: { ...query, offset: 0, limit: 256 } });
            const result = { ...page, files: [...page.files] };
            const offsets = new Set<number>();
            while (page.nextOffset != null && current()) {
                const offset = page.nextOffset;
                if (offsets.has(offset) || result.files.length > 100000) throw new Error('SEARCH_PAGE_INVALID');
                offsets.add(offset);
                page = await invoke<LocalSearchReply>('cmd_search_local', { ownerId, query: { ...query, offset, indexId: result.indexId, limit: 256 } });
                if (page.indexId !== result.indexId || page.total !== result.total || !page.files.length) throw new Error('SEARCH_CHANGED');
                result.files.push(...page.files);
            }
            check();
            if (result.files.length !== result.total) throw new Error('SEARCH_PAGE_INVALID');
            return { ...result, nextOffset: null, files: result.files.filter(isUsableFile).map(file => ({ ...file, ...normalizeListedFile(file) })) };
        } catch (error) {
            check();
            const code = String(error).replace(/^Error: /, '').split(':')[0];
            if (Date.now() >= deadline || !['SEARCH_CHANGED', 'INVENTORY_CHANGED', 'INVENTORY_BUILDING', 'INVENTORY_BUSY'].includes(code)) throw error;
            await new Promise<void>((resolve, reject) => {
                const abort = () => { clearTimeout(timer); reject(new DOMException('Search cancelled', 'AbortError')); };
                const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, code === 'INVENTORY_BUILDING' ? 2000 : Math.min(1000, 100 * 2 ** Math.min(attempt, 4)));
                signal?.addEventListener('abort', abort, { once: true });
            });
        }
    }
}
