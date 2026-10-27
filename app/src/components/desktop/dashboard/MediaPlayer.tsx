import type { ReactNode } from 'react';
import { ImmersiveViewer, MediaControls, toggleMediaMute } from '../cloud/MediaChrome';
import { cloudFileType } from '../cloud/cloudFiles';
import {useTranslation} from 'react-i18next';
import { useEffect, useState, useRef, useCallback } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { TelegramFile } from '../../../types';
import { AdaptiveMediaPlayer } from './AdaptiveMediaPlayer';
import { shouldHandleMediaShortcut } from '../../../services/mediaKeyboard';
import { useDesktopPlayback } from '../../../hooks/useDesktopPlayback';
import i18n from '../../../i18n';

interface StreamInfo {
    token: string;
    base_url: string;
    operation_token?: string | null;
}

interface MediaPlayerProps {
    actions?: ReactNode;
    file: TelegramFile;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    currentIndex?: number;
    totalItems?: number;
    activeFolderId: number | null;
    ownerId?: string;
    restart?: boolean;
    onPlayFile?: (file: TelegramFile) => void;
    /** Path returned by the account-scoped offline file service. */
    localPath?: string;
}

function isMp4Video(name: string): boolean {
    return name.toLowerCase().endsWith('.mp4');
}

export function MediaPlayer({ file, actions, onClose, onNext, onPrev, currentIndex, totalItems, activeFolderId, ownerId, restart, onPlayFile, localPath }: MediaPlayerProps) {
    useTranslation();
    const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [nativeFailed, setNativeFailed] = useState(false);
    useEffect(() => setNativeFailed(false), [file.id, activeFolderId, localPath]);
    const sourceFolder = file.folder_id === undefined ? activeFolderId : file.folder_id;
    const playback = useDesktopPlayback(file, sourceFolder, ownerId, restart, onPlayFile);

    const toggleFullscreen = useCallback(async () => {
        try {
            const win = getCurrentWindow();
            const fs = await win.isFullscreen();
            await win.setFullscreen(!fs);
            setIsFullscreen(!fs);
        } catch {
            // Not running in Tauri — fall back to webview fullscreen
            const el = containerRef.current?.closest('.media-lightbox');
            if (!el) return;
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            } else {
                el.requestFullscreen().catch(() => {});
            }
        }
    }, []);

    // Sync isFullscreen when OS changes fullscreen (e.g. Escape / green button)
    useEffect(() => {
        let mounted = true;
        let unlistenFn: (() => void) | undefined;
        const attach = async () => {
            const dispose = await getCurrentWindow().onResized(async () => {
                if (!mounted) return;
                try {
                    const fs = await getCurrentWindow().isFullscreen();
                    if (mounted) setIsFullscreen(fs);
                } catch {}
            });
            if (mounted) unlistenFn = dispose;
            else dispose();
        };
        void attach().catch(() => {});
        return () => {
            mounted = false;
            unlistenFn?.();
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setStreamInfo(null);
        if (localPath) return;
        invoke<StreamInfo>('cmd_get_stream_info').then(info => {
            if (!cancelled) setStreamInfo(info);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [localPath]);

    const folderIdParam = sourceFolder !== null ? sourceFolder.toString() : 'home';
    const streamCredential = streamInfo?.operation_token
        ? `&credential=${encodeURIComponent(streamInfo.operation_token)}`
        : '';
    const streamUrl = localPath ? convertFileSrc(localPath) : streamInfo
        ? `${streamInfo.base_url}/stream/${folderIdParam}/${file.id}?token=${encodeURIComponent(streamInfo.token)}${streamCredential}`
        : null;

    const isVideo = cloudFileType(file) === 'video';
    const isAudio = cloudFileType(file) === 'audio';
    const isMp4 = isMp4Video(file.name) || file.file_ext?.toLowerCase() === 'mp4' || file.mime_type === 'video/mp4';
    const nativeWebKit = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent);
    const useAdaptive = !!streamUrl && !localPath && ((isMp4 && !nativeWebKit) || (isVideo && nativeFailed));

    useEffect(() => {
        // The adaptive child owns its own controls. Keeping this listener alive
        // while it is mounted toggles playback twice for a single keypress.
        if (useAdaptive) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!shouldHandleMediaShortcut(e)) return;

            const key = e.key.toLowerCase();

            if (e.key === 'ArrowRight' || key === 'l') {
                e.preventDefault();
                onNext?.();
                return;
            }

            if (e.key === 'ArrowLeft' || key === 'j') {
                e.preventDefault();
                onPrev?.();
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }

            if (key === 'f') {
                e.preventDefault();
                toggleFullscreen();
            }

            if (key === 'm') {
                e.preventDefault();
                const media = containerRef.current?.querySelector('video, audio') as HTMLMediaElement | null;
                if (media) {
                    toggleMediaMute(media);
                }
            }

            if (e.key === ' ') {
                e.preventDefault();
                const media = containerRef.current?.querySelector('video, audio') as HTMLMediaElement | null;
                if (media) {
                    media.paused ? media.play().catch(() => {}) : media.pause();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [useAdaptive, streamUrl, localPath, onClose, onNext, onPrev, toggleFullscreen]);

    // MP4 files: use adaptive streaming with quality controls + throttling
    if (useAdaptive) {
        return (
            <AdaptiveMediaPlayer
                file={file}
                actions={actions}
                streamUrl={streamUrl}
                activeFolderId={sourceFolder}
                onClose={onClose}
                onNext={onNext}
                onPrev={onPrev}
                currentIndex={currentIndex}
                totalItems={totalItems}
                playback={playback}
                ownerId={ownerId}
            />
        );
    }

    const getMedia = () => containerRef.current?.querySelector<HTMLMediaElement>('video, audio') ?? null;
    return <ImmersiveViewer isFullscreen={isFullscreen} onFullscreen={() => void toggleFullscreen()} name={file.name} actions={actions} containerRef={containerRef} onClose={onClose} onNext={onNext} onPrev={onPrev}
        onEscape={() => isFullscreen ? void toggleFullscreen() : onClose()} autoHide={isVideo}
        badge={typeof currentIndex === 'number' && totalItems ? `${currentIndex + 1}/${totalItems}` : undefined}
        controls={<MediaControls ownerId={ownerId} folderId={sourceFolder} sourceUrl={streamUrl ?? undefined} getMedia={getMedia} mediaKey={streamUrl ?? ''} isFullscreen={isFullscreen} onFullscreen={() => void toggleFullscreen()} />}>
        {!streamUrl ? <div className="media-loading" role="status">{i18n.t('viewer.preparing_stream')}</div>
        : isVideo ? <video ref={playback.attachMedia} onError={() => setNativeFailed(true)} src={streamUrl} autoPlay preload="auto" crossOrigin="anonymous" playsInline className="media-video" onClick={event => { const video = event.currentTarget; if (video.paused) void video.play().catch(() => {}); else video.pause(); }} />
        : isAudio ? <div className="media-audio-stage"><span aria-hidden="true">♫</span><audio ref={playback.attachMedia} src={streamUrl} autoPlay /></div>
        : <p className="media-loading">{i18n.t('viewer.unsupported_media')}</p>}
    </ImmersiveViewer>;
}
