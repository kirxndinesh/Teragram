import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchLocal, type LocalSearchQuery, type LocalSearchReply } from '../services/localSearch';
import { observeLocalSearchCache } from '../services/localSearchCache';
import { DEFAULT_SEARCH_FILTERS, type FileSearchFilters } from '../services/fileSearch';

const EMPTY_FILES: LocalSearchReply['files'] = [];

export function useLocalFileSearch(query: LocalSearchQuery, ownerId: string | null, enabled: boolean, metadataVersion?: unknown) {
    const client = useQueryClient();
    const queryKey = ['local-search', ownerId, { ...DEFAULT_SEARCH_FILTERS, ...query }];
    const metadata = useRef(metadataVersion);
    useEffect(() => observeLocalSearchCache(client), [client]);
    useEffect(() => {
        if (metadata.current === metadataVersion) return;
        metadata.current = metadataVersion;
        void client.invalidateQueries({ queryKey, exact: true });
    }, [metadataVersion]);
    const result = useQuery({
        queryKey,
        queryFn: async ({ signal }) => {
            if (!ownerId) throw new Error('ACCOUNT_REQUIRED');
            if (query.query.trim()) await new Promise<void>((resolve, reject) => {
                const cancel = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
                const timer = window.setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 300);
                signal.addEventListener('abort', cancel, { once: true });
            });
            return searchLocal(ownerId, query, () => !signal.aborted, signal);
        },
        enabled: enabled && !!ownerId,
        staleTime: Infinity,
        gcTime: query.query.trim() ? 5 * 60_000 : Infinity,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
    const reply = enabled ? result.data : undefined;
    return { results: reply?.files ?? EMPTY_FILES, isSearching: enabled && result.isFetching && !reply, reply, error: enabled && result.error ? String(result.error) : undefined };
}
export function useGlobalFileSearch(query: string, filters: FileSearchFilters, ownerId: string | null) {
    // The index is shared across category pills; facets are applied by the
    // workspace's in-memory selector, never by another category-specific RPC.
    return useLocalFileSearch({ scope: 'all', query: query.trim() }, ownerId, filters.scope === 'all');
}
