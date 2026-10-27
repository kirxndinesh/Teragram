import type { MovieControlContext } from './MovieControls';
import { cloneElement, isValidElement, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, PictureInPicture2, Play, RotateCcw, RotateCw, Volume2, VolumeX, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useModalFocus } from '../../../hooks/useModalFocus';

interface ImmersiveViewerProps {
  name: string; imageAspect?: number; actions?: ReactNode; badge?: ReactNode; details?: ReactNode; children: ReactNode; controls?: ReactNode;
  onClose: () => void; onNext?: () => void; onPrev?: () => void; onEscape?: () => void;
  isFullscreen?: boolean; onFullscreen?: () => void;
  containerRef?: RefObject<HTMLDivElement | null>; autoHide?: boolean; closeLabel?: string;
}
/** One chrome layer for native, MSE, HLS and image stages. Media events bubble from the active element. */
export function ImmersiveViewer({ name, imageAspect, actions, badge, details, children, controls, onClose, onNext, onPrev, onEscape, containerRef, autoHide = false, closeLabel, isFullscreen = false, onFullscreen }: ImmersiveViewerProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [domFullscreen, setDomFullscreen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const full = isFullscreen || expanded || domFullscreen;
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => { const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight }); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  const imageStyle = !full && imageAspect ? { width: Math.min(viewport.width * .88, 1140), height: Math.min(viewport.height * .84, 800) } : undefined;
  const toggleFullscreen = async () => {
    if (onFullscreen) { onFullscreen(); return; }
    if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); setExpanded(false); return; }
    if (expanded) { await getCurrentWindow().setFullscreen(false).catch(() => {}); setExpanded(false); return; }
    try { await dialogRef.current?.requestFullscreen(); }
    catch { await getCurrentWindow().setFullscreen(true).catch(() => {}); setExpanded(true); }
  };
  const close = useCallback(() => {
    if (closeTimer.current !== undefined) return;
    setClosing(true);
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    closeTimer.current = setTimeout(() => {
      if (document.fullscreenElement === dialogRef.current) void document.exitFullscreen().catch(() => {});
      else if (isFullscreen && onFullscreen) onFullscreen();
      else if (expanded) void getCurrentWindow().setFullscreen(false).catch(() => {});
      onClose();
    }, delay);
  }, [onClose, isFullscreen, onFullscreen, expanded]);
  useModalFocus(dialogRef, () => {
    if (document.fullscreenElement === dialogRef.current) { void document.exitFullscreen(); return; }
    if (full) { if (onEscape) onEscape(); else void toggleFullscreen(); } else close();
  });
  useEffect(() => {
    const changed = () => setDomFullscreen(document.fullscreenElement === dialogRef.current);
    document.addEventListener('fullscreenchange', changed);
    return () => { document.removeEventListener('fullscreenchange', changed); clearTimeout(closeTimer.current); };
  }, []);
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const playing = useRef(false);
  const keyboard = useRef(false);
  const arm = useCallback(() => {
    clearTimeout(timer.current);
    if (!autoHide || !playing.current) return;
    timer.current = setTimeout(() => {
      const active = document.activeElement;
      // Editing, open info/quality menus, and keyboard operation keep controls available.
      if (keyboard.current || dialogRef.current?.querySelector('[aria-expanded="true"], details[open]') || (active instanceof Element && active.matches('input:not([type="range"]), textarea'))) return;
      setVisible(false);
    }, 2500);
  }, [autoHide]);
  const wake = useCallback(() => { setVisible(true); arm(); }, [arm]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const actionNode = isValidElement(actions) ? cloneElement(actions as ReactElement<{ details?: ReactNode }>, { details }) : actions;
  return <div className={`media-preview-backdrop ${closing ? 'is-closing' : ''} ${full ? 'is-fullscreen' : ''}`} onClick={event => { if (event.target === event.currentTarget) close(); }}>
  <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={name} tabIndex={-1} style={imageStyle} className={`viewer-overlay media-lightbox ${imageAspect ? 'is-image-preview' : ''} ${visible ? '' : 'hud-hidden'} ${full ? 'is-fullscreen' : ''} ${closing ? 'is-closing' : ''}`}
    onPointerMove={() => { keyboard.current = false; wake(); }} onPointerDown={wake}
    onKeyDownCapture={event => { keyboard.current = true; wake(); if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !(event.target as Element).closest('input, textarea, select')) { event.preventDefault(); event.stopPropagation(); void toggleFullscreen(); } }} onFocusCapture={wake}
    onPlayingCapture={() => { if (!playing.current) { playing.current = true; wake(); } }} onPauseCapture={() => { playing.current = false; clearTimeout(timer.current); setVisible(true); }} onEndedCapture={() => { playing.current = false; setVisible(true); }}>
    <div ref={containerRef} className="media-immersive-stage" key={imageAspect ? 'image-stage' : name}>{children}</div>
    <header className="media-hud-top">
      <div className="media-hud-title"><button type="button" className="media-icon" aria-label={t('workspace.back')} title={t('workspace.back')} onClick={close}><ArrowLeft size={22} /></button><h2 title={name}>{name}</h2>{badge && <span className="media-resolution">{badge}</span>}</div>
      <div className="media-hud-actions">{actionNode}{!autoHide && <button type="button" className="media-icon" aria-label={t(full ? 'workspace.exit_fullscreen' : 'viewer.enter_fullscreen')} onClick={() => void toggleFullscreen()}>{full ? <Minimize2 size={21} /> : <Maximize2 size={21} />}</button>}<button type="button" className="media-icon" aria-label={closeLabel ?? t('viewer.close_player')} title={t('common.close')} onClick={close}><X size={22} /></button></div>
    </header>
    {onPrev && <button type="button" className="media-navigation media-navigation-prev" aria-label={t('viewer.previous_file')} onClick={onPrev}><ChevronLeft size={25} /></button>}
    {onNext && <button type="button" className="media-navigation media-navigation-next" aria-label={t('viewer.next_file')} onClick={onNext}><ChevronRight size={25} /></button>}
    {controls}
  </div></div>;
}

const previousVolume = new WeakMap<HTMLMediaElement, number>();
export function toggleMediaMute(media: HTMLMediaElement) {
  if (media.muted || media.volume === 0) { media.muted = false; if (!media.volume) media.volume = previousVolume.get(media) ?? 1; }
  else { previousVolume.set(media, media.volume); media.muted = true; }
}
export function mediaTime(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hour = Math.floor(total / 3600); const minute = Math.floor(total / 60) % 60; const second = total % 60;
  return `${hour ? hour + ':' + String(minute).padStart(2, '0') : Math.floor(total / 60)}:${String(second).padStart(2, '0')}`;
}

type PiPVideo = HTMLVideoElement & { webkitSetPresentationMode?: (mode: string) => void; webkitPresentationMode?: string; webkitSupportsPresentationMode?: (mode: string) => boolean };
const AdvancedMovieControls = lazy(() => import('./MovieControls'));
interface ControlsProps extends MovieControlContext { getMedia: () => HTMLMediaElement | null; mediaKey: string; isFullscreen: boolean; onFullscreen: () => void; durationHint?: number }
export function MediaControls({ getMedia, mediaKey, isFullscreen, onFullscreen, durationHint = 0, ...movieContext }: ControlsProps) {
  const { t } = useTranslation();
  const [state, setState] = useState({ current: 0, duration: 0, paused: true, volume: 1, muted: false, rate: 1, pip: false, canPip: false });
  const [hover, setHover] = useState<{ time: number; left: number } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const media = getMedia();
    if (!media) return;
    media.preload = 'auto';
    if (media.dataset.onegramAutoplay !== mediaKey) { media.dataset.onegramAutoplay = mediaKey; void media.play().catch(() => {}); }
    const sync = () => {
      const video = media as PiPVideo;
      if (media.volume > 0) previousVolume.set(media, media.volume);
      const available = media.seekable.length ? media.seekable.end(media.seekable.length - 1) : media.buffered.length ? media.buffered.end(media.buffered.length - 1) : 0;
      const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : Math.max(durationHint, available);
      setState({ current: media.currentTime || 0, duration, paused: media.paused, volume: media.volume, muted: media.muted, rate: media.playbackRate,
        pip: document.pictureInPictureElement === media || video.webkitPresentationMode === 'picture-in-picture',
        canPip: media instanceof HTMLVideoElement && media.readyState >= 2 && (!!document.pictureInPictureEnabled || !!video.webkitSupportsPresentationMode?.('picture-in-picture')) });
    };
    const events = ['timeupdate', 'progress', 'canplay', 'durationchange', 'loadedmetadata', 'loadeddata', 'play', 'playing', 'pause', 'ended', 'volumechange', 'ratechange', 'enterpictureinpicture', 'leavepictureinpicture'];
    events.forEach(event => media.addEventListener(event, sync)); sync();
    return () => events.forEach(event => media.removeEventListener(event, sync));
  }, [getMedia, mediaKey, durationHint]);
  const act = (operation: (media: HTMLMediaElement) => void | Promise<unknown>) => {
    const media = getMedia(); if (!media) return;
    try { void Promise.resolve(operation(media)).catch(() => setFailed(true)); } catch { setFailed(true); }
  };
  const seek = (time: number) => act(media => { if (state.duration > 0) media.currentTime = Math.max(0, Math.min(state.duration, time)); });
  const pictureInPicture = () => act(async media => {
    const video = media as PiPVideo;
    if (video.webkitSetPresentationMode) { video.webkitSetPresentationMode(video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture'); return; }
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else if (media instanceof HTMLVideoElement) await media.requestPictureInPicture();
  });
  const progress = state.duration ? Math.min(100, state.current / state.duration * 100) : 0;
  return <div className="media-hud-bottom">
    <div className="media-timeline" onPointerLeave={() => setHover(null)}>
      {hover && <output className="media-time-preview" style={{ left: `${hover.left}%` }}>{mediaTime(hover.time)}</output>}
      <input type="range" min={0} max={state.duration || 1} step={0.1} value={Math.min(state.current, state.duration || 1)} disabled={!state.duration} aria-label={t('tg.seekTimeline')} aria-valuetext={`${mediaTime(state.current)} / ${mediaTime(state.duration)}`} style={{ '--media-progress': `${progress}%` } as React.CSSProperties}
        onChange={event => seek(Number(event.target.value))} onPointerMove={event => { const bounds = event.currentTarget.getBoundingClientRect(); const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)); setHover({ time: fraction * state.duration, left: Math.max(3, Math.min(97, fraction * 100)) }); }} />
    </div>
    <div className="media-control-row">
      <div className="media-control-left">
        <button type="button" className="media-icon" aria-label={t(state.paused ? 'common.play' : 'workspace.pause')} title={t('viewer.play_pause_shortcut')} onClick={() => act(media => media.paused ? media.play() : media.pause())}>{state.paused ? <Play size={22} fill="currentColor" /> : <Pause size={22} fill="currentColor" />}</button>
        <button type="button" className="media-icon" aria-label={t('playback.skip_back')} title={t('playback.skip_back')} onClick={() => seek(state.current - 10)}><RotateCcw size={21} /><span className="media-skip-number">10</span></button>
        <button type="button" className="media-icon" aria-label={t('playback.skip_forward')} title={t('playback.skip_forward')} onClick={() => seek(state.current + 10)}><RotateCw size={21} /><span className="media-skip-number">10</span></button>
        <div className="media-volume"><button type="button" className="media-icon" aria-label={t(state.muted || state.volume === 0 ? 'viewer.unmute' : 'viewer.mute')} onClick={() => act(toggleMediaMute)}>{state.muted || !state.volume ? <VolumeX size={21} /> : <Volume2 size={21} />}</button><input aria-label={t('playback.volume_label')} type="range" min={0} max={1} step={0.05} value={state.muted ? 0 : state.volume} onChange={event => act(media => { media.volume = Number(event.target.value); media.muted = media.volume === 0; })} /></div>
        <span className="media-clock">{mediaTime(state.current)} / {mediaTime(state.duration)}</span>
      </div>
      <div className="media-control-right"><Suspense fallback={null}><AdvancedMovieControls getMedia={getMedia} mediaKey={mediaKey} {...movieContext} /></Suspense><select aria-label={t('playback.speed_label')} value={state.rate} onChange={event => act(media => { media.playbackRate = Number(event.target.value); })}>{[.25, .5, .75, 1, 1.25, 1.5, 1.75, 2].map(rate => <option value={rate} key={rate}>{rate}×</option>)}</select>
        <button type="button" className="media-icon" aria-label={t('tg.pictureInPicture')} title={t('tg.pictureInPicture')} aria-pressed={state.pip} disabled={!state.canPip} onClick={pictureInPicture}><PictureInPicture2 size={21} /></button>
        <button type="button" className="media-icon" aria-label={t(isFullscreen ? 'workspace.exit_fullscreen' : 'viewer.enter_fullscreen')} title={t('workspace.fullscreen')} onClick={onFullscreen}>{isFullscreen ? <Minimize2 size={21} /> : <Maximize2 size={21} />}</button>
      </div>
    </div>
    {failed && <p className="media-control-error" role="status">{t('viewer.playback_error')}</p>}
  </div>;
}
