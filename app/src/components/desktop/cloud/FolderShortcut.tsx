import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Folder, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSidebarFolderMenu } from '../dashboard/useSidebarFolderMenu';

export function FolderShortcut({ name, count, onOpen, onRename, onDelete, deleteLabel }: { name: string; count: number; onOpen: () => void; onRename?: () => void; onDelete?: () => void; deleteLabel?: string }) {
  const { t } = useTranslation();
  const menu = useSidebarFolderMenu(true);
  useEffect(() => { if (menu.menuPosition) menu.menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [menu.menuPosition, menu.menuRef]);
  return <div className="one-folder-card">
    <button type="button" className="one-folder-open" onClick={onOpen}><Folder size={22} aria-hidden="true" fill="currentColor" strokeWidth={1.2} /><span><strong>{name}</strong><small>{count.toLocaleString()} {t('common.files')}</small></span></button>
    <button type="button" className="one-folder-actions" ref={menu.triggerRef} aria-label={t('files.folder_settings')} title={t('files.folder_settings')} aria-expanded={!!menu.menuPosition} onClick={menu.openFromTrigger}><MoreVertical size={18} aria-hidden="true" /></button>
    {menu.menuPosition && createPortal(<div ref={menu.menuRef} role="dialog" aria-label={name} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); menu.runAndClose(); menu.triggerRef.current?.focus(); } }} className="quiet-menu one-folder-menu" style={{ left: menu.menuPosition.x, top: menu.menuPosition.y }}>
      <p>{name}</p>
      <button type="button" onClick={() => menu.runAndClose(onOpen)}><Folder size={16} aria-hidden="true" />{t('files.open')}</button>
      {onRename && <button type="button" onClick={() => menu.runAndClose(onRename)}><Pencil size={16} aria-hidden="true" />{t('files.rename')}</button>}
      {onDelete && <button type="button" onClick={() => menu.runAndClose(onDelete)}><Trash2 size={16} aria-hidden="true" />{deleteLabel ?? t('files.delete')}</button>}
    </div>, document.body)}
  </div>;
}
