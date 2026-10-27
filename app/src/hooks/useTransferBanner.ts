import { useLayoutEffect, useRef, useState, type FocusEvent } from 'react';
import type { DownloadItem, QueueItem } from '../types';

type Item = QueueItem | DownloadItem;
const terminal = (item: Item) => item.status === 'success' || item.status === 'cancelled';
const key = (item: Item, direction: string) => JSON.stringify([item.ownerId, direction, item.id]);

/** Banner dismissal never clears the durable transfer ledger. Retried jobs reappear. */
export function useTransferBanner(uploads: QueueItem[], downloads: DownloadItem[], openRequest: number) {
  const [phase, setPhase] = useState<'visible' | 'exiting' | 'hidden'>('visible');
  const dismissed = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hovered = useRef(false);
  const focused = useRef<HTMLElement | null>(null);
  const due = useRef(false);
  const previousOpen = useRef(openRequest);
  const current = useRef({ uploads, downloads });
  current.current = { uploads, downloads };
  // Progress/speed changes must not reset completion deadlines or resurrect a dismissed pill.
  const signature = JSON.stringify([
    uploads.map(item => [key(item, 'upload'), item.status]),
    downloads.map(item => [key(item, 'download'), item.status, item.downloadOutcome]),
  ]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const interacting = () => hovered.current || (focused.current !== null && focused.current === document.activeElement);
  const visible = <T extends Item>(items: T[], direction: string) => items.filter(item => !terminal(item) || !dismissed.current.has(key(item, direction)));
  const finish = () => {
    for (const [direction, items] of [['upload', current.current.uploads], ['download', current.current.downloads]] as const) {
      items.filter(terminal).forEach(item => dismissed.current.add(key(item, direction)));
    }
    hovered.current = false;
    focused.current = null;
    setPhase('hidden');
  };
  const dismiss = () => {
    clearTimers();
    setPhase('exiting');
    timers.current.push(setTimeout(finish, 220));
  };
  const leave = () => {
    if (due.current && !interacting()) {
      clearTimers();
      timers.current.push(setTimeout(() => { if (!interacting()) dismiss(); }, 1000));
    }
  };

  useLayoutEffect(() => {
    clearTimers();
    due.current = false;
    if (previousOpen.current !== openRequest) {
      previousOpen.current = openRequest;
      dismissed.current.clear();
    }
    // Drop obsolete IDs; a later retry of the same job must receive a fresh completion window.
    const retained = new Set([
      ...uploads.filter(terminal).map(item => key(item, 'upload')),
      ...downloads.filter(terminal).map(item => key(item, 'download')),
    ]);
    dismissed.current.forEach(id => { if (!retained.has(id)) dismissed.current.delete(id); });
    const items = [...visible(uploads, 'upload'), ...visible(downloads, 'download')];
    setPhase(items.length ? 'visible' : 'hidden');
    if (items.length && items.every(terminal)) {
      timers.current.push(setTimeout(() => {
        due.current = true;
        if (!interacting()) dismiss();
      }, 2500));
    }
    return clearTimers;
    // The signature deliberately excludes per-chunk progress updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, openRequest]);

  return {
    phase, dismiss,
    uploads: visible(uploads, 'upload'), downloads: visible(downloads, 'download'),
    onMouseEnter: () => { hovered.current = true; },
    onMouseLeave: () => { hovered.current = false; leave(); },
    onFocusCapture: (event: FocusEvent<HTMLElement>) => { focused.current = event.target.matches(':focus-visible') ? event.target : null; },
    onBlurCapture: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) { focused.current = null; leave(); }
    },
  };
}
