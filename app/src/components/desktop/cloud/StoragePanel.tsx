import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useModalFocus } from '../../../hooks/useModalFocus';
import { Cloud, X, File, FileImage, FileMusic, Film, HardDrive, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TelegramFile } from '../../../types';
import { formatBytes } from '../../../utils';
import { cloudFileType } from './cloudFiles';

export function StorageWidget({ files, complete, loading, error, onRefresh }: { files: TelegramFile[]; complete: boolean; loading: boolean; error?: string; onRefresh: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useModalFocus(dialog, () => setOpen(false), open);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node) && !dialog.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const categories = [
    ['image', FileImage, 'workspace.types.image', '#5B67F1'],
    ['video', Film, 'workspace.types.video', '#F59E6C'],
    ['document', File, 'workspace.types.document', '#45BFA2'],
    ['audio', FileMusic, 'workspace.types.audio', '#B08CEB'],
    ['other', HardDrive, 'workspace.types.other', '#A1B2CD'],
  ] as const;
  const groups = categories.map(([type, Icon, label, color]) => {
    const entries = files.filter(file => {
      const kind = cloudFileType(file);
      return type === 'other' ? kind === 'other' || kind === 'archive' : kind === type;
    });
    return { type, Icon, label: t(label), color, count: entries.length, bytes: entries.reduce((sum, file) => sum + Math.max(0, file.size || 0), 0) };
  });
  const total = groups.reduce((sum, group) => sum + group.bytes, 0);
  return <div className="cloud-storage-widget" ref={container}>
    <button type="button" className="cloud-storage-trigger" data-tooltip={t('settings.storage')} aria-label={t('settings.storage')} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span><Cloud size={20} aria-hidden="true" />{t('settings.storage')}</span>
      <span className="cloud-storage-meter" aria-hidden="true"><span style={{ width: files.length ? '100%' : '0%' }} /></span>
      <small>{t('tg.indexedInTelegram', { size: formatBytes(total) })}</small>
    </button>
    {open && createPortal(<div ref={dialog} style={{ position: 'fixed', left: Math.max(8, Math.min(window.innerWidth - 360, (container.current?.getBoundingClientRect().right ?? 248) + 12)), bottom: 24 }} className="cloud-storage-popover" role="dialog" aria-modal="true" aria-label={t('settings.storage')} tabIndex={-1}>
    <header><div><h2>{t('settings.storage')}</h2><strong>{formatBytes(total)}</strong></div><button type="button" onClick={onRefresh} aria-label={t('common.sync')} disabled={loading}>{loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}</button><button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}><X size={18} /></button></header>
    <p className="cloud-storage-count">{files.length.toLocaleString()} {t('common.files')}</p>
    {loading && <p className="cloud-storage-note" role="status">{t('workspace.scanning')}</p>}
    {!complete && !loading && <p className="cloud-storage-note" role="status">{t('workspace.search_partial', { count: files.length })}</p>}
    {error && <p className="cloud-storage-note" role="alert">{t('common.operation_failed')}</p>}
    <div className="cloud-storage-categories">{groups.map(({ type, Icon, label, count, bytes, color }) => <div className="cloud-storage-category" key={type}>
      <span className="cloud-category-icon" style={{ color, background: `${color}15` }}><Icon size={19} aria-hidden="true" /></span><div><strong>{label}</strong><small>{count.toLocaleString()} {t('common.files')}</small></div><span>{formatBytes(bytes)}</span>
    </div>)}</div>
    <div className="cloud-storage-footer"><CloudNote /></div>
  </div>, document.body)}
  </div>;
  function CloudNote() { return <><HardDrive size={19} aria-hidden="true" /><p>{t('tg.storageNote')}</p></>; }
}
