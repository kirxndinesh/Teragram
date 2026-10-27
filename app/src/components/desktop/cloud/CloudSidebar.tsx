import { ChevronDown, Clock3, Cloud, Copy, Database, FileWarning, Folder, Image, Pin, Star, CalendarClock, Bookmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SmartView, TelegramFolder } from '../../../types';
import { useSettings } from '../../../context/SettingsContext';
import { SidebarItem } from '../dashboard/SidebarItem';
import { CreateFolderDialog } from '../dashboard/CreateFolderDialog';
import { useEffect, useState, type ReactNode } from 'react';
import { SidebarTooltips } from './SidebarTooltips';
import { NewMenu } from './NewMenu';
import type { SidebarLayout } from './useSidebarLayout';

interface Props {
  storage?: ReactNode;
  layout: SidebarLayout; onUpload: () => void; onFolderUpload: () => void;
  folders: TelegramFolder[]; view: 'cloud' | 'photos' | 'folder' | 'folders'; onFolders: () => void; activeFolderId: number | null;
  smartView: SmartView | null; onCloud: () => void; onPhotos: () => void;
  onSmartView: (view: SmartView) => void; onFolder: (id: number | null) => void;
  importedIds: number[]; onRemoveImport: (id: number) => void;
  onCreate: (name: string) => Promise<void>; createRequest: number;
  onDelete: (id: number, name: string) => void; onRename: (id: number, name: string) => void;
  onVisibility: (id: number, name: string, isPublic: boolean) => void;
  onInvite: (id: number, name: string) => void;
}
export function CloudSidebar(props: Props) {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (props.createRequest) setCreating(true); }, [props.createRequest]);
  const quick = [
    ['recents', Clock3, 'common.recents'], ['favorites', Star, 'common.favorites'],
    ['pinned', Pin, 'common.pinned'], ['offline', Database, 'common.offline_files'],
    ['large', FileWarning, 'common.large_files'], ['old', CalendarClock, 'common.old_files'],
    ['duplicates', Copy, 'common.duplicates'],
  ] as const;
  const { layout } = props;
  const nav = (action: () => void) => action();
  return <aside id="teragram-sidebar" ref={layout.sidebarRef} className={`cloud-sidebar ${layout.collapsed ? 'is-collapsed' : ''}`} aria-label={t('common.app_title')}>
    <SidebarTooltips enabled={layout.collapsed} />
    <button type="button" ref={layout.triggerRef} className="cloud-brand" aria-label={t(layout.collapsed ? 'tg.expandSidebar' : 'tg.collapseSidebar')} title={t('tg.sidebarShortcut')} aria-controls="teragram-sidebar" aria-expanded={!layout.collapsed} onClick={layout.toggle}><img src="/teragram-logo.svg" alt="" /><strong>{t('common.app_title')}</strong></button>
    <div className="cloud-sidebar-surface">
    <NewMenu onUpload={props.onUpload} onFolderUpload={props.onFolderUpload} onCreate={() => setCreating(true)} collapsed={layout.collapsed} />
    <nav aria-label={t('common.files')} onKeyDown={event => {
      // Native buttons own Enter/Space; file-opening shortcuts belong to the workspace.
      if (!event.ctrlKey && !event.metaKey && !event.altKey && ['Enter', ' '].includes(event.key) && (event.target as Element).closest('button')) event.stopPropagation();
    }}>
      <button type="button" className="cloud-nav-item" aria-current={props.view === 'photos' ? 'page' : undefined} aria-label={t('tg.photos')} data-tooltip={layout.collapsed ? t('tg.photos') : undefined} onClick={() => nav(props.onPhotos)}><Image size={19} aria-hidden="true" /><span>{t('tg.photos')}</span></button>
      <button type="button" className="cloud-nav-item" aria-current={props.view === 'cloud' && !props.smartView ? 'page' : undefined} aria-label={t('tg.cloud')} data-tooltip={layout.collapsed ? t('tg.cloud') : undefined} onClick={() => nav(props.onCloud)}><Cloud size={19} aria-hidden="true" /><span>{t('tg.cloud')}</span></button>
      <div className="cloud-quick-navigation cloud-tree-row"><button type="button" className="cloud-nav-item" aria-label={t('tg.quickAccess')} data-tooltip={layout.collapsed ? t('tg.quickAccess') : undefined} aria-expanded={settings.quickAccessExpanded} aria-controls="cloud-quick-links" onClick={() => updateSetting('quickAccessExpanded', !settings.quickAccessExpanded)}><Bookmark size={20} aria-hidden="true" /><span>{t('tg.quickAccess')}</span><span className="cloud-tree-chevron" aria-hidden="true"><ChevronDown size={14} /></span></button></div>
      <div className={`cloud-tree-shell ${settings.quickAccessExpanded ? 'is-open' : ''}`} aria-hidden={!settings.quickAccessExpanded} inert={!settings.quickAccessExpanded}><div className="cloud-tree-clip"><div id="cloud-quick-links" className="cloud-quick-links">
        {quick.map(([view, Icon, label]) => <button type="button" key={view} className="cloud-nav-item" aria-current={props.smartView === view ? 'page' : undefined} aria-label={t(label)} data-tooltip={layout.collapsed ? t(label) : undefined} onClick={() => nav(() => props.onSmartView(view))}><Icon size={17} aria-hidden="true" /><span>{t(label)}</span></button>)}
      </div></div></div>
      <div className="cloud-folder-navigation cloud-tree-row"><button type="button" className="cloud-nav-item" aria-current={props.view === 'folders' ? 'page' : undefined} aria-expanded={props.view === 'folders' ? settings.foldersExpanded : undefined} aria-controls={props.view === 'folders' ? 'cloud-channel-list' : undefined} aria-label={t('common.folders')} data-tooltip={layout.collapsed ? t('common.folders') : undefined} onClick={() => props.view === 'folders' ? updateSetting('foldersExpanded', !settings.foldersExpanded) : props.onFolders()}><Folder size={20} aria-hidden="true" /><span>{t('common.folders')}</span></button><button type="button" className="cloud-tree-chevron cloud-folder-chevron" aria-label={t(settings.foldersExpanded ? 'tg.collapseFolders' : 'tg.expandFolders')} aria-expanded={settings.foldersExpanded} aria-controls="cloud-channel-list" onClick={() => updateSetting('foldersExpanded', !settings.foldersExpanded)}><ChevronDown size={14} aria-hidden="true" /></button></div>
      <div className={`cloud-tree-shell ${settings.foldersExpanded ? 'is-open' : ''}`} aria-hidden={!settings.foldersExpanded} inert={!settings.foldersExpanded}><div className="cloud-tree-clip"><div className="cloud-channel-list" id="cloud-channel-list">
        <SidebarItem icon={Folder} label={t('common.saved_messages')} active={props.view === 'folder' && props.activeFolderId === null && !props.smartView} onClick={() => nav(() => props.onFolder(null))} folderId={null} collapsed={layout.collapsed} keepLabel />
        {props.folders.map(folder => <SidebarItem key={folder.id} icon={Folder} label={folder.name} active={props.view === 'folder' && props.activeFolderId === folder.id && !props.smartView} onClick={() => nav(() => props.onFolder(folder.id))} folderId={folder.id} collapsed={layout.collapsed} keepLabel onDelete={() => props.importedIds.includes(folder.id) ? props.onRemoveImport(folder.id) : props.onDelete(folder.id, folder.name)} deleteLabel={props.importedIds.includes(folder.id) ? t('refine.removeFolder') : undefined} onRename={props.importedIds.includes(folder.id) ? undefined : () => props.onRename(folder.id, folder.name)} onToggleVisibility={props.importedIds.includes(folder.id) ? undefined : () => props.onVisibility(folder.id, folder.name, !!(folder.is_public || folder.username))} onExportInvite={props.importedIds.includes(folder.id) ? undefined : () => props.onInvite(folder.id, folder.name)} />)}
      </div></div></div>
    </nav>
    {props.storage}
    </div>
    {creating && <CreateFolderDialog onClose={() => setCreating(false)} onCreate={props.onCreate} />}
  </aside>;
}
