import { useState, type ReactNode } from 'react';
import { Download, Info, Star, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TelegramFile } from '../../../types';
import { formatBytes } from '../../../utils';

export function LightboxActions({ file, sourceName, onDownload, onFavorite, onDelete, details }: { details?: ReactNode; file: TelegramFile; sourceName: string; onDownload: () => void; onFavorite: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  const [info, setInfo] = useState(false);
  return <div className="cloud-lightbox-actions" onClick={event => event.stopPropagation()}>
    <div role="toolbar" aria-label={t('tg.fileInfo')}>
      <button type="button" onClick={onDownload} aria-label={t('files.download')}><Download size={19} /></button>
      <button type="button" onClick={onFavorite} aria-label={t('workspace.favorite_file', { name: file.name })} aria-pressed={!!file.is_favorite}><Star size={19} fill={file.is_favorite ? 'currentColor' : 'none'} /></button>
      <button type="button" onClick={onDelete} aria-label={t('files.delete')}><Trash2 size={19} /></button>
      <button type="button" onClick={() => setInfo(value => !value)} aria-expanded={info} aria-label={t('tg.fileInfo')}><Info size={19} /></button>
    </div>
    {info && <section className="cloud-file-info" aria-label={t('tg.fileInfo')}><header><h2>{t('tg.fileInfo')}</h2><button type="button" onClick={() => setInfo(false)} aria-label={t('common.close')}><X size={17} /></button></header><dl><dt>{t('common.name')}</dt><dd>{file.name}</dd><dt>{t('common.folders')}</dt><dd>{sourceName}</dd><dt>{t('common.size')}</dt><dd>{formatBytes(file.size)}</dd><dt>{t('common.date')}</dt><dd>{file.created_at ? new Date(file.created_at).toLocaleString() : '—'}</dd><dt>{t('workspace.protection')}</dt><dd>{t(file.encryption_state && file.encryption_state !== 'plain' ? 'settings.protected' : 'workspace.protection_plain')}</dd></dl>{details && <div className="media-stream-details">{details}</div>}</section>}
  </div>;
}
