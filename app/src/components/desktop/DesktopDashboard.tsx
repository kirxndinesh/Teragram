import { userFacingError } from '../../services/userFacingError';
import type { LocalSearchReply } from '../../services/localSearch';
import { orderCloudFiles } from '../../services/cloudFileOrdering';
import { FolderCog } from 'lucide-react';
import { isTextDocument, isCreativeDocument } from '../../services/documentFormats';
import { WorkspaceControls } from './cloud/WorkspaceControls';
import { FolderShortcut } from './cloud/FolderShortcut';
import { ViewToggle } from './cloud/ViewToggle';
import { useSidebarLayout } from './cloud/useSidebarLayout';
import { presentFile, isUsableFile } from '../../services/filePresentation';
import { clearImageMemoryCaches, invalidateImageFolder } from '../../services/imagePreviewCache';
import { rememberWorkspace, workspaceMemory } from '../../services/gallerySession';
import { useWorkspaceScroll } from '../../hooks/useWorkspaceScroll';
import { sourceFolder } from '../../services/fileIdentity';
import { lazy, useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { ORGANIZE_FILES_EVENT } from '../../services/workspace';
import { AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import { TelegramFile, type SmartView, type StorageInsightResult } from '../../types';
import { formatBytes, isMediaFile, isPdfFile, isArchiveFile, isImageFile, copyToClipboard } from '../../utils';

// Components
import { CloudSidebar } from './cloud/CloudSidebar';
import { StorageWidget } from './cloud/StoragePanel';
import { CloudFileBrowser } from './cloud/CloudFileBrowser';
import { MediaGallery } from './cloud/MediaGallery';
import { BulkActionBar } from './cloud/BulkActionBar';
import { LightboxActions } from './cloud/LightboxActions';
import { cloudFileType, cloudFileKey, folderKey, isGalleryFile } from './cloud/cloudFiles';
import { TopBar } from './dashboard/TopBar';
import { type SortDirection, type SortField } from './dashboard/FileExplorer';
import { TransferCenter } from './dashboard/TransferCenter';
import { MoveToFolderModal } from './dashboard/MoveToFolderModal';
import { ExternalDropBlocker } from './dashboard/ExternalDropBlocker';
import type { SettingsTab } from './dashboard/SettingsModal';
import { RenameFolderModal } from './dashboard/RenameFolderModal';
import { RenameFileModal } from './dashboard/RenameFileModal';
import { DriveConceptTour } from './dashboard/DriveConceptTour';
import { LazyFeatureBoundary } from '../shared/LazyFeatureBoundary';
import { SyncDashboard } from './sync/SyncDashboard';
import { Files, Link, Copy, Check, X, Loader2, Share2, FolderSymlink, FolderPlus } from 'lucide-react';

// Hooks
import { useTelegramConnection } from '../../hooks/useTelegramConnection';
import { useFileOperations } from '../../hooks/useFileOperations';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useFileDownload } from '../../hooks/useFileDownload';
import { useFileSharing } from '../../hooks/useFileSharing';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useGlobalFileSearch, useLocalFileSearch } from '../../hooks/useGlobalFileSearch';
import { useSettings } from '../../context/SettingsContext';
import { useActionScope } from '../../hooks/useActionScope';
import { DEFAULT_SEARCH_FILTERS, filterAndRankFiles, type FileSearchFilters } from '../../services/fileSearch';
import { markDesktopFrontendReady, markDesktopFrontendUnready, type DesktopNavigationRequest } from '../../services/desktopLifecycle';
import { fileQueryKey, invalidateFolderFileQueries, refreshFolderFiles, updateFileQueryData } from '../../services/fileListRefresh';
import { getAdjacentPreview, previewFileKey, samePreviewFile as sameFile } from '../../services/previewNavigation';
import i18n from '../../i18n';

const LazyAllocatedFoldersDialog = lazy(() => import('./cloud/AllocatedFolders').then(module => ({ default: module.AllocatedFoldersDialog })));
const LazyShareDialog = lazy(() => import('./dashboard/ShareDialog').then(module => ({ default: module.ShareDialog })));
const LazyImportChannelsDialog = lazy(() => import('./cloud/ImportChannelsDialog').then(module => ({default:module.ImportChannelsDialog})));
const LazyPreviewModal = lazy(() => import('./dashboard/PreviewModal').then((module) => ({ default: module.PreviewModal })));
const LazyMediaPlayer = lazy(() => import('./dashboard/MediaPlayer').then((module) => ({ default: module.MediaPlayer })));
const LazyPdfViewer = lazy(() => import('./dashboard/PdfViewer').then((module) => ({ default: module.PdfViewer })));
const LazyArchiveViewerModal = lazy(() => import('./dashboard/ArchiveViewerModal').then((module) => ({ default: module.ArchiveViewerModal })));
const LazySettingsModal = lazy(() => import('./dashboard/SettingsModal').then((module) => ({ default: module.SettingsModal })));
const LazyHelpCenterDialog = lazy(() => import('./dashboard/HelpCenterDialog').then((module) => ({ default: module.HelpCenterDialog })));
const LazyRemoteUploadModal = lazy(() => import('./dashboard/RemoteUploadModal').then(module => ({ default: module.RemoteUploadModal })));
const LazyKeyboardShortcutsDialog = lazy(() => import('./dashboard/KeyboardShortcutsDialog').then(module => ({ default: module.KeyboardShortcutsDialog })));
const LazyWorkspaceHub = lazy(() => import('../workspace/WorkspaceHub').then(module => ({ default: module.WorkspaceHub })));
const EMPTY_FILES: TelegramFile[] = [];

export function Dashboard({ onLogout }: { onLogout: () => void }) {
    const queryClient = useQueryClient();
    const sidebar = useSidebarLayout();
    const { t } = useTranslation();
    const [workspaceKeys, setWorkspaceKeys] = useState<string[] | null>(null);
    useEffect(() => {
        const organize = (event: Event) => setWorkspaceKeys((event as CustomEvent<{ keys: string[] }>).detail.keys);
        window.addEventListener(ORGANIZE_FILES_EVENT, organize);
        return () => window.removeEventListener(ORGANIZE_FILES_EVENT, organize);
    }, []);


    const {
        store, folders, groups, activeFolderId, setActiveFolderId, isSyncing, isConnected,
        handleLogout, handleSyncFolders, refreshLocalFolders, handleCreateFolder, handleFolderDelete,
        handleFolderRename, handleFolderToggleVisibility, handleExportFolderInvite,
        handleAssignFolderToGroup,
        handleReorderFolders, handleUpdateGroupOrder,
        accountId,
    } = useTelegramConnection(onLogout);

    useEffect(() => {
        if (!accountId) return;
        const foreign = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] === 'local-search'
            ? query.queryKey[1] !== accountId
            : query.queryKey[0] === 'files' && query.queryKey[query.queryKey.length - 1] !== accountId;
        void queryClient.cancelQueries({ predicate: foreign }).then(() => queryClient.removeQueries({ predicate: foreign }));
    }, [accountId, queryClient]);

    useEffect(() => {
        let closed = false;
        let stop: (() => void) | undefined;
        void listen<{ ownerId: string; folderId: number | null }>('file-inventory-changed', ({ payload }) => {
            if (closed || payload.ownerId !== accountId) return;
            invalidateImageFolder(payload.ownerId, payload.folderId);
            void queryClient.invalidateQueries({ queryKey: fileQueryKey(payload.ownerId, payload.folderId), exact: true });
        }).then(unlisten => { if (closed) unlisten(); else stop = unlisten; });
        return () => { closed = true; stop?.(); };
    }, [accountId, queryClient]);

    const { settings, updateSetting, updateSettings, isLoaded: settingsLoaded } = useSettings();
    const captureMutationScope = useActionScope(accountId);

    useEffect(() => {
        if (sessionStorage.getItem('telegram-drive-recovered-session') !== 'true') return;
        sessionStorage.removeItem('telegram-drive-recovered-session');
        const timer = window.setTimeout(() => {
            toast.success('We recovered your session — transfers are still queued.');
        }, 500);
        return () => window.clearTimeout(timer);
    }, []);
    const viewMode = settings.viewMode;
    const setViewMode = (mode: 'grid' | 'list') => updateSetting('viewMode', mode);

    const [previewFile, setPreviewFile] = useState<TelegramFile | null>(null);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const setSelectedIds = useCallback((_ids: number[]) => setSelectedKeys([]), []);
    const [moveRequest, setMoveRequest] = useState<{ ownerId: string; files: TelegramFile[] } | null>(null);
    const showMoveModal = moveRequest?.ownerId === accountId;
    const [showSettings, setShowSettings] = useState(false);
    const settingsModuleRequested = useRef(false);
    if (showSettings) settingsModuleRequested.current = true;
    const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('general');
    const [transferCenterOpenRequest, setTransferCenterOpenRequest] = useState(0);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [createFolderRequest, setCreateFolderRequest] = useState(0);
    const [activeSmartView, setActiveSmartView] = useState<SmartView | null>(null);
    const [showImportChannels,setShowImportChannels]=useState(false);
    const {data: importedIds = []}=useQuery<number[]>({queryKey:['imported-channels',accountId],enabled:!!accountId,queryFn:()=>invoke<number[]>('cmd_get_imported_channel_ids',{ownerId:accountId})});
    const removeImport=async(id:number)=>{try{await invoke('cmd_remove_imported_channel',{ownerId:accountId,channelId:id});await refreshLocalFolders();await queryClient.invalidateQueries({queryKey:['imported-channels',accountId]});window.dispatchEvent(new CustomEvent('tg-drive-refresh-catalog'));}catch(error){toast.error(userFacingError(error,t));}};
    const [workspaceView, setWorkspaceView] = useState<'cloud' | 'photos' | 'folder' | 'folders'>('photos');
    const [photoFilter, setPhotoFilter] = useState('all');
    const [showAllocated, setShowAllocated] = useState(false);
    const [bulkBusy, setBulkBusy] = useState(false);
    const startupOwner = useRef<string | null>(null);
    useEffect(() => {
        if (!settingsLoaded || !accountId || startupOwner.current !== null) return;
        startupOwner.current = accountId;
        setWorkspaceView(settings.startupView === 'photos' ? 'photos' : 'cloud');
        if (settings.startupView === 'photos') setViewMode('grid');
        setActiveSmartView(settings.startupView === 'recents' ? 'recents' : null);
        setActiveFolderId(null);
    }, [settingsLoaded, accountId, settings.startupView, setActiveFolderId]);
    const [insightSummary, setInsightSummary] = useState<{ scope: string; count: number; complete: boolean } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchFilters, setSearchFilters] = useState<FileSearchFilters>(DEFAULT_SEARCH_FILTERS);
    const { results: searchResults, isSearching, reply: searchReply, error: searchError } = useGlobalFileSearch(searchTerm, searchFilters, accountId);
    const [folderSyncProgress, setFolderSyncProgress] = useState({ active: false, count: 0 });
    const fileLoadSequenceRef = useRef(0);
    const fileLoadScope = JSON.stringify([accountId, activeSmartView, activeFolderId]);
    const fileLoadScopeRef = useRef({ key: fileLoadScope, generation: 0 });
    if (fileLoadScopeRef.current.key !== fileLoadScope) {
        fileLoadScopeRef.current = { key: fileLoadScope, generation: fileLoadScopeRef.current.generation + 1 };
    }
    useEffect(() => {
        setFolderSyncProgress({ active: false, count: 0 });
        return () => { fileLoadSequenceRef.current++; };
    }, [fileLoadScope]);
    useEffect(() => {
        if (!accountId || activeSmartView) return;
        let disposed = false;
        const touch = () => {
            void invoke<boolean>('cmd_touch_file_inventory', { ownerId: accountId, folderId: activeFolderId }).then(present => {
                if (!present && !disposed) void invalidateFolderFileQueries(queryClient, activeFolderId, accountId);
            }).catch(() => {});
        };
        touch();
        const timer = window.setInterval(touch, 60_000);
        return () => { disposed = true; window.clearInterval(timer); };
    }, [accountId, activeFolderId, activeSmartView, queryClient]);
    useEffect(() => {
        let disposed = false;
        let stop: (() => void) | undefined;
        void listen('vault-locked', () => {
            if (disposed) return;
            clearImageMemoryCaches();
            fileLoadScopeRef.current.generation++;
            fileLoadSequenceRef.current++;
            setPreviewFile(file => file?.encryption_state === 'encrypted_unlocked' ? null : file);
            setMoveRequest(null);
            setFolderSyncProgress({ active: false, count: 0 });
            void queryClient.cancelQueries({ queryKey: ['files'] }).then(() => {
                if (disposed) return;
                queryClient.setQueriesData<TelegramFile[]>({ queryKey: ['files'] }, files =>
                    files?.filter(file => file.encryption_state !== 'encrypted_unlocked'));
                void queryClient.invalidateQueries({ queryKey: ['files'] });
            });
        }).then(unlisten => { if (disposed) unlisten(); else stop = unlisten; });
        return () => { disposed = true; stop?.(); };
    }, [queryClient]);
    const cardScale = settings.thumbnailScale;
    const setCardScale = (value: number) => updateSetting('thumbnailScale', value);
    const sortField: SortField = settings.fileSortField;
    const sortDirection: SortDirection = settings.fileSortDirection;
    const [internalDrag, setInternalDrag] = useState<{ ownerId: string; fileIds: number[]; files: TelegramFile[]; label: string; isCurrent: () => boolean } | null>(null);
    const dragSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleSortChange = (field: SortField) => {
        if (field === sortField) {
            updateSettings({
                fileSortField: field,
                fileSortDirection: sortDirection === 'asc' ? 'desc' : 'asc',
            });
            return;
        }
        updateSettings({ fileSortField: field, fileSortDirection: 'asc' });
    };
    const [showRemoteUpload, setShowRemoteUpload] = useState(false);
    const [playingFile, setPlayingFile] = useState<TelegramFile | null>(null);
    const [localPreview, setLocalPreview] = useState<{ key: string; path: string } | null>(null);
    const [pdfFile, setPdfFile] = useState<TelegramFile | null>(null);
    const [archiveViewFile, setArchiveViewFile] = useState<TelegramFile | null>(null);
    const {
        shareFile, shareOwnerId, setShareFile, bulkShareLinks, bulkShareLoading, bulkShareCopied,
        setBulkShareLinks, createBulkShares, handleCopyBulkLink, handleNativeShareBulkLink,
    } = useFileSharing(accountId, activeFolderId);
    const [previewContextFiles, setPreviewContextFiles] = useState<TelegramFile[]>([]);
    const [previewContextIndex, setPreviewContextIndex] = useState(-1);
    const [renameFolder, setRenameFolder] = useState<{ id: number; name: string } | null>(null);
    const [renameRequest, setRenameRequest] = useState<{ ownerId: string; file: TelegramFile } | null>(null);
    const renameFileTarget = renameRequest?.ownerId === accountId ? renameRequest.file : null;
    const moveFileTarget = showMoveModal && moveRequest?.files.length === 1 ? moveRequest.files[0] : null;
    useEffect(() => { setSelectedIds([]); setMoveRequest(null); setRenameRequest(null); setInternalDrag(null); }, [accountId]);

    useEffect(() => {
        let cancelled = false;
        let unlisten: (() => void) | undefined;
        let unlistenBackgroundHint: (() => void) | undefined;
        const initializeBridge = async () => {
            const [disposeNavigation, disposeBackgroundHint] = await Promise.all([
                listen<DesktopNavigationRequest>('desktop-navigation-request', ({ payload }) => {
                    if (payload.target === 'transfers') {
                        setTransferCenterOpenRequest(value => value + 1);
                    } else if (payload.target === 'settings') {
                        setSettingsInitialTab('general');
                        setShowSettings(true);
                    }
                }),
                listen('desktop-background-hint', () => {
                    toast.info(t('settings.desktop_background_hint'));
                }),
            ]);
            if (cancelled) {
                disposeNavigation();
                disposeBackgroundHint();
                return;
            }
            unlisten = disposeNavigation;
            unlistenBackgroundHint = disposeBackgroundHint;
            await markDesktopFrontendReady();
        };
        void initializeBridge().catch(() => {
            // Browser previews do not expose the desktop event or command bridge.
        });
        return () => {
            cancelled = true;
            unlisten?.();
            unlistenBackgroundHint?.();
            void markDesktopFrontendUnready().catch(() => {});
        };
    }, [t]);

    useEffect(() => {
        const openSettings = (event: Event) => {
            const tab = (event as CustomEvent<{ tab?: SettingsTab }>).detail?.tab ?? 'general';
            setSettingsInitialTab(tab);
            setShowSettings(true);
        };
        const keyboard = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key === ',') {
                event.preventDefault(); setSettingsInitialTab('general'); setShowSettings(true);
            }
        };
        window.addEventListener('keydown', keyboard);
        window.addEventListener('telegram-drive-open-settings', openSettings);
        return () => { window.removeEventListener('telegram-drive-open-settings', openSettings); window.removeEventListener('keydown', keyboard); };
    }, []);

    const catalog = useLocalFileSearch({ ...DEFAULT_SEARCH_FILTERS, scope: 'all', query: '' }, accountId, !!store && !!accountId, folders.map(folder => folder.id).join(','));
    const { data: allFiles = EMPTY_FILES, isLoading, error } = useQuery({
        queryKey: fileQueryKey(accountId, activeFolderId, activeSmartView ?? 'folder'),
        queryFn: async ({ signal }) => {
            if (!accountId) throw new Error('ACCOUNT_REQUIRED');
            const requestSequence = ++fileLoadSequenceRef.current;
            const generation = fileLoadScopeRef.current.generation;
            const isCurrent = () => !signal.aborted
                && fileLoadScopeRef.current.generation === generation
                && fileLoadSequenceRef.current === requestSequence;
            const check = () => { if (!isCurrent()) throw new DOMException('File refresh was cancelled', 'AbortError'); };
            if (activeSmartView) {
                let localFiles: TelegramFile[];
                if (activeSmartView === 'offline') {
                    localFiles = await invoke<TelegramFile[]>('cmd_get_offline_files', { ownerId: accountId, limit: 250 });
                } else if (activeSmartView === 'large' || activeSmartView === 'old' || activeSmartView === 'duplicates') {
                    const insight = await invoke<StorageInsightResult>('cmd_get_storage_insight', {
                        view: activeSmartView,
                        ownerId: accountId,
                        largeThresholdBytes: 100 * 1024 * 1024,
                        oldFileDays: 365,
                    });
                    check();
                    setInsightSummary({ scope: fileLoadScope, count: insight.scanned_count, complete: insight.complete });
                    localFiles = insight.files;
                } else {
                    localFiles = await invoke<TelegramFile[]>('cmd_get_file_activity', { ownerId: accountId, view: activeSmartView, limit: 250 });
                }
                check();
                return localFiles.map((file) => ({ ...file, sizeStr: formatBytes(file.size), type: 'file' as const }));
            }
            const queryKey = fileQueryKey(accountId, activeFolderId);
            return refreshFolderFiles({
                ownerId: accountId,
                folderId: activeFolderId,
                requestId: `desktop-${crypto.randomUUID()}`,
                signal,
                isCurrent,
                cachedFiles: queryClient.getQueryData<TelegramFile[]>(queryKey),
                onFiles: files => queryClient.setQueryData(queryKey, files),
                onProgress: setFolderSyncProgress,
            });
        },
        initialData: () => {
            if (activeSmartView !== 'favorites' && activeSmartView !== 'pinned') return undefined;
            if (!catalog.reply) return undefined;
            return catalog.results.filter(file => activeSmartView === 'favorites' ? file.is_favorite : file.is_pinned);
        },
        initialDataUpdatedAt: 0,
        enabled: !!store && !!accountId && (workspaceView === 'folder' || activeSmartView !== null),
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    const allocated = accountId ? settings.photoFolderAllocations[accountId] : [];
    const photoOptions = [{ id: null, name: t('common.saved_messages') }, ...folders].filter(folder => allocated === undefined || allocated.includes(folderKey(folder.id)));
    const displayedFiles = useMemo(() => {
        let base = searchFilters.scope === 'all' ? searchResults : workspaceView === 'folder' || activeSmartView ? (error ? [] : allFiles) : catalog.results;
        base = base.map(file => ({ ...file, size: Number(file.size) })).filter(isUsableFile).map(presentFile);
        if (workspaceView === 'photos') base = base.filter(file => isGalleryFile(file)
            && (allocated === undefined || allocated.includes(folderKey(file.folder_id ?? null)))
            && (photoFilter === 'all' || photoFilter === folderKey(file.folder_id ?? null)));
        return orderCloudFiles(filterAndRankFiles(base, searchTerm, searchFilters), sortField, sortDirection, workspaceView !== 'photos' && searchFilters.type === 'all');
    }, [allFiles, error, searchResults, searchTerm, searchFilters, workspaceView, activeSmartView, catalog.results, allocated, photoFilter, sortField, sortDirection]);
    const selectedFiles = displayedFiles.filter(file => selectedKeys.includes(cloudFileKey(file)));
    const selectedIds = selectedFiles.map(file => file.id);
    const isCrossFolderView = workspaceView !== 'folder' || activeSmartView !== null || searchFilters.scope === 'all';
    const galleryMode = (workspaceView === 'photos' || searchFilters.type === 'image' || searchFilters.type === 'video') && viewMode === 'grid';
    const viewScope = (view: string, folder: number | null = null, smart: SmartView | null = null) => JSON.stringify([accountId, view, folder, smart]);
    const scope = viewScope(workspaceView, workspaceView === 'folder' ? activeFolderId : null, activeSmartView);
    const galleryKey = JSON.stringify([scope, workspaceView === 'photos' ? photoFilter : '', searchFilters.type, viewMode]);
    const scroll = useWorkspaceScroll(galleryKey, workspaceView === 'folders' || displayedFiles.length > 0 || !(isLoading || catalog.isSearching || isSearching), displayedFiles, cardScale);
    useLayoutEffect(() => { if (accountId && startupOwner.current !== null) rememberWorkspace(scope, { filters: searchFilters, mode: viewMode }); }, [scope, accountId, searchFilters, viewMode]);
    const restoreView = (view: string, folder: number | null = null, smart: SmartView | null = null) => {
        scroll.save();
        const memory = workspaceMemory(viewScope(view, folder, smart));
        setSearchFilters(memory.filters ?? DEFAULT_SEARCH_FILTERS);
        setViewMode(memory.mode ?? (view === 'photos' ? 'grid' : view === 'cloud' ? 'list' : viewMode));
    };
    const changeFilters = (filters: FileSearchFilters) => {
        scroll.save();
        setSearchFilters(filters);
        if (filters.type === 'image' || filters.type === 'video') setViewMode('grid');
        else if (filters.type === 'document') setViewMode('list');
    };
    const navigateFolders = () => { scroll.save(); setWorkspaceView('folders'); setActiveSmartView(null); setActiveFolderId(null); setSearchTerm(''); clearSelection(); };
    const navigateFolder = (id: number | null) => { restoreView('folder', id); setWorkspaceView('folder'); setActiveSmartView(null); setActiveFolderId(id); clearSelection(); };
    const navigateCloud = () => { restoreView('cloud'); setWorkspaceView('cloud'); setActiveSmartView(null); setActiveFolderId(null); clearSelection(); };
    const navigatePhotos = () => { restoreView('photos'); setWorkspaceView('photos'); setActiveSmartView(null); setActiveFolderId(null); clearSelection(); };

    const handleManualSync = useCallback(async () => {
        await handleSyncFolders();
        window.dispatchEvent(new CustomEvent('tg-drive-refresh-catalog'));
        if (activeSmartView === null) {
            await queryClient.invalidateQueries({
                queryKey: fileQueryKey(accountId, activeFolderId),
                exact: true,
            });
        }
    }, [accountId, activeFolderId, activeSmartView, handleSyncFolders, queryClient]);

    const { uploadQueue, handleManualUpload, handleFolderUpload, handleDropUpload, handleUrlUpload, clearFinished: clearUploads, cancelAll: cancelUploads, pauseAll: pauseUploads, resumeAll: resumeUploads, cancelItem: cancelUploadItem, retryItem: retryUploadItem } = useFileUpload(workspaceView === 'folder' ? activeFolderId : null, store, undefined, undefined, accountId ?? undefined);
    const { downloadQueue, queueDownload, queueBulkDownload, clearFinished: clearDownloads, cancelAll: cancelDownloads, pauseAll: pauseDownloads, resumeAll: resumeDownloads, cancelItem: cancelDownloadItem, retryItem: retryDownloadItem } = useFileDownload(store, undefined, undefined, accountId ?? undefined);

    const {
        handleDelete, handleBulkDelete, handleBulkDownload,
        handleMoveFiles, handleRenameFile: renameOwnedFile, handleDownloadFolder

    } = useFileOperations(activeFolderId, selectedIds, setSelectedIds, displayedFiles, queueBulkDownload, accountId, selectedFiles);

    const handleBulkShare = useCallback(() => createBulkShares(
        selectedFiles.filter(file => file.type !== 'folder'),
        () => setSelectedIds([]),
    ), [createBulkShares, selectedFiles]);

    const handleSelectAll = useCallback(() => setSelectedKeys(displayedFiles.filter(file => file.type !== 'folder').map(cloudFileKey)), [displayedFiles]);

    const handleKeyboardDelete = useCallback(() => {
        if (selectedIds.length > 0) {
            handleBulkDelete();
        }
    }, [selectedIds, handleBulkDelete]);

    const handleEscape = useCallback(() => {
        selectionAnchorKey.current = null;
        setSelectedIds([]);
        setSearchTerm("");
        setPreviewFile(null);
        setPlayingFile(null);
        setPdfFile(null);
        setArchiveViewFile(null);
    }, []);

    const handleFocusSearch = useCallback(() => {
        const searchInput = document.querySelector('input[data-file-search]') as HTMLInputElement;
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }, []);

    const handleEnter = useCallback(() => {
        if (selectedIds.length === 1) {
            const selected = selectedFiles[0];
            if (selected) {
                if (selected.type === 'folder') {
                    setActiveFolderId(selected.id);
                } else {
                    handlePreview(selected, displayedFiles);
                }
            }
        }
    }, [selectedIds, displayedFiles, setActiveFolderId]);


    useLayoutEffect(() => {
        selectionAnchorKey.current = null;
        setSelectedIds([]);
        setMoveRequest(null);
        setSearchTerm("");
        setPreviewFile(null);
        setPlayingFile(null);
        setPdfFile(null);
        setPreviewContextFiles([]);
        setPreviewContextIndex(-1);
        setArchiveViewFile(null);
    }, [accountId, activeFolderId, activeSmartView, workspaceView, photoFilter]);


    const selectionAnchorKey = useRef<string | null>(null);

    const clearSelection = useCallback(() => {
        selectionAnchorKey.current = null;
        setSelectedIds([]);
    }, []);

    const handleFileClick = (event: React.MouseEvent, file: TelegramFile, orderedFiles: TelegramFile[] = []) => {
        event.stopPropagation();
        if (file.type === 'folder') { navigateFolder(file.id); return; }
        const ordered = orderedFiles.length ? orderedFiles : displayedFiles;
        const index = ordered.findIndex(candidate => sameFile(candidate, file));
        const key = cloudFileKey(file);
        const anchorIndex = ordered.findIndex(candidate => cloudFileKey(candidate) === selectionAnchorKey.current);
        if (event.shiftKey && anchorIndex >= 0) {
            const start = Math.min(anchorIndex, index);
            const end = Math.max(anchorIndex, index);
            setSelectedKeys(ordered.slice(start, end + 1).filter(value => value.type !== 'folder').map(cloudFileKey));
        } else if (event.shiftKey || event.metaKey || event.ctrlKey) {
            selectionAnchorKey.current = key;
            setSelectedKeys(keys => keys.includes(key) ? keys.filter(value => value !== key) : [...keys, key]);
        } else {
            selectionAnchorKey.current = key;
            handlePreview(file, ordered);
        }
    };
    const handleToggleSelection = (file: TelegramFile) => {
        const key = cloudFileKey(file);
        selectionAnchorKey.current = key;
        setSelectedKeys(keys => keys.includes(key) ? keys.filter(value => value !== key) : [...keys, key]);
    };

    const handleFileMove = useCallback((file: TelegramFile) => {
        if (!accountId || !captureMutationScope()()) return;
        setMoveRequest({ ownerId: accountId, files: [{ ...file, folder_id: sourceFolder(file, activeFolderId) }] });
    }, [accountId, activeFolderId, captureMutationScope]);

    const handleOpenBulkMove = useCallback(() => {
        if (!accountId || !captureMutationScope()()) return;
        const files = selectedFiles
            .map(file => ({ ...file, folder_id: sourceFolder(file, activeFolderId) }));
        if (files.length && files.length === selectedIds.length) setMoveRequest({ ownerId: accountId, files });
    }, [accountId, activeFolderId, captureMutationScope, displayedFiles, selectedIds]);

    const handleRename = useCallback((file: TelegramFile) => {
        if (!accountId || !captureMutationScope()()) return;
        setRenameRequest({ ownerId: accountId, file: { ...file, folder_id: sourceFolder(file, activeFolderId) } });
    }, [accountId, activeFolderId, captureMutationScope]);

    const handleRenameSubmit = useCallback(async (newName: string) => {
        if (!renameRequest || renameRequest.ownerId !== accountId || !captureMutationScope()()) return;
        if (!await renameOwnedFile(renameRequest.file, newName)) throw new Error('ACCOUNT_CHANGED');
    }, [accountId, captureMutationScope, renameOwnedFile, renameRequest]);

    const handleKeyboardDownload = useCallback(() => {
        if (selectedIds.length > 0) {
            handleBulkDownload();
        }
    }, [selectedIds, handleBulkDownload]);

    const handleKeyboardShare = useCallback(() => {
        if (selectedIds.length > 0) {
            handleBulkShare();
        }
    }, [selectedIds, handleBulkShare]);

    const handleKeyboardRename = useCallback(() => {
        if (selectedIds.length === 1) {
            const selected = selectedFiles[0];
            if (selected && selected.type !== 'folder') {
                handleRename(selected);
            }
        }
    }, [selectedIds, displayedFiles, handleRename]);

    useKeyboardShortcuts({
        onSelectAll: handleSelectAll,
        onDelete: handleKeyboardDelete,
        onEscape: handleEscape,
        onSearch: handleFocusSearch,
        onEnter: handleEnter,
        onDownload: handleKeyboardDownload,
        onShare: handleKeyboardShare,
        onRename: handleKeyboardRename,
        onShowShortcuts: () => setShowShortcuts(true),
        enabled: !previewFile && !playingFile && !pdfFile && !archiveViewFile
            && !showMoveModal && !showImportChannels && !showSettings && !showShortcuts && !showHelp && workspaceKeys === null
            && !showRemoteUpload && !shareFile && !bulkShareLinks
            && !showAllocated
    });

    const handlePreview = (file: TelegramFile, orderedFiles?: TelegramFile[], localPath?: string) => {
        setLocalPreview(localPath ? { key: previewFileKey(file), path: localPath } : null);
        if (localPath && !isMediaFile(file.name) && !isPdfFile(file.name) && !isImageFile(file.name) && !isTextDocument(file.name) && !isCreativeDocument(file.name)) {
            setPlayingFile(null); setPreviewFile(null); setPdfFile(null); setArchiveViewFile(null);
            void invoke('cmd_open_file_externally', { path: localPath }).catch(() => toast.error(t('workspace.preview_failed')));
            return;
        }
        const sourceFolderId = sourceFolder(file, activeFolderId);
        const openedOwner = accountId;
        const openedGeneration = fileLoadScopeRef.current.generation;
        if (openedOwner) void invoke('cmd_record_file_opened', {
            ownerId: openedOwner,
            folderId: sourceFolderId,
            messageId: file.id,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.mime_type ?? null,
            fileExt: file.file_ext ?? null,
            createdAt: file.created_at ?? null,
            encryptionState: file.encryption_state ?? 'plain',
        }).then(() => {
            if (fileLoadScopeRef.current.generation === openedGeneration) return queryClient.invalidateQueries({
                queryKey: ['files', 'recents'], predicate: query => query.queryKey[query.queryKey.length - 1] === openedOwner,
            });
        }).catch(() => {});
        const contextFiles = (localPath ? [file] : orderedFiles || displayedFiles).filter((f) => f.type !== 'folder');
        const contextIndex = contextFiles.findIndex((candidate) => sameFile(candidate, file));

        setPreviewContextFiles(contextFiles);
        setPreviewContextIndex(contextIndex);

        const isMedia = ['video', 'audio'].includes(cloudFileType(file));
        const isPdf = isPdfFile(file.name);
        const isArchive = isArchiveFile(file.name);

        if (isArchive) {
            setArchiveViewFile(file);
            setPreviewFile(null);
            setPlayingFile(null);
            setPdfFile(null);
        } else if (isMedia) {
            setPlayingFile(file);
            setPreviewFile(null);
            setPdfFile(null);
            setArchiveViewFile(null);
        } else if (isPdf) {
            setPdfFile(file);
            setPreviewFile(null);
            setPlayingFile(null);
            setArchiveViewFile(null);
        } else {
            setPreviewFile(file);
            setPlayingFile(null);
            setPdfFile(null);
            setArchiveViewFile(null);
        }
    };

    const navigatePreview = useCallback((step: 1 | -1) => {
        const next = getAdjacentPreview(
            previewContextFiles,
            previewFile ?? playingFile ?? pdfFile ?? archiveViewFile,
            step,
        );
        if (!next) return;
        const nextFile = next.file;
        setPreviewContextIndex(next.index);

        const isMedia = ['video', 'audio'].includes(cloudFileType(nextFile));
        const isPdf = isPdfFile(nextFile.name);
        const isArchive = isArchiveFile(nextFile.name);

        if (isArchive) {
            setArchiveViewFile(nextFile);
            setPreviewFile(null);
            setPlayingFile(null);
            setPdfFile(null);
        } else if (isMedia) {
            setPlayingFile(nextFile);
            setPreviewFile(null);
            setPdfFile(null);
            setArchiveViewFile(null);
        } else if (isPdf) {
            setPdfFile(nextFile);
            setPreviewFile(null);
            setPlayingFile(null);
            setArchiveViewFile(null);
        } else {
            setPreviewFile(nextFile);
            setPlayingFile(null);
            setPdfFile(null);
            setArchiveViewFile(null);
        }
    }, [previewContextFiles, previewFile, playingFile, pdfFile, archiveViewFile]);

    const handleNextPreview = useCallback(() => {
        navigatePreview(1);
    }, [navigatePreview]);

    const handlePrevPreview = useCallback(() => {
        navigatePreview(-1);
    }, [navigatePreview]);

    const previewNeighborFiles = useCallback(() => {
        if (previewContextFiles.length === 0) {
            return { nextFile: null as TelegramFile | null, prevFile: null as TelegramFile | null };
        }

        const currentFile = previewFile ?? playingFile ?? pdfFile ?? archiveViewFile;
        if (!currentFile) {
            return { nextFile: null as TelegramFile | null, prevFile: null as TelegramFile | null };
        }

        const currentIdx = previewContextFiles.findIndex((file) => sameFile(file, currentFile));
        if (currentIdx === -1) {
            return { nextFile: null as TelegramFile | null, prevFile: null as TelegramFile | null };
        }

        const nextIdx = (currentIdx + 1) % previewContextFiles.length;
        const prevIdx = (currentIdx - 1 + previewContextFiles.length) % previewContextFiles.length;

        return {
            nextFile: previewContextFiles[nextIdx] || null,
            prevFile: previewContextFiles[prevIdx] || null,
        };
    }, [previewContextFiles, previewFile, playingFile, pdfFile, archiveViewFile]);

    const handleInternalDragStart = (event: DragStartEvent) => {
        const isCurrent = captureMutationScope();
        if (!accountId || !isCurrent() || event.active.data.current?.kind !== 'telegram-files') return;
        const fileIds = event.active.data.current.fileIds;
        if (!Array.isArray(fileIds) || fileIds.length === 0) return;
        const ids = fileIds.filter((id): id is number => typeof id === 'number');
        const files = displayedFiles.filter(file => ids.includes(file.id))
            .map(file => ({ ...file, folder_id: sourceFolder(file, activeFolderId) }));
        if (files.length !== ids.length) return;
        setInternalDrag({ ownerId: accountId, fileIds: ids, files, isCurrent, label: String(event.active.data.current.label || '') });
    };

    const handleInternalDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        const drag = internalDrag;
        setInternalDrag(null);
        if (!over || !captureMutationScope()()) return;

        const activeKind = active.data.current?.kind;
        const overKind = over.data.current?.kind;

        if (activeKind === 'telegram-files') {
            if (!drag || drag.ownerId !== accountId || !drag.isCurrent()) return;
            const fileIds = drag.fileIds;
            const targetFolderId = over.data.current?.folderId;
            const isFolderTarget = overKind === 'sidebar-folder' || overKind === 'content-folder';
            if (isFolderTarget && Array.isArray(fileIds) && (targetFolderId === null || typeof targetFolderId === 'number')) {
                await handleMoveFiles(drag.files, targetFolderId, () => setSelectedIds([]), true);
            }
            return;
        }

        if (activeKind === 'sidebar-folder') {
            const draggedFolderId = active.data.current?.folderId;
            if (typeof draggedFolderId !== 'number') return;

            if (overKind === 'sidebar-group') {
                const groupId = over.data.current?.groupId;
                await handleAssignFolderToGroup(draggedFolderId, typeof groupId === 'number' ? groupId : null);
                return;
            }

            if (overKind === 'sidebar-folder') {
                const overFolderId = over.data.current?.folderId;
                if (typeof overFolderId !== 'number' || draggedFolderId === overFolderId) return;
                const oldIndex = folders.findIndex(folder => folder.id === draggedFolderId);
                const newIndex = folders.findIndex(folder => folder.id === overFolderId);
                if (oldIndex !== -1 && newIndex !== -1) {
                    await handleReorderFolders(arrayMove(folders, oldIndex, newIndex));
                }
            }
            return;
        }

        if (activeKind === 'sidebar-group' && overKind === 'sidebar-group') {
            const draggedGroupId = active.data.current?.groupId;
            const overGroupId = over.data.current?.groupId;
            if (typeof draggedGroupId !== 'number' || typeof overGroupId !== 'number' || draggedGroupId === overGroupId) return;
            const oldIndex = groups.findIndex(group => group.id === draggedGroupId);
            const newIndex = groups.findIndex(group => group.id === overGroupId);
            if (oldIndex !== -1 && newIndex !== -1) {
                await handleUpdateGroupOrder(arrayMove(groups, oldIndex, newIndex));
            }
        }
    };

    const currentFolderName = activeFolderId === null
        ? t('common.saved_messages')
        : folders.find(f => f.id === activeFolderId)?.name || t('common.folders');
    const currentViewName = activeSmartView
        ? ({
            recents: t('common.recents'),
            favorites: t('common.favorites'),
            pinned: t('common.pinned'),
            offline: t('common.offline_files'),
            large: t('common.large_files'),
            old: t('common.old_files'),
            duplicates: t('common.duplicates'),
        } as const)[activeSmartView]
        : workspaceView === 'folders' ? t('common.folders') : workspaceView === 'photos' ? t('tg.photos') : workspaceView === 'cloud' ? t('tg.cloud') : currentFolderName;

    const updateActivityFlag = useCallback(async (file: TelegramFile, flag: 'favorite' | 'pinned') => {
        if (!accountId) return;
        const generation = fileLoadScopeRef.current.generation;
        const nextValue = flag === 'favorite' ? !file.is_favorite : !file.is_pinned;
        try {
        await invoke('cmd_set_file_activity_flag', {
            ownerId: accountId,
            folderId: sourceFolder(file, activeFolderId),
            messageId: file.id,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.mime_type ?? null,
            fileExt: file.file_ext ?? null,
            createdAt: file.created_at ?? null,
            encryptionState: file.encryption_state ?? 'plain',
            flag,
            value: nextValue,
        });
        if (generation !== fileLoadScopeRef.current.generation) return;
        queryClient.setQueriesData<LocalSearchReply>({ queryKey: ['local-search', accountId] }, reply => reply ? {
            ...reply, files: reply.files.map(row => sameFile(row, file) ? { ...row, [flag === 'favorite' ? 'is_favorite' : 'is_pinned']: nextValue } : row),
        } : reply);
        updateFileQueryData(
            queryClient,
            sourceFolder(file, activeFolderId),
            new Set([file.id]),
            current => ({
                ...current,
                [flag === 'favorite' ? 'is_favorite' : 'is_pinned']: nextValue,
            }),
            accountId,
        );
        await queryClient.invalidateQueries({
            queryKey: ['files', flag === 'favorite' ? 'favorites' : 'pinned'],
            predicate: query => query.queryKey[query.queryKey.length - 1] === accountId,
        });
        const patch = (current: TelegramFile | null) => current && sameFile(current, file) ? { ...current, [flag === 'favorite' ? 'is_favorite' : 'is_pinned']: nextValue } : current;
        setPreviewFile(patch); setPlayingFile(patch);
        window.dispatchEvent(new CustomEvent('tg-drive-refresh-catalog'));
        toast.success(flag === 'favorite'
            ? (nextValue ? i18n.t('navigation_copy.favorite_added') : i18n.t('navigation_copy.favorite_removed'))
            : (nextValue ? i18n.t("common.pinned") : i18n.t('navigation_copy.unpinned')));
        } catch {
            if (generation === fileLoadScopeRef.current.generation) toast.error(t('common.operation_failed'));
        }
    }, [accountId, activeFolderId, queryClient, t]);


    const lightboxActions = (file: TelegramFile) => <LightboxActions file={file}
        sourceName={sourceFolder(file, activeFolderId) === null ? t('common.saved_messages') : folders.find(folder => folder.id === sourceFolder(file, activeFolderId))?.name || t('common.folders')}
        onDownload={() => { void queueDownload(file.id, file.name, sourceFolder(file, activeFolderId), file.size); }}
        onFavorite={() => void updateActivityFlag(file, 'favorite')}
        onDelete={async () => { if (await handleDelete(file)) { setPreviewFile(null); setPlayingFile(null); } }} />;

    const previewNeighbors = previewNeighborFiles();

    return (
        <DndContext
            key={accountId ?? 'signed-out'}
            sensors={dragSensors}
            collisionDetection={closestCenter}
            onDragStart={handleInternalDragStart}
            onDragCancel={() => setInternalDrag(null)}
            onDragEnd={handleInternalDragEnd}
        >
            <div className="desktop-shell cloud-shell relative flex h-screen w-full overflow-hidden bg-app-canvas">
                <SyncDashboard />

            <ExternalDropBlocker
                currentFolderName={currentFolderName}
                enabled={isConnected}
                onFilesDropped={handleDropUpload}
                onUploadClick={handleManualUpload}
            />

            <AnimatePresence>
                {showMoveModal && moveRequest && (
                    <MoveToFolderModal
                        folders={folders}
                        fileName={moveFileTarget?.name}
                        onClose={() => setMoveRequest(current => current === moveRequest ? null : current)}
                        onSelect={async targetFolderId => {
                            if (moveRequest.ownerId !== accountId || !captureMutationScope()()) return;
                            const batches = new Map<number | null, TelegramFile[]>();
                            for (const file of moveRequest.files) { const source = sourceFolder(file, activeFolderId); batches.set(source, [...(batches.get(source) ?? []), file]); }
                            const current = captureMutationScope();
                            for (const files of batches.values()) { if (!current()) return; if (sourceFolder(files[0], activeFolderId) !== targetFolderId && !await handleMoveFiles(files, targetFolderId)) return; }
                            if (current()) { setSelectedIds([]); setMoveRequest(value => value === moveRequest ? null : value); }
                        }}
                        activeFolderId={new Set(moveRequest.files.map(file => sourceFolder(file, activeFolderId))).size === 1 ? sourceFolder(moveRequest.files[0], activeFolderId) : undefined}
                        key={`move:${moveRequest.ownerId}`}
                    />
                )}
                {playingFile && (
                    <LazyFeatureBoundary key={`media:${previewFileKey(playingFile)}`}>
                        <LazyMediaPlayer
                            file={playingFile}
                            ownerId={accountId ?? undefined}
                            actions={lightboxActions(playingFile)}
                            onClose={() => setPlayingFile(null)}
                            onPlayFile={file => handlePreview(file, previewContextFiles)}
                            onNext={handleNextPreview}
                            onPrev={handlePrevPreview}
                            currentIndex={previewContextIndex}
                            totalItems={previewContextFiles.length}
                            activeFolderId={sourceFolder(playingFile, activeFolderId)}
                            localPath={localPreview?.key === previewFileKey(playingFile) ? localPreview.path : undefined}
                        />
                    </LazyFeatureBoundary>
                )}
                {pdfFile && (
                    <LazyFeatureBoundary key={`pdf:${previewFileKey(pdfFile)}`}>
                        <LazyPdfViewer
                            file={pdfFile}
                            onDownload={() => queueDownload(pdfFile.id, pdfFile.name, sourceFolder(pdfFile, activeFolderId), pdfFile.size)}
                            onClose={() => setPdfFile(null)}
                            onNext={handleNextPreview}
                            onPrev={handlePrevPreview}
                            currentIndex={previewContextIndex}
                            totalItems={previewContextFiles.length}
                            activeFolderId={sourceFolder(pdfFile, activeFolderId)}
                            localPath={localPreview?.key === previewFileKey(pdfFile) ? localPreview.path : undefined}
                        />
                    </LazyFeatureBoundary>
                )}
                {showRemoteUpload && (
                    <LazyFeatureBoundary><LazyRemoteUploadModal
                        isOpen={showRemoteUpload}
                        onClose={() => setShowRemoteUpload(false)}
                        folders={folders}
                        onUpload={handleUrlUpload}
                        key="remote-upload-modal"
                    /></LazyFeatureBoundary>
                )}
            </AnimatePresence>

            <CloudSidebar importedIds={importedIds} onRemoveImport={id=>void removeImport(id)} layout={sidebar} onUpload={handleManualUpload} onFolderUpload={handleFolderUpload} storage={<StorageWidget files={catalog.results} complete={catalog.reply?.complete ?? false} loading={catalog.isSearching} error={catalog.error} onRefresh={() => void handleManualSync()} />} folders={folders} view={workspaceView} onFolders={navigateFolders} activeFolderId={activeFolderId} smartView={activeSmartView}
                onCloud={navigateCloud} onPhotos={navigatePhotos} onFolder={navigateFolder}
                onSmartView={view => { restoreView('cloud', null, view); setWorkspaceView('cloud'); setActiveSmartView(view); clearSelection(); }}
                onCreate={handleCreateFolder} createRequest={createFolderRequest}
                onDelete={handleFolderDelete} onRename={(id, name) => setRenameFolder({ id, name })}
                onVisibility={async (id, _name, isPublic) => { await handleFolderToggleVisibility(id, !isPublic); void queryClient.invalidateQueries({ queryKey: ['folders'] }); }}
                onInvite={async id => { const info = await handleExportFolderInvite(id); await copyToClipboard(info.link); }} />

            <section aria-label={currentViewName} className="tg-main flex min-w-0 flex-1 flex-col">
                <TopBar
                    currentFolderName={currentViewName}
                    selectedIds={[]}
                    onShowMoveModal={handleOpenBulkMove}
                    onBulkDownload={handleBulkDownload}
                    onBulkDelete={handleBulkDelete}
                    onBulkShare={handleBulkShare}
                    onDownloadFolder={handleDownloadFolder}
                    onClearSelection={clearSelection}
                    isConnected={isConnected} isSyncing={isSyncing} ownerId={accountId}
                    onSync={() => void handleManualSync()} onLogout={handleLogout}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onSettingsClick={() => setShowSettings(true)}
                    onRemoteUploadClick={() => setShowRemoteUpload(true)}
                    onShowShortcuts={() => setShowShortcuts(true)}
                    onShowHelp={() => setShowHelp(true)}
                />
                <div ref={scroll.ref} onScroll={scroll.onScroll} className="cloud-workspace" aria-label={currentViewName}>
                <div className="cloud-view-transition"><div className="cloud-content-heading"><h1>{currentViewName}</h1></div>
                {workspaceView === 'folders' && !activeSmartView && <div className="cloud-folder-section"><div className="cloud-folder-overview-toolbar cloud-view-controls"><button type="button" className="cloud-workspace-icon" aria-label={t('refine.importChannels')} title={t('refine.importChannels')} onClick={() => setShowImportChannels(true)}><FolderSymlink size={20} aria-hidden="true" /></button><button type="button" className="cloud-workspace-icon" aria-label={t('common.create_folder')} title={t('common.create_folder')} onClick={() => setCreateFolderRequest(value => value + 1)}><FolderPlus size={20} aria-hidden="true" /></button></div><div className="cloud-folder-cards">{[{ id: null, name: t('common.saved_messages') }, ...folders].map(folder => <FolderShortcut key={folderKey(folder.id)} name={folder.name} count={catalog.results.filter(file => (file.folder_id ?? null) === folder.id).length} onOpen={() => navigateFolder(folder.id)} onRename={folder.id === null || importedIds.includes(folder.id) ? undefined : () => setRenameFolder({ id: folder.id!, name: folder.name })} deleteLabel={folder.id !== null && importedIds.includes(folder.id) ? t('refine.removeFolder') : undefined} onDelete={folder.id === null ? undefined : () => importedIds.includes(folder.id!) ? void removeImport(folder.id!) : handleFolderDelete(folder.id!, folder.name)} />)}</div></div>}
                {workspaceView !== 'folders' && <><div className="cloud-workspace-toolbar">
                {workspaceView === 'photos' ? <div className="cloud-photo-filters"><div className="cloud-folder-pills"><button type="button" className="cloud-filter-pill" aria-pressed={photoFilter === 'all'} onClick={() => { setPhotoFilter('all'); setActiveFolderId(null); }}>{t('common.all')}</button>{photoOptions.map(folder => <button type="button" className="cloud-filter-pill" key={folderKey(folder.id)} aria-pressed={photoFilter === folderKey(folder.id)} onClick={() => { setPhotoFilter(folderKey(folder.id)); setActiveFolderId(folder.id); }}>{folder.name}</button>)}</div></div>
                : <div className="cloud-type-tabs" role="group" aria-label={t('workspace.file_type')}>{(['image', 'video', 'all', 'document', 'audio'] as const).map(type => <button type="button" className="cloud-filter-pill" key={type} aria-pressed={searchFilters.type === type} onClick={() => changeFilters({ ...searchFilters, type })}>{t(type === 'all' ? 'common.files' : type === 'image' ? 'tg.photos' : `workspace.types.${type}`)}</button>)}</div>}
                <div className="cloud-view-controls"><button type="button" className="cloud-workspace-icon" aria-label={t('tg.manageAllocated')} title={t('tg.manageAllocated')} onClick={() => setShowAllocated(true)}><FolderCog size={20} aria-hidden="true" /></button><WorkspaceControls viewMode={viewMode} cardScale={cardScale} onCardScaleChange={setCardScale} sortField={sortField} sortDirection={sortDirection} onSortChange={handleSortChange} searchFilters={searchFilters} onSearchFiltersChange={changeFilters} /><ViewToggle mode={viewMode} onChange={setViewMode} /></div>
                </div>
                {(searchTerm.trim().length > 0 || searchFilters.type !== 'all' || searchFilters.size !== 'any' || searchFilters.date !== 'any') && (
                    <div className="px-3 pb-0 pt-3">
                        <h2 className="text-ui font-medium text-app-text-secondary">
                            {displayedFiles.length.toLocaleString()} result{displayedFiles.length === 1 ? '' : 's'}{searchTerm.trim() ? <> for <span className="text-app-accent">"{searchTerm}"</span></> : null}
                        </h2>
                    </div>
                )}
                {insightSummary?.scope === fileLoadScope && !insightSummary.complete && <p role="status" className="px-3 text-xs text-app-text-secondary">{t('workspace.search_partial', { count: insightSummary.count })}</p>}
                {error && workspaceView === 'folder' && <p role="alert" className="cloud-error">{t('workspace.error_operation')}</p>}
                {folderSyncProgress.active && <p role="status" className="cloud-scan-status">{t('workspace.scan_progress', { count: folderSyncProgress.count })}</p>}
                {(searchError || ((workspaceView === 'cloud' || workspaceView === 'photos') && catalog.error)) && <p role="alert" className="px-3 text-xs text-app-danger">{t('workspace.error_operation')}</p>}
                {searchReply && <p role="status" className="px-3 text-xs text-app-text-secondary">{t(searchReply.complete ? 'workspace.search_complete' : 'workspace.search_partial', { count: searchReply.total })}{searchReply.offline ? ` · ${t('settings.offline')}` : ''}</p>}
                {(isSearching || (workspaceView === 'folder' && (isLoading || folderSyncProgress.active)) || ((workspaceView === 'cloud' || workspaceView === 'photos') && catalog.isSearching)) && !displayedFiles.length ? <div className="cloud-loading" role="status" aria-label={t('common.loading')}><Loader2 className="animate-spin" />{t('common.loading')}</div>
                : galleryMode ? <MediaGallery cacheKey={galleryKey} files={displayedFiles.filter(isGalleryFile)} ownerId={accountId} selectedKeys={selectedKeys} scale={cardScale} onOpen={handleFileClick} onSelect={handleToggleSelection} onDownload={file => void queueDownload(file.id, file.name, sourceFolder(file, activeFolderId), file.size)} onFavorite={file => void updateActivityFlag(file, 'favorite')} />
                : <CloudFileBrowser files={displayedFiles} folders={folders} ownerId={accountId} selectedKeys={selectedKeys} mode={viewMode} scale={cardScale} activeFolderId={activeFolderId} crossFolder={isCrossFolderView} sortField={sortField} sortDirection={sortDirection} onSort={handleSortChange} onOpen={handleFileClick} onSelect={handleToggleSelection} onDelete={handleDelete} onDownload={file => void queueDownload(file.id, file.name, sourceFolder(file, activeFolderId), file.size)} onPreview={handlePreview} onShare={setShareFile} onRename={handleRename} onMove={handleFileMove} onFavorite={file => void updateActivityFlag(file, 'favorite')} onPinned={file => void updateActivityFlag(file, 'pinned')} />}
                </>}</div></div>
                <BulkActionBar count={selectedFiles.length} busy={bulkBusy} onClear={clearSelection} onDownload={() => void handleBulkDownload()} onMove={handleOpenBulkMove} onDelete={() => void handleBulkDelete()} onFavorite={() => { const files = [...selectedFiles]; const current = captureMutationScope(); setBulkBusy(true); void (async () => { for (const file of files) { if (!current()) break; if (!file.is_favorite) await updateActivityFlag(file, 'favorite'); } if (current()) clearSelection(); })().finally(() => setBulkBusy(false)); }} />
            </section>


            {showImportChannels && accountId && <LazyFeatureBoundary><LazyImportChannelsDialog ownerId={accountId} mountedIds={folders.map(folder=>folder.id)} onClose={()=>setShowImportChannels(false)} onImported={async()=>{await refreshLocalFolders();await queryClient.invalidateQueries({queryKey:['imported-channels',accountId]});window.dispatchEvent(new CustomEvent('tg-drive-refresh-catalog'));}} /></LazyFeatureBoundary>}
            {showAllocated && <LazyFeatureBoundary><LazyAllocatedFoldersDialog ownerId={accountId} folders={folders} onClose={() => setShowAllocated(false)} /></LazyFeatureBoundary>}

            {workspaceKeys !== null && <LazyFeatureBoundary><LazyWorkspaceHub folders={folders} initialKeys={workspaceKeys} onClose={() => setWorkspaceKeys(null)} onOpen={(file, orderedFiles, localPath) => handlePreview(file, orderedFiles, localPath)} onFolder={id => { setWorkspaceKeys(null); setActiveSmartView(null); setActiveFolderId(id); }} /></LazyFeatureBoundary>}

            {previewFile && (
                <LazyFeatureBoundary key={`preview:${accountId}`}>
                    <LazyPreviewModal
                        file={previewFile}
                        actions={lightboxActions(previewFile)}
                        onDownload={() => queueDownload(previewFile.id, previewFile.name, sourceFolder(previewFile, activeFolderId), previewFile.size)}
                        activeFolderId={sourceFolder(previewFile, activeFolderId)}
                        localPath={localPreview?.key === previewFileKey(previewFile) ? localPreview.path : undefined}
                        onClose={() => setPreviewFile(null)}
                        onNext={handleNextPreview}
                        onPrev={handlePrevPreview}
                        currentIndex={previewContextIndex}
                        totalItems={previewContextFiles.length}
                        nextFile={previewNeighbors.nextFile}
                        prevFile={previewNeighbors.prevFile}
                    />
                </LazyFeatureBoundary>
            )}

            {archiveViewFile && (
                <LazyFeatureBoundary key={`archive:${previewFileKey(archiveViewFile)}`}>
                    <LazyArchiveViewerModal
                        file={archiveViewFile}
                        activeFolderId={sourceFolder(archiveViewFile, activeFolderId)}
                        folders={folders}
                        onClose={() => setArchiveViewFile(null)}
                        onNext={handleNextPreview}
                        onPrev={handlePrevPreview}
                        currentIndex={previewContextIndex}
                        totalItems={previewContextFiles.length}
                        nextFile={previewNeighbors.nextFile}
                        prevFile={previewNeighbors.prevFile}
                    />
                </LazyFeatureBoundary>
            )}


            <TransferCenter
                openRequest={transferCenterOpenRequest}
                uploads={uploadQueue}
                downloads={downloadQueue}
                onClearUploads={clearUploads}
                onCancelUploads={cancelUploads}
                onPauseUploads={pauseUploads}
                onResumeUploads={resumeUploads}
                onCancelUpload={cancelUploadItem}
                onRetryUpload={retryUploadItem}
                onClearDownloads={clearDownloads}
                onCancelDownloads={cancelDownloads}
                onPauseDownloads={pauseDownloads}
                onResumeDownloads={resumeDownloads}
                onCancelDownload={cancelDownloadItem}
                onRetryDownload={retryDownloadItem}
            />

            {settingsModuleRequested.current && (
                <LazyFeatureBoundary>
                    <LazySettingsModal
                        ownerId={accountId}
                        isOpen={showSettings}
                        onClose={() => setShowSettings(false)}
                        initialTab={settingsInitialTab}
                        folders={folders} onLogout={handleLogout}
                    />
                </LazyFeatureBoundary>
            )}

            {showShortcuts && <LazyFeatureBoundary><LazyKeyboardShortcutsDialog onClose={() => setShowShortcuts(false)} /></LazyFeatureBoundary>}

            {settingsLoaded && !settings.driveTourSeen && (
                <DriveConceptTour
                    onFinish={() => updateSetting('driveTourSeen', true)}
                    onOpenHelp={() => { updateSetting('driveTourSeen', true); setShowHelp(true); }}
                />
            )}

            {showHelp && <LazyFeatureBoundary><LazyHelpCenterDialog onClose={() => setShowHelp(false)} /></LazyFeatureBoundary>}

            {shareFile && shareOwnerId && (
                <LazyFeatureBoundary>
                    <LazyShareDialog
                        ownerId={shareOwnerId}
                        file={shareFile}
                        onClose={() => setShareFile(null)}
                        folders={folders}
                        activeFolderId={activeFolderId}
                        onOpenSettings={() => { setShareFile(null); setSettingsInitialTab('webdav'); setShowSettings(true); }}
                    />
                </LazyFeatureBoundary>
            )}

            {renameFolder && (
                <RenameFolderModal
                    folderId={renameFolder.id}
                    currentName={renameFolder.name}
                    onRename={handleFolderRename}
                    onClose={() => setRenameFolder(null)}
                />
            )}

            {renameFileTarget && (
                <RenameFileModal
                    fileName={renameFileTarget.name}
                    onRename={handleRenameSubmit}
                    onClose={() => setRenameRequest(current => current === renameRequest ? null : current)}
                />
            )}

            {/* Bulk Share Results Modal */}
            {bulkShareLinks && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setBulkShareLinks(null)}
                >
                    <div
                        className="bg-telegram-surface border border-telegram-border rounded-xl w-[500px] max-h-[70vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-telegram-border flex items-center justify-between">
                            <h3 className="text-telegram-text font-medium flex items-center gap-2">
                                <Link className="w-5 h-5 text-telegram-primary" />
                                {i18n.t('common.action_count', { action: i18n.t('files.share_link'), count: bulkShareLinks.length })}
                            </h3>
                            <button onClick={() => setBulkShareLinks(null)} className="text-telegram-subtext hover:text-telegram-text">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {bulkShareLoading ? (
                            <div className="flex flex-col items-center justify-center py-16 space-y-3">
                                <Loader2 className="w-8 h-8 text-telegram-primary animate-spin" />
                                <p className="text-sm text-telegram-subtext">{i18n.t('navigation_copy.generating_links')}</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                                {bulkShareLinks.map(({ file, link }) => {
                                    const isCopied = bulkShareCopied.has(link);
                                    return (
                                        <div
                                            key={file.id}
                                            className="p-3 rounded-lg bg-telegram-hover/30 border border-telegram-border/30 space-y-2"
                                        >
                                            <p className="text-xs font-semibold text-telegram-text truncate">{file.name}</p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={link}
                                                    className="flex-1 bg-telegram-bg border border-telegram-border rounded-lg px-2.5 py-1.5 text-xs text-telegram-text focus:outline-none select-all truncate"
                                                />
                                                <button
                                                    onClick={() => handleCopyBulkLink(link)}
                                                    className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-center transition-all flex-shrink-0 ${
                                                        isCopied
                                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                                            : 'bg-telegram-hover border-telegram-border text-telegram-text hover:bg-white/10'
                                                    }`}
                                                >
                                                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                                                    <button
                                                        onClick={() => handleNativeShareBulkLink(file, link)}
                                                        className="px-2.5 py-1.5 rounded-lg bg-telegram-primary/20 hover:bg-telegram-primary/30 text-telegram-primary border border-telegram-primary/30 transition-all flex items-center justify-center flex-shrink-0"
                                                    >
                                                        <Share2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <button
                            onClick={() => setBulkShareLinks(null)}
                            className="w-full px-4 py-2.5 border-t border-telegram-border bg-telegram-hover/20 hover:bg-telegram-hover/40 text-telegram-text text-sm font-medium transition-colors"
                        >
                            {i18n.t("settings.done")}
                        </button>
                    </div>
                </div>
            )}
                <DragOverlay dropAnimation={null}>
                    {internalDrag && internalDrag.ownerId === accountId && (
                        <div className="flex max-w-xs items-center gap-2 rounded-lg border border-app-accent/40 bg-app-surface px-3 py-2 text-sm font-medium text-app-text shadow-2xl">
                            <Files className="h-4 w-4 shrink-0 text-app-accent" />
                            <span className="truncate">{internalDrag.label}</span>
                            {internalDrag.fileIds.length > 1 && (
                                <span className="rounded-full bg-app-accent px-1.5 py-0.5 text-[10px] font-bold text-app-accent-contrast">
                                    {internalDrag.fileIds.length}
                                </span>
                            )}
                        </div>
                    )}
                </DragOverlay>
            </div>
        </DndContext>
    );
}
