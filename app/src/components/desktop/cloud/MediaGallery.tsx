import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Download, Film, Image as ImageIcon, Lock, Play, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TelegramFile } from '../../../types';
import { getCachedThumbnail, imageCacheVersion, loadGridPreview, loadThumbnail, subscribeImageCache } from '../../../services/imagePreviewCache';
import { formatBytes } from '../../../utils';
import { galleryMediaMetadata } from '../../../services/galleryMediaMetadata';
import { mediaTime } from './MediaChrome';
import { cloudFileKey, cloudFileType } from './cloudFiles';
import { galleryFrame, rememberGalleryFrame, rememberWorkspace, workspaceMemory } from '../../../services/gallerySession';

interface GalleryProps {
  cacheKey?: string;
  files: TelegramFile[]; selectedKeys: string[]; scale: number; ownerId: string | null;
  onOpen: (event: React.MouseEvent, file: TelegramFile, ordered: TelegramFile[]) => void;
  onSelect: (file: TelegramFile) => void; onDownload: (file: TelegramFile) => void;
  onFavorite: (file: TelegramFile) => void;
}
function MediaTile({ file, ownerId, selected, onOpen, onSelect, onDownload, onFavorite }: { file: TelegramFile; ownerId: string | null; selected: boolean; onOpen: (event: React.MouseEvent) => void; onSelect: () => void; onDownload: () => void; onFavorite: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const upgraded = useRef(false);
  const generation = useSyncExternalStore(subscribeImageCache, imageCacheVersion, imageCacheVersion);
  const cachedFrame = galleryFrame(ownerId, file);
  const [source, setSource] = useState<string | null>(() => cachedFrame?.src ?? null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(() => cachedFrame?.status ?? 'loading');
  const [duration, setDuration] = useState<number | null>(() => cachedFrame?.duration ?? null);
  const [restored, setRestored] = useState(!!cachedFrame);
  const video = cloudFileType(file) === 'video';
  const [ratio, setRatio] = useState<number | undefined>(() => cachedFrame?.width && cachedFrame.height ? cachedFrame.width / cachedFrame.height : undefined);
  const locked = file.encryption_state === 'encrypted_locked' || file.encryption_state === 'encrypted_key_missing';
  const token = JSON.stringify([ownerId, file.folder_id, file.id, file.size, file.created_at, file.mime_type, file.encryption_state, locked, generation]);
  const current = useRef(token); current.current = token;
  useLayoutEffect(() => {
    let cancelled = false;
    const frame = galleryFrame(ownerId, file);
    upgraded.current = frame?.upgraded ?? false;
    setSource(locked ? null : frame?.src ?? null); setStatus(locked ? 'unavailable' : frame?.status ?? 'loading');
    setDuration(frame?.duration ?? null); setRestored(!!frame);
    setRatio(frame?.width && frame.height ? frame.width / frame.height : undefined);
    if (locked || frame && !frame.stale) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      if (video && ownerId) void galleryMediaMetadata(ownerId, file).then(metadata => {
        if (cancelled || !metadata) return;
        if (typeof metadata.duration_secs === 'number' && metadata.duration_secs >= 0) {
          setDuration(metadata.duration_secs);
          const displayed = galleryFrame(ownerId, file);
          if (displayed) rememberGalleryFrame(ownerId, file, { ...displayed, duration: metadata.duration_secs });
        }
        if (metadata.width && metadata.height) setRatio(metadata.width / metadata.height);
      });
      const cached = getCachedThumbnail(file.id, file.folder_id);
      if (cached) setSource(cached);
      else void loadThumbnail(file.id, file.folder_id).then(src => {
        if (cancelled) return;
        if (src) {
          setSource(src);
          if (frame?.src === src) rememberGalleryFrame(ownerId, file, { ...frame, stale: false });
        }
        else if (!frame?.src) { setSource(null); setStatus('unavailable'); rememberGalleryFrame(ownerId, file, { src: null, status: 'unavailable', duration: null, upgraded: false }); }
      }).catch(() => { if (!cancelled && !frame?.src) setStatus('unavailable'); });
    }, { rootMargin: '400px' });
    if (ref.current) observer.observe(ref.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [token]);
  return <article ref={ref} className={`cloud-media-tile ${selected ? 'is-selected' : ''} ${status === 'ready' ? 'is-ready' : ''} ${restored ? 'is-restored' : ''}`} data-file-key={cloudFileKey(file)} style={{ aspectRatio: source ? undefined : ratio ?? '4/3' }}>
    <button type="button" className="cloud-media-open" onClick={onOpen} aria-label={t('workspace.open_file', { name: file.name })}>
      {source ? <img src={source} alt={file.name} width={cachedFrame?.width} height={cachedFrame?.height} loading={restored ? 'eager' : 'lazy'} crossOrigin={video ? 'anonymous' : undefined} onLoad={event => {
        const img = event.currentTarget;
        if (video) {
          try { const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8; const context = canvas.getContext('2d'); context?.drawImage(img, 0, 0, 8, 8); const pixels = context?.getImageData(0, 0, 8, 8).data; if (pixels && Array.from(pixels).filter((_, index) => index % 4 !== 3).every(value => value < 18)) { setSource(null); setStatus('unavailable'); rememberGalleryFrame(ownerId, file, { src: null, status: 'unavailable', duration, upgraded: false }); return; } } catch { /* Display a valid cross-origin thumbnail even if sampling is unavailable. */ }
        }
        setRatio(img.naturalWidth / img.naturalHeight); setStatus('ready');
        rememberGalleryFrame(ownerId, file, { src: source, status: 'ready', width: img.naturalWidth, height: img.naturalHeight, duration, upgraded: upgraded.current });
        if (!video && file.size <= 25 * 1024 * 1024 && img.naturalWidth < Math.max(800, img.clientWidth * window.devicePixelRatio) && !upgraded.current) {
          upgraded.current = true;
          const requestedGeneration = imageCacheVersion();
          void loadGridPreview(file.id, file.folder_id ?? null).then(sharp => { if (sharp && ref.current?.isConnected && current.current === token && imageCacheVersion() === requestedGeneration) setSource(sharp); }).catch(() => {});
        }
      }} onError={() => { setSource(null); setStatus('unavailable'); rememberGalleryFrame(ownerId, file, { src: null, status: 'unavailable', duration, upgraded: false }); }} /> : <span className={`cloud-media-fallback ${status === 'loading' ? 'is-loading' : ''}`}><span className="cloud-placeholder-art">{locked ? <Lock size={28} /> : video ? <Film size={32} /> : <ImageIcon size={32} />}</span><strong>{t(video ? 'workspace.types.video' : 'workspace.types.image')}</strong><small>{t(status === 'loading' ? 'common.loading' : 'tg.previewUnavailable')}</small></span>}

      <span className="cloud-media-scrim" />
    </button>
    <input type="checkbox" className="cloud-media-checkbox" checked={selected} onChange={onSelect} aria-label={t('workspace.select_file', { name: file.name })} />
    {video && <span className="cloud-video-badge" aria-label={duration === null ? t('workspace.types.video') : mediaTime(duration)}><Play size={11} fill="currentColor" aria-hidden="true" />{duration === null ? null : mediaTime(duration)}</span>}
    <div className="cloud-media-caption"><div><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></div><button type="button" onClick={onDownload} aria-label={`${t('files.download')} ${file.name}`}><Download size={17} /></button><button type="button" onClick={onFavorite} aria-label={t('workspace.favorite_file', { name: file.name })} aria-pressed={!!file.is_favorite}><Star size={17} fill={file.is_favorite ? 'currentColor' : 'none'} /></button></div>
  </article>;
}
export function MediaGallery(props: GalleryProps) {
  const { t } = useTranslation();
  const memoryKey = props.cacheKey ?? JSON.stringify([props.ownerId, 'gallery']);
  const [page, setPage] = useState(() => ({ key: memoryKey, limit: workspaceMemory(memoryKey).limit }));
  const limit = page.key === memoryKey ? page.limit : workspaceMemory(memoryKey).limit;
  // Window breakpoints intentionally ignore sidebar width. Cards stay in their
  // columns for the entire sidebar transition; only each column's width changes.
  const windowColumns = () => {
    const width = window.innerWidth;
    const base = width >= 1800 ? 6 : width >= 1400 ? 5 : width >= 960 ? 4 : width >= 760 ? 3 : width >= 600 ? 2 : 1;
    return Math.max(1, Math.min(8, base + Math.round((1 - props.scale) * 4)));
  };
  const [columns, setColumns] = useState(windowColumns);
  const gridRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, DOMRect>());
  const identity = props.files.map(cloudFileKey).join('|');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const resize = () => { clearTimeout(timer); timer = setTimeout(() => setColumns(windowColumns()), 120); };
    setColumns(windowColumns());
    window.addEventListener('resize', resize);
    return () => { clearTimeout(timer); window.removeEventListener('resize', resize); };
  }, [props.scale]);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const tiles = Array.from(grid.querySelectorAll<HTMLElement>('[data-file-key]'));
    const next = new Map(tiles.map(tile => [tile.dataset.fileKey!, tile.getBoundingClientRect()]));
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // All geometry reads precede animation writes (FLIP), once per data/zoom change.
      for (const tile of tiles) {
        const old = positions.current.get(tile.dataset.fileKey!);
        const rect = next.get(tile.dataset.fileKey!)!;
        if (!old || !rect.width || !rect.height) continue;
        const x = old.left - rect.left, y = old.top - rect.top;
        if (Math.abs(x) + Math.abs(y) + Math.abs(old.width - rect.width) < 1) continue;
        tile.animate([{ transform: `translate(${x}px, ${y}px) scale(${old.width / rect.width}, ${old.height / rect.height})` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      }
    }
    positions.current = next;
    const settled = (event: Event) => {
      if ((event as TransitionEvent).propertyName !== 'width') return;
      positions.current = new Map(Array.from(grid.querySelectorAll<HTMLElement>('[data-file-key]')).map(tile => [tile.dataset.fileKey!, tile.getBoundingClientRect()]));
    };
    document.querySelector('.cloud-sidebar')?.addEventListener('transitionend', settled);
    return () => document.querySelector('.cloud-sidebar')?.removeEventListener('transitionend', settled);
  }, [identity, columns, limit]);
  return <div className="cloud-gallery-scroll">
    <div ref={gridRef} className="cloud-masonry" style={{ '--gallery-columns': columns } as React.CSSProperties}>
      {Array.from({ length: columns }, (_, column) => <div className="cloud-masonry-column" key={column}>{props.files.slice(0, limit).filter((_, index) => index % columns === column).map(file => <MediaTile key={`${props.ownerId}:${cloudFileKey(file)}`} file={file} ownerId={props.ownerId} selected={props.selectedKeys.includes(cloudFileKey(file))} onOpen={event => props.onOpen(event, file, props.files)} onSelect={() => props.onSelect(file)} onDownload={() => props.onDownload(file)} onFavorite={() => props.onFavorite(file)} />)}</div>)}
    </div>

    {props.files.length > limit && <button type="button" className="cloud-load-more" onClick={() => { const next = limit + 120; rememberWorkspace(memoryKey, { limit: next }); setPage({ key: memoryKey, limit: next }); }}>{t('workspace.next')} · {Math.min(limit, props.files.length)} / {props.files.length}</button>}
    {!props.files.length && <div className="cloud-empty"><ImageIcon size={34} /><h3>{t('tg.photos')}</h3><p>{t('workspace.no_matches')}</p></div>}
  </div>;
}
