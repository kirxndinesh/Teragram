import { listen } from '@tauri-apps/api/event';
import type { QueryClient } from '@tanstack/react-query';
import type { LocalSearchReply } from './localSearch';

const observers = new WeakMap<QueryClient, { count: number; stop: () => void }>();
/** One event subscription per shared query cache. Ordinary navigation never invalidates it. */
export function observeLocalSearchCache(client: QueryClient): () => void {
    let entry = observers.get(client);
    if (!entry) {
        let closed = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let flushing = false;
        const pending = new Set<string | null>();
        // One in-flight refresh plus one trailing refresh, even during a large upload batch.
        const schedule = () => {
            if (closed || flushing || timer !== undefined || !pending.size) return;
            timer = setTimeout(() => {
                timer = undefined;
                const owners = pending.has(null) ? [null] : [...pending];
                pending.clear(); flushing = true;
                void Promise.all(owners.map(owner => client.invalidateQueries({ queryKey: owner === null ? ['local-search'] : ['local-search', owner] }, { cancelRefetch: false }))).finally(() => {
                    flushing = false; schedule();
                });
            }, 250);
        };
        const enqueue = (owner: string | null) => { if (!closed) { pending.add(owner); schedule(); } };
        const refresh = () => enqueue(null);
        const inventory = listen<{ ownerId: string }>('file-inventory-changed', ({ payload }) => {
            if (payload.ownerId) enqueue(payload.ownerId);
        });
        const locked = listen('vault-locked', () => {
            if (closed) return;
            void client.cancelQueries({ queryKey: ['local-search'] }).then(() => {
                if (closed) return;
                client.setQueriesData<LocalSearchReply>({ queryKey: ['local-search'] }, reply => reply ? {
                    ...reply, files: reply.files.filter(file => file.encryption_state !== 'encrypted_unlocked'),
                } : reply);
                refresh();
            });
        });
        const unlocked = listen('vault-unlocked', refresh);
        window.addEventListener('tg-drive-refresh-catalog', refresh);
        entry = { count: 0, stop: () => {
            closed = true;
            clearTimeout(timer); pending.clear();
            window.removeEventListener('tg-drive-refresh-catalog', refresh);
            for (const pending of [inventory, locked, unlocked]) void pending.then(stop => stop()).catch(() => {});
        } };
        observers.set(client, entry);
    }
    entry.count++;
    return () => { if (--entry.count === 0) { entry.stop(); observers.delete(client); } };
}
