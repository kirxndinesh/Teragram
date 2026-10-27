import { Check, LogOut, RefreshCw, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TelegramAvatar, useTelegramProfile, profileSubtitle } from './TelegramProfile';
import { SyncStatusBadge } from '../sync/SyncStatusBadge';

export function ConnectionMenu({ connected, syncing, ownerId, onSync, onSettings, onLogout, extraActions = [] }: { connected: boolean; syncing: boolean; ownerId: string | null; onSync: () => void; onSettings: () => void; onLogout: () => void; extraActions?: {label: string; icon: ReactNode; run: () => void}[] }) {
  const { t } = useTranslation();
  const profile = useTelegramProfile(ownerId);
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => { const outside = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false; }; document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside); }, []);
  const run = (action: () => void) => { if (ref.current) ref.current.open = false; action(); };
  return <details ref={ref} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) event.currentTarget.open = false; }} className="cloud-connection-menu" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
    <summary aria-label={t('tg.connectionMenu')} title={t('tg.connectionMenu')}><TelegramAvatar profile={profile}><span className={`cloud-connection-dot ${connected ? 'connected' : ''}`} /></TelegramAvatar></summary>
    <div className="cloud-connection-popover">
      <div className="cloud-account-summary"><TelegramAvatar profile={profile} /><div><strong>{profile?.fullName || t('tg.account')}</strong><small>{profileSubtitle(profile, ownerId)}</small></div></div>
      <div className="cloud-connection-state"><Check size={15} />{t(connected ? 'common.connected_telegram' : 'common.disconnected_telegram')}</div>
      <SyncStatusBadge />
      <button type="button" onClick={() => run(onSync)} disabled={syncing}><RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />{t(syncing ? 'common.syncing' : 'common.sync')}</button>
      <button type="button" onClick={() => run(onSettings)}><Settings size={16} />{t('common.settings')}</button>
      {extraActions.map(action => <button type="button" key={action.label} onClick={() => run(action.run)}>{action.icon}{action.label}</button>)}
      <button type="button" className="cloud-danger" onClick={() => run(onLogout)}><LogOut size={16} />{t('common.logout')}</button>
    </div>
  </details>;
}
