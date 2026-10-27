import { mediaTrackLabel } from '../../../services/mediaTrackLabel';
import { Captions, Headphones, Settings2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import type { TelegramFile } from '../../../types';
import { searchLocal } from '../../../services/localSearch';
import { subtitleWebVtt } from '../../../services/movieSubtitles';
import { folderKey } from './cloudFiles';

interface AudioTrack { id: string; label: string; language: string; enabled: boolean }
interface AudioTracks extends EventTarget { length: number; [index: number]: AudioTrack }
type TrackedMedia = HTMLMediaElement & { audioTracks?: AudioTracks };
export interface MovieControlContext {
  sourceUrl?: string; ownerId?: string; folderId?: number | null;
  audioOptions?: { id: string; label: string }[]; selectedAudio?: string; onAudioSelect?: (id: string) => void;
}
interface Props extends MovieControlContext { getMedia: () => HTMLMediaElement | null; mediaKey: string }
interface CueOrigin { start: number; end: number; line: number | 'auto'; snap: boolean }
interface AudioGraph { media: HTMLMediaElement; context: AudioContext; delay: DelayNode; gain: GainNode; ahead?: HTMLAudioElement; cleanup?: () => void }
const Stepper=({label,value,step,min,max,onChange}:{label:string;value:number;step:number;min:number;max:number;onChange:(v:number)=>void})=><div className="movie-setting"><span>{label}</span><div className="movie-stepper"><button type="button" aria-label={`${label} −${step}s`} disabled={value<=min} onClick={()=>onChange(Math.max(min,Math.round((value-step)*1000)/1000))}>−</button><output>{value.toFixed(2)}s</output><button type="button" aria-label={`${label} +${step}s`} disabled={value>=max} onClick={()=>onChange(Math.min(max,Math.round((value+step)*1000)/1000))}>+</button></div></div>;
export default function MovieControls({ getMedia, mediaKey, sourceUrl, ownerId, folderId = null, audioOptions, selectedAudio, onAudioSelect }: Props) {
  const { t } = useTranslation(); const id = useId();
  const [textTracks, setTextTracks] = useState<TextTrack[]>([]); const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedText, setSelectedText] = useState(-1); const [audioId, setAudioId] = useState('');
  const [subtitleDelay, setSubtitleDelay] = useState(0); const [audioDelay, setAudioDelay] = useState(0);
  const [font, setFont] = useState(1); const [background, setBackground] = useState(.75); const [position, setPosition] = useState(0); const [fit, setFit] = useState('contain');
  const [sidecars, setSidecars] = useState<TelegramFile[]>([]); const [error, setError] = useState(false); const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null); const root = useRef<HTMLDivElement>(null); const sources = useRef<{ track: HTMLTrackElement; url: string }[]>([]);
  const lifetime = useRef(0);
  useEffect(() => { lifetime.current++; setSidecars([]); return () => { lifetime.current++; }; }, [mediaKey, ownerId]);
  const cueOrigins = useRef(new WeakMap<TextTrackCue, CueOrigin>()); const graph = useRef<AudioGraph | null>(null);
  const syncTracks = () => {
    const media = getMedia() as TrackedMedia | null; if (!media) return;
    const captions=Array.from(media.textTracks).filter(track => ['subtitles','captions'].includes(track.kind)); setTextTracks(captions); setSelectedText(captions.findIndex(track=>track.mode==='showing'));
    const tracks = media.audioTracks ? Array.from({ length: media.audioTracks.length }, (_, i) => media.audioTracks![i]) : [];
    setAudioTracks(tracks); setAudioId(String(Math.max(0,tracks.findIndex(track => track.enabled))));
  };
  useEffect(() => {
    const media = getMedia() as TrackedMedia | null; if (!media) return;
    syncTracks();
    const events = ['loadedmetadata','loadeddata','emptied']; events.forEach(event => media.addEventListener(event, syncTracks));
    media.textTracks.addEventListener('addtrack', syncTracks); media.textTracks.addEventListener('removetrack', syncTracks);
    media.audioTracks?.addEventListener('addtrack', syncTracks); media.audioTracks?.addEventListener('change', syncTracks);
    return () => { events.forEach(event => media.removeEventListener(event, syncTracks)); media.textTracks.removeEventListener('addtrack', syncTracks); media.textTracks.removeEventListener('removetrack', syncTracks); media.audioTracks?.removeEventListener('addtrack', syncTracks); media.audioTracks?.removeEventListener('change', syncTracks); };
  }, [getMedia, mediaKey]);
  useEffect(() => { const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) root.current?.querySelectorAll('details').forEach(menu => menu.open = false); }; document.addEventListener('pointerdown',outside); return () => document.removeEventListener('pointerdown',outside); }, []);
  useEffect(() => () => { sources.current.forEach(source => { source.track.remove(); URL.revokeObjectURL(source.url); }); sources.current = []; graph.current?.cleanup?.(); graph.current?.ahead?.pause(); if(graph.current) { graph.current.delay.delayTime.value=0; graph.current.gain.gain.value=1; } }, [mediaKey]);
  useEffect(() => () => { graph.current?.cleanup?.(); void graph.current?.context.close().catch(() => {}); }, []);
  useEffect(() => {
    const media = getMedia(); if (!media) return;
    media.dataset.onegramCaptions = id;
    const style = document.createElement('style');
    style.textContent = `video[data-onegram-captions="${id}"]::cue { font-size: ${Math.round(font * 100)}%; background-color: rgba(0,0,0,${background}); color: #ededed; }`;
    document.head.appendChild(style);
    for (const track of textTracks) for (const item of Array.from(track.cues ?? [])) {
      const cue = item as VTTCue; let original = cueOrigins.current.get(cue);
      if (!original) { original = { start: cue.startTime, end: cue.endTime, line: cue.line, snap: cue.snapToLines }; cueOrigins.current.set(cue, original); }
      cue.startTime = Math.max(0, original.start + subtitleDelay); cue.endTime = Math.max(cue.startTime + .01, original.end + subtitleDelay);
      cue.snapToLines = position === 0 ? original.snap : false; cue.line = position === 0 ? original.line : 90 - position;
    }
    return () => style.remove();
  }, [getMedia, mediaKey, textTracks, subtitleDelay, font, background, position, id]);
  useEffect(() => {
    const media = getMedia(); if (!media || !(media instanceof HTMLVideoElement)) return;
    const apply = () => {
      if (fit === '16:9' || fit === '4:3') { const ratio = fit === '16:9' ? 16 / 9 : 4 / 3; const bounds = media.parentElement!.getBoundingClientRect(); const width = Math.min(bounds.width,bounds.height * ratio); Object.assign(media.style,{width:`${width}px`,height:`${width / ratio}px`,objectFit:'fill',position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)'}); }
      else Object.assign(media.style,{width:'100%',height:'100%',objectFit:fit,position:'',left:'',top:'',transform:''});
    }; const observer = new ResizeObserver(apply); observer.observe(media.parentElement!); apply(); return () => { observer.disconnect(); Object.assign(media.style,{width:'',height:'',objectFit:'',position:'',left:'',top:'',transform:''}); };
  }, [getMedia,mediaKey,fit]);
  const selectText = (index: number) => { textTracks.forEach((track,i) => track.mode = i === index ? 'showing' : 'disabled'); setSelectedText(index); };
  const attachSubtitle = (value: string, name: string) => {
    const media = getMedia(); if (!media) return;
    const content = subtitleWebVtt(value,name); const url = URL.createObjectURL(new Blob([content],{type:'text/vtt'}));
    const track = document.createElement('track'); track.kind='subtitles'; track.label=name; track.src=url; track.default=true;
    track.addEventListener('load',() => { for (const item of Array.from(media.textTracks)) item.mode = item === track.track ? 'showing' : 'disabled'; syncTracks(); setSelectedText(Array.from(media.textTracks).filter(item=>['subtitles','captions'].includes(item.kind)).indexOf(track.track)); });
    track.addEventListener('error',() => setError(true)); media.appendChild(track); track.track.mode='showing'; sources.current.push({track,url}); setError(false);
  };
  const loadLocal = async (file?: File) => { if (!file) return; const ticket=lifetime.current; setLoading(true); try { if (file.size > 2 * 1024 * 1024) throw new Error(); const text=await file.text(); if(ticket===lifetime.current) attachSubtitle(text,file.name); } catch { if(ticket===lifetime.current) setError(true); } finally { if(ticket===lifetime.current) { setLoading(false); if(fileInput.current) fileInput.current.value=''; } } };
  const loadFolder = async () => { if (!ownerId || sidecars.length) return; const ticket = lifetime.current; const current = () => lifetime.current === ticket; try { const result = await searchLocal(ownerId,{query:'',scope:'all',folderKey:folderKey(folderId)},current); if(current()) setSidecars(result.files.filter(file => /\.(srt|vtt|ass)$/i.test(file.name)).slice(0,200)); } catch { /* Local imports remain available while the folder index is unavailable. */ } };
  const loadSidecar = async (file: TelegramFile) => { const ticket=lifetime.current; setLoading(true); try { if(file.size > 2 * 1024 * 1024) throw new Error(); const text=await invoke<string>('cmd_read_text_preview',{messageId:file.id,folderId:file.folder_id ?? null}); if(ticket===lifetime.current) attachSubtitle(text,file.name); } catch { if(ticket===lifetime.current) setError(true); } finally { if(ticket===lifetime.current) setLoading(false); } };
  const chooseAudio = (value: string) => { if(onAudioSelect && audioOptions?.length) onAudioSelect(value); else audioTracks.forEach((track,index) => track.enabled = index === Number(value)); if(graph.current?.ahead) { const tracks=(graph.current.ahead as TrackedMedia).audioTracks; if(tracks) for(let i=0;i<tracks.length;i++) tracks[i].enabled=i===Number(value); } setAudioId(value); };
  const changeAudioDelay = async (value: number) => {
    const media = getMedia(); if(!media) return;
    const next=Math.round(Math.min(5,Math.max(-5,value))*1000)/1000;
    try {
      if(!graph.current || graph.current.media!==media) { graph.current?.cleanup?.(); if(graph.current) void graph.current.context.close().catch(()=>{}); const context=new AudioContext(); const input=context.createMediaElementSource(media); const delay=context.createDelay(5); const gain=context.createGain(); input.connect(delay).connect(gain).connect(context.destination); graph.current={media,context,delay,gain}; }
      const current=graph.current; await current.context.resume(); current.cleanup?.(); current.ahead?.pause(); current.ahead?.removeAttribute('src'); current.delay.delayTime.value=Math.max(0,next); current.gain.gain.value=next<0?0:1;
      if(next<0) {
        const url=media.currentSrc.startsWith('blob:') ? sourceUrl : media.currentSrc; if(!url || url.startsWith('blob:')) throw new Error();
        const ahead=new Audio(); ahead.crossOrigin='anonymous'; ahead.preload='auto'; ahead.src=url; current.ahead=ahead;
        const sync=() => { const target=Math.max(0,media.currentTime-next); if(Number.isFinite(ahead.duration) && target>=ahead.duration-.01) { ahead.pause(); return; } if(ahead.readyState && Math.abs(ahead.currentTime-target)>.15) ahead.currentTime=Number.isFinite(ahead.duration)?Math.min(target,Math.max(0,ahead.duration-.01)):target; ahead.playbackRate=media.playbackRate; ahead.volume=media.volume; ahead.muted=media.muted; if(media.paused) ahead.pause(); else void ahead.play().catch(()=>setError(true)); };
        const events=['play','pause','seeking','seeked','ratechange','volumechange']; events.forEach(event=>media.addEventListener(event,sync)); ahead.addEventListener('loadedmetadata',sync); const timer=window.setInterval(sync,500); current.cleanup=()=>{events.forEach(event=>media.removeEventListener(event,sync)); ahead.removeEventListener('loadedmetadata',sync); clearInterval(timer); ahead.pause(); ahead.removeAttribute('src'); ahead.load();}; sync();
      } else current.cleanup=undefined;
      setAudioDelay(next); setError(false);
    } catch { if(graph.current) { graph.current.delay.delayTime.value=0; graph.current.gain.gain.value=1; } setAudioDelay(0); setError(true); }
  };
  return <div ref={root} className="movie-control-suite" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();root.current?.querySelectorAll('details').forEach(menu=>menu.open=false);}}}>
    <input ref={fileInput} className="sr-only" type="file" accept=".srt,.vtt,.ass" aria-label={t('movie.loadSubtitles')} onChange={event=>void loadLocal(event.target.files?.[0])} />
    <details onToggle={event=>{if(event.currentTarget.open) void loadFolder();}}><summary className="media-icon" aria-label={t('movie.subtitles')} title={t('movie.subtitles')}><Captions size={21}/></summary><div className="movie-menu"><label>{t('movie.subtitles')}<select aria-label={t('movie.subtitles')} value={selectedText} onChange={event=>selectText(Number(event.target.value))}><option value={-1}>{t('playback.off')}</option>{textTracks.map((track,index)=><option value={index} key={index}>{track.label || track.language || `#${index+1}`}</option>)}</select></label><button type="button" disabled={loading} onClick={()=>fileInput.current?.click()}>{t('movie.loadSubtitles')}</button>{sidecars.map(file=><button type="button" disabled={loading} key={`${file.folder_id}:${file.id}`} onClick={()=>void loadSidecar(file)}>{file.name}</button>)}</div></details>
    <details><summary className="media-icon" aria-label={t('workspace.types.audio')} title={t('workspace.types.audio')}><Headphones size={21}/></summary><div className="movie-menu"><label>{t('workspace.types.audio')}<select aria-label={t('workspace.types.audio')} value={audioOptions?.length ? selectedAudio : audioId} disabled={!audioOptions?.length && audioTracks.length<2} onChange={event=>chooseAudio(event.target.value)}>{audioOptions?.length ? audioOptions.map(track=><option key={track.id} value={track.id}>{track.label}</option>) : audioTracks.length ? audioTracks.map((track,index)=><option key={index} value={index}>{mediaTrackLabel(track.language,track.label,index)}</option>) : <option value="">#1</option>}</select></label>{!audioOptions?.length && audioTracks.length<2 && <small>{t('movie.noTracks')}</small>}</div></details>
    <details><summary className="media-icon" aria-label={t('common.settings')} title={t('common.settings')}><Settings2 size={21}/></summary><div className="movie-menu movie-settings">
      <Stepper label={t('movie.audioTiming')} value={audioDelay} step={.05} min={-5} max={5} onChange={value=>void changeAudioDelay(value)}/>
      <Stepper label={t('movie.subtitleTiming')} value={subtitleDelay} step={.1} min={-10} max={10} onChange={setSubtitleDelay}/>
      <label>{t('movie.subtitleSize')}<select aria-label={t('movie.subtitleSize')} value={font} onChange={event=>setFont(Number(event.target.value))}>{[.75,1,1.25,1.5].map(value=><option key={value} value={value}>{value*100}%</option>)}</select></label>
      <label>{t('movie.subtitleBackground')}<select aria-label={t('movie.subtitleBackground')} value={background} onChange={event=>setBackground(Number(event.target.value))}>{[0,.5,.75,1].map(value=><option key={value} value={value}>{value*100}%</option>)}</select></label>
      <label>{t('movie.subtitlePosition')}<input type="range" aria-label={t('movie.subtitlePosition')} min={0} max={30} step={1} value={position} onChange={event=>setPosition(Number(event.target.value))}/></label>
      <label>{t('movie.fitMode')}<select aria-label={t('movie.fitMode')} value={fit} onChange={event=>setFit(event.target.value)}><option value="contain">{t('movie.fit')}</option><option value="cover">{t('movie.fill')}</option><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="fill">{t('movie.stretch')}</option></select></label>
      <button type="button" onClick={()=>{setSubtitleDelay(0);void changeAudioDelay(0);setFont(1);setBackground(.75);setPosition(0);setFit('contain');}}>{t('settings.reset_defaults')}</button>
    </div></details>{error && <span role="status" className="movie-error">{t('movie.invalidSubtitles')}</span>}
  </div>;
}
