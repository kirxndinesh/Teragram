import { Check, Folder, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRef } from 'react';
import type { TelegramFolder } from '../../../types';
import { useSettings } from '../../../context/SettingsContext';
import { useModalFocus } from '../../../hooks/useModalFocus';
import { folderKey } from './cloudFiles';

export function AllocatedFolders({ ownerId, folders }: { ownerId: string | null; folders: TelegramFolder[] }) {
  const { t } = useTranslation();
  const { settings, updateSetting, persistenceStatus } = useSettings();
  const options = [{ id: null, name: t('common.saved_messages') }, ...folders];
  const selected = ownerId ? settings.photoFolderAllocations[ownerId] : [];
  const toggle = (key: string) => {
    if (!ownerId) return;
    const current = selected ?? options.map(folder => folderKey(folder.id));
    const next = current.includes(key) ? current.filter(value => value !== key) : [...current, key];
    updateSetting('photoFolderAllocations', { ...settings.photoFolderAllocations, [ownerId]: next });
  };
  return <div className="cloud-allocated-options">
    {options.map(folder => {
      const checked = selected === undefined || selected.includes(folderKey(folder.id));
      return <label key={folderKey(folder.id)}>
        <input type="checkbox" checked={checked} disabled={!ownerId} onChange={() => toggle(folderKey(folder.id))} />
        <Folder size={18} aria-hidden="true" /><span>{folder.name}</span>
        {checked && <Check size={16} aria-hidden="true" />}
      </label>;
    })}
    {persistenceStatus === 'error' && <p role="alert">{t('common.operation_failed')}</p>}
  </div>;
}

export function AllocatedFoldersDialog({ ownerId, folders, onClose }: { ownerId: string | null; folders: TelegramFolder[]; onClose: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, onClose, true);
  return <div className="cloud-modal-backdrop" onClick={onClose}>
    <div className="cloud-modal" role="dialog" aria-modal="true" aria-labelledby="allocated-title" ref={ref} onClick={event => event.stopPropagation()}>
      <header><div><h2 id="allocated-title">{t('tg.allocated')}</h2></div><button type="button" aria-label={t('common.close')} onClick={onClose}><X size={20} /></button></header>
      <AllocatedFolders ownerId={ownerId} folders={folders} />
      <footer><button type="button" className="cloud-primary" onClick={onClose}>{t('settings.done')}</button></footer>
    </div>
  </div>;
}
