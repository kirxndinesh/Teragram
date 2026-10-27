import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Check, Loader2, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useModalFocus } from '../../../hooks/useModalFocus';
import { userFacingError } from '../../../services/userFacingError';
interface Choice { id:number; title:string; username:string|null; members:number|null; kind:'channel'|'group' }
// Only visible rows request avatars; at most three downloads run concurrently.
let avatarWorkers=0;const avatarWaiters:Array<()=>void>=[];
async function avatar(ownerId:string,id:number):Promise<{avatar:string|null;members:number|null}|null>{
  if(avatarWorkers>=3)await new Promise<void>(resolve=>avatarWaiters.push(resolve));else avatarWorkers++;
  try{return await invoke<{avatar:string|null;members:number|null}|null>('cmd_get_channel_details',{ownerId,channelId:id});}
  finally{const next=avatarWaiters.shift();if(next)next();else avatarWorkers--;}
}
function ChannelIdentity({ownerId,channel}:{ownerId:string;channel:Choice}){
  const {t}=useTranslation();const ref=useRef<HTMLSpanElement>(null);const[details,setDetails]=useState<{avatar:string|null;members:number|null}|null>(null);
  useEffect(()=>{let current=true;const observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();void avatar(ownerId,channel.id).then(value=>{if(current)setDetails(value);}).catch(()=>{});});if(ref.current)observer.observe(ref.current);return()=>{current=false;observer.disconnect();};},[ownerId,channel.id]);
  const members=details?.members??channel.members;
  return <><span ref={ref} className="channel-import-avatar">{details?.avatar?<img src={details.avatar} alt=""/>:channel.title.trim().slice(0,2).toUpperCase()}</span><span className="channel-import-identity"><strong>{channel.title}</strong><small>{members===null?(channel.username?`@${channel.username}`:'—'):t(members===1?'refine.member':'refine.members',{count:members})}</small></span></>;
}
export function ImportChannelsDialog({ownerId,mountedIds,onClose,onImported}:{ownerId:string;mountedIds:number[];onClose:()=>void;onImported:()=>Promise<void>}){
  const{t}=useTranslation();const ref=useRef<HTMLDivElement>(null);useModalFocus(ref,onClose);
  const[choices,setChoices]=useState<Choice[]>([]);const[query,setQuery]=useState('');const[selected,setSelected]=useState<number[]>([]);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);const[error,setError]=useState<string|null>(null);const[retry,setRetry]=useState(0);const[limit,setLimit]=useState(100);const live=useRef(true);
  useEffect(()=>{live.current=true;let current=true;setLoading(true);setError(null);void invoke<Choice[]>('cmd_list_import_channels',{ownerId}).then(rows=>{if(current)setChoices(rows);}).catch(err=>{if(current)setError(userFacingError(err,t));}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;live.current=false;};},[ownerId,retry,t]);
  const matches=choices.filter(item=>!mountedIds.includes(item.id)&&`${item.title} ${item.username??''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const submit=async()=>{setBusy(true);setError(null);try{await invoke('cmd_import_channels',{ownerId,channelIds:selected});if(!live.current)return;await onImported();if(live.current)onClose();}catch(err){if(live.current)setError(userFacingError(err,t));}finally{if(live.current)setBusy(false);}};
  return <div className="cloud-modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><div ref={ref} role="dialog" aria-modal="true" aria-label={t('refine.importChannels')} className="cloud-modal folder-modal channel-import-dialog" tabIndex={-1}>
    <header><div><h2>{t('refine.importChannels')}</h2><p>{t('refine.importDescription')}</p></div><button type="button" className="folder-close" aria-label={t('common.close')} disabled={busy} onClick={onClose}><X size={20} aria-hidden="true"/></button></header>
    <label className="channel-import-search"><Search size={18} aria-hidden="true"/><input aria-label={t('refine.searchChannels')} placeholder={t('refine.searchChannels')} value={query} onChange={e=>{setQuery(e.target.value);setLimit(100);}}/></label>
    {error&&<div className="channel-import-error" role="alert">{error}<button type="button" onClick={()=>setRetry(v=>v+1)}>{t('common.retry')}</button></div>}
    <div className="channel-import-list" aria-busy={loading}>{loading?<p role="status"><Loader2 className="animate-spin"/>{t('common.loading')}</p>:matches.slice(0,limit).map(channel=><label key={channel.id} className="channel-import-row"><span className="channel-import-check"><input type="checkbox" aria-label={channel.title} disabled={busy||(!selected.includes(channel.id)&&selected.length>=100)} checked={selected.includes(channel.id)} onChange={()=>setSelected(current=>current.includes(channel.id)?current.filter(id=>id!==channel.id):[...current,channel.id])}/><Check size={14} strokeWidth={3} aria-hidden="true"/></span><ChannelIdentity ownerId={ownerId} channel={channel}/></label>)}
    {!loading&&!matches.length&&<p>{t('workspace.no_matches')}</p>}{matches.length>limit&&<button type="button" className="cloud-load-more" onClick={()=>setLimit(v=>v+100)}>{t('workspace.next')}</button>}</div>
    <footer><button type="button" className="folder-secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</button><button type="button" className="folder-primary" disabled={busy||!selected.length} onClick={()=>void submit()}>{busy?<Loader2 className="animate-spin" size={18}/>:t('refine.addToFolders')} {selected.length?`(${selected.length})`:''}</button></footer>
  </div></div>;
}
