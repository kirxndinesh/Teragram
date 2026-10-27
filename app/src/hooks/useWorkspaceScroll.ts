import { useLayoutEffect, useRef } from 'react';
import { rememberWorkspace, workspaceMemory } from '../services/gallerySession';

/** Restore in the layout phase, before the returning view is painted. Cached
 * thumbnail dimensions make the masonry tall enough without waiting on onLoad. */
export function useWorkspaceScroll(key: string, ready: boolean, contents: unknown, scale: number) {
    const ref = useRef<HTMLDivElement>(null);
    const previous = useRef<string | undefined>(undefined);
    const save = () => {
        const element = ref.current, content = element?.firstElementChild as HTMLElement | undefined;
        if (element && content) rememberWorkspace(key, { scroll: element.scrollTop, height: content.offsetHeight, width: element.clientWidth, scale });
    };
    useLayoutEffect(() => {
        const element = ref.current, content = element?.firstElementChild as HTMLElement | undefined;
        if (!ready || !element || !content) return;
        if (previous.current === key) { content.style.minHeight = ''; return; }
        const memory = workspaceMemory(key);
        // Preserve the measured masonry envelope while cached images decode.
        // Otherwise a temporarily shorter page clamps a deep scroll offset.
        content.style.minHeight = memory.width === element.clientWidth && memory.scale === scale && memory.height ? `${memory.height}px` : '';
        element.scrollTop = memory.scroll;
        previous.current = key;
    }, [key, ready, contents, scale]);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        let width = element.clientWidth;
        const observer = new ResizeObserver(() => {
            if (width === element.clientWidth) return;
            width = element.clientWidth;
            const content = element.firstElementChild as HTMLElement | null;
            if (content) content.style.minHeight = '';
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return { ref, onScroll: () => {
        if (previous.current === key) save();
    }, save };
}
