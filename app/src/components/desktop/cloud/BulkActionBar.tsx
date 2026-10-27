import { Download, FolderInput, Star, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function BulkActionBar({ count, onDownload, onMove, onFavorite, onDelete, onClear, busy }: { count: number; onDownload: () => void; onMove: () => void; onFavorite: () => void; onDelete: () => void; onClear: () => void; busy: boolean }) {
  const { t } = useTranslation();
  if (!count) return null;
  return <div className="cloud-bulk-bar" role="toolbar" aria-label={t('files.items_selected', { count })}>
    <span aria-live="polite">{t('files.items_selected', { count })}</span>
    <button type="button" onClick={onDownload} disabled={busy}><Download size={17} />{t('files.download')}</button>
    <button type="button" onClick={onMove} disabled={busy}><FolderInput size={17} />{t('files.move_to')}</button>
    <button type="button" onClick={onFavorite} disabled={busy}><Star size={17} />{t('common.favorites')}</button>
    <button type="button" onClick={onDelete} disabled={busy} className="cloud-danger"><Trash2 size={17} />{t('files.delete')}</button>
    <button type="button" onClick={onClear} aria-label={t('workspace.clear_selection')}><X size={18} /></button>
  </div>;
}
