import { ConnectionMenu } from '../cloud/ConnectionMenu';
import {
    Download,
    FolderInput,
    Globe,
    HardDrive,
    HelpCircle,
    Moon,
    Share2,
    Keyboard,
    Sun,
    Trash2,
    X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../context/ThemeContext';
import { Button, IconButton, SearchField } from '../../ui';

interface TopBarProps {
    currentFolderName: string;
    selectedIds: number[];
    onShowMoveModal: () => void;
    onBulkDownload: () => void;
    onBulkDelete: () => void;
    onBulkShare: () => void;
    onDownloadFolder: () => void;
    onClearSelection: () => void;
    isConnected?: boolean; isSyncing?: boolean; ownerId?: string | null;
    onSync?: () => void; onLogout?: () => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    onSettingsClick: () => void;
    onRemoteUploadClick: () => void;
    onShowShortcuts: () => void;
    onShowHelp: () => void;
}

export function TopBar({
    currentFolderName: _currentFolderName,
    selectedIds,
    onShowMoveModal,
    onBulkDownload,
    onBulkDelete,
    onBulkShare,
    onDownloadFolder,
    onClearSelection,
    isConnected = false, isSyncing = false, ownerId = null, onSync, onLogout,
    searchTerm,
    onSearchChange,
    onSettingsClick,
    onRemoteUploadClick,
    onShowShortcuts,
    onShowHelp,
}: TopBarProps) {
    const { theme, toggleTheme } = useTheme();
    const { t } = useTranslation();
    const hasSelection = selectedIds.length > 0;

    return (
        <header
            className="tg-browser-toolbar cloud-header desktop-chrome-row quiet-toolbar sticky top-0 z-20 gap-2.5"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
                // Native toolbar controls own their keys; keep file-list shortcuts out.
                if ((event.target as HTMLElement).closest('button, select') && !event.metaKey && !event.ctrlKey && !event.altKey) event.stopPropagation();
            }}
        >
            {hasSelection ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <IconButton label={t('files.clear_selection')} onClick={onClearSelection}>
                        <X className="h-4 w-4" />
                    </IconButton>
                    <span className="me-1 min-w-0 truncate text-ui font-medium text-app-text">
                        {t('files.items_selected', { count: selectedIds.length })}
                    </span>
                    <Button size="sm" onClick={onShowMoveModal} leadingIcon={<FolderInput className="h-3.5 w-3.5" />}>
                        {t('files.move_to')}
                    </Button>
                    <Button size="sm" onClick={onBulkDownload} leadingIcon={<Download className="h-3.5 w-3.5" />}>
                        {t('files.download')}
                    </Button>
                    <Button size="sm" onClick={onBulkShare} leadingIcon={<Share2 className="h-3.5 w-3.5" />}>
                        {t('files.share')}
                    </Button>
                    <Button size="sm" variant="danger" onClick={onBulkDelete} leadingIcon={<Trash2 className="h-3.5 w-3.5" />}>
                        {t('files.delete')}
                    </Button>
                </div>
            ) : (
                <>
                    <div className="cloud-search-group">
                        <SearchField
                            data-file-search
                            containerClassName="min-w-0 flex-1"
                            placeholder={t('tg.searchMedia')}
                            aria-label={t('tg.searchMedia')}
                            value={searchTerm}
                            onChange={(event) => onSearchChange(event.target.value)}
                        />
                    </div>

                    <div className="cloud-header-actions flex shrink-0 items-center justify-end gap-1.5">
                        {onSync && onLogout && <ConnectionMenu connected={isConnected} syncing={isSyncing} ownerId={ownerId} onSync={onSync} onSettings={onSettingsClick} onLogout={onLogout} extraActions={[
                            { label: t('files.download_folder'), icon: <HardDrive size={16} />, run: onDownloadFolder },
                            { label: t('files.remote_upload'), icon: <Globe size={16} />, run: onRemoteUploadClick },
                            { label: t(theme === 'dark' ? 'common.light_mode' : 'common.dark_mode'), icon: theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />, run: toggleTheme },
                            { label: t('ui_copy.keyboard_shortcuts'), icon: <Keyboard size={16} />, run: onShowShortcuts },
                            { label: t('ui_copy.help_faq'), icon: <HelpCircle size={16} />, run: onShowHelp },
                        ]} />}
                    </div>
                </>
            )}
        </header>
    );
}
