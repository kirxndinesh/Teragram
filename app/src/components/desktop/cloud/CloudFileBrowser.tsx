import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import type { TelegramFile, TelegramFolder } from '../../../types';
import { FileListItem } from '../dashboard/FileListItem';
import { FileCard } from '../dashboard/FileCard';
import { ContextMenu } from '../dashboard/ContextMenu';
import { cloudFileKey } from './cloudFiles';
import type { SortField, SortDirection } from '../dashboard/FileExplorer';
import { File } from 'lucide-react';

interface Props {
  files: TelegramFile[]; folders: TelegramFolder[]; ownerId: string | null;
  selectedKeys: string[]; mode: 'grid' | 'list'; scale: number; activeFolderId: number | null;
  crossFolder: boolean; sortField: SortField; sortDirection: SortDirection;
  onSort: (field: SortField) => void; onOpen: (event: React.MouseEvent, file: TelegramFile, ordered: TelegramFile[]) => void;
  onSelect: (file: TelegramFile) => void; onDelete: (file: TelegramFile) => void;
  onDownload: (file: TelegramFile) => void; onPreview: (file: TelegramFile, ordered?: TelegramFile[]) => void;
  onShare: (file: TelegramFile) => void; onRename: (file: TelegramFile) => void;
  onMove: (file: TelegramFile) => void; onFavorite: (file: TelegramFile) => void;
  onPinned: (file: TelegramFile) => void;
}
export function CloudFileBrowser(props: Props) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(120);
  const identity = props.files.map(cloudFileKey).join('|');
  useEffect(() => setLimit(120), [identity, props.ownerId]);
  const ref = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current; const workspace = element?.closest<HTMLElement>('.cloud-workspace');
    if (!element || !workspace) return;
    const measure = () => setScrollMargin(element.getBoundingClientRect().top - workspace.getBoundingClientRect().top + workspace.scrollTop + 44);
    const observer = new ResizeObserver(measure); observer.observe(workspace);
    for (const sibling of Array.from(workspace.children)) observer.observe(sibling);
    measure(); return () => observer.disconnect();
  }, [props.mode, props.ownerId, identity]);
  const [menu, setMenu] = useState<{ x: number; y: number; file: TelegramFile } | null>(null);
  const ordered = props.files;
  const virtualizer = useVirtualizer({ count: ordered.length, getScrollElement: () => ref.current?.closest<HTMLElement>('.cloud-workspace') ?? ref.current, estimateSize: () => 60, overscan: 10, scrollMargin });
  const openMenu = (event: React.MouseEvent, file: TelegramFile) => { event.preventDefault(); event.stopPropagation(); setMenu({ x: event.clientX, y: event.clientY, file }); };
  return <div ref={ref} className="cloud-file-browser">
    {!ordered.length && <div className="cloud-empty"><File size={34} /><h3>{t('common.files')}</h3><p>{t('workspace.no_matches')}</p></div>}
    {props.mode === 'list' && ordered.length > 0 && <div className="cloud-file-table">
      <div className="cloud-table-head"><span /><button type="button" onClick={() => props.onSort('name')}>{t('common.name')}</button><span>{t('common.folders')}</span><button type="button" onClick={() => props.onSort('size')}>{t('common.size')}</button><button type="button" onClick={() => props.onSort('date')}>{t('common.date')}</button><span /></div>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>{virtualizer.getVirtualItems().map(row => {
        const file = ordered[row.index];
        return <div key={`${props.ownerId}:${cloudFileKey(file)}`} style={{ position: 'absolute', width: '100%', height: row.size, transform: `translateY(${row.start - scrollMargin}px)` }}>
          <FileListItem file={file} selectedIds={props.selectedKeys.includes(cloudFileKey(file)) ? [file.id] : []} sourceName={file.folder_id == null ? t('common.saved_messages') : props.folders.find(folder => folder.id === file.folder_id)?.name || t('common.folders')} onToggleSelection={() => props.onSelect(file)} onFileClick={(event, value) => props.onOpen(event, value, ordered)} handleContextMenu={openMenu} disableDrag={props.crossFolder} />
        </div>;
      })}</div>
    </div>}
    {props.mode === 'grid' && <div className="cloud-document-grid" style={{ '--document-width': `${Math.round(180 * props.scale)}px` } as React.CSSProperties}>
      {ordered.slice(0, limit).map(file => <FileCard key={`${props.ownerId}:${cloudFileKey(file)}`} file={file} isSelected={props.selectedKeys.includes(cloudFileKey(file))} onClick={event => props.onOpen(event, file, ordered)} onToggleSelection={() => props.onSelect(file)} onDownload={() => props.onDownload(file)} onDelete={() => props.onDelete(file)} onPreview={() => props.onPreview(file, ordered)} onShare={() => props.onShare(file)} onContextMenu={event => openMenu(event, file)} activeFolderId={file.folder_id ?? props.activeFolderId} disableDrag={props.crossFolder} />)}
    </div>}
    {props.mode === 'grid' && ordered.length > limit && <button type="button" className="cloud-load-more" onClick={() => setLimit(value => value + 120)}>{t('workspace.next')} · {limit} / {ordered.length}</button>}
    {menu && <ContextMenu x={menu.x} y={menu.y} file={menu.file} folders={props.folders} activeFolderId={menu.file.folder_id === undefined ? props.activeFolderId : menu.file.folder_id} onClose={() => setMenu(null)} onDelete={() => { props.onDelete(menu.file); setMenu(null); }} onDownload={() => { props.onDownload(menu.file); setMenu(null); }} onPreview={() => { props.onPreview(menu.file, ordered); setMenu(null); }} onShare={() => { props.onShare(menu.file); setMenu(null); }} onRename={() => { props.onRename(menu.file); setMenu(null); }} onMove={() => { props.onMove(menu.file); setMenu(null); }} onToggleFavorite={() => { props.onFavorite(menu.file); setMenu(null); }} onTogglePinned={() => { props.onPinned(menu.file); setMenu(null); }} />}

  </div>;
}
