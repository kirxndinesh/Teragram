import { useEffect, useState } from 'react';
import { FolderOpen, LogOut } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { load } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { TelegramAvatar, useTelegramProfile, profileSubtitle } from './TelegramProfile';
import { useSettings } from '../../../context/SettingsContext';

export function GeneralWorkspacePreferences() {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const [error, setError] = useState(false);
  const chooseDirectory = async () => {
    try { const path = await open({ directory: true, multiple: false, title: t('tg.downloadDirectory') }); if (typeof path === 'string') updateSetting('downloadDirectory', path); }
    catch { setError(true); }
  };
  return <section className="settings-group cloud-workspace-preferences">
    <h3>{t('tg.appearanceStartup')}</h3>
    <label>{t('tg.startupView')}<select aria-label={t('tg.startupView')} value={settings.startupView} onChange={event => updateSetting('startupView', event.target.value as 'cloud' | 'photos' | 'recents')}><option value="cloud">{t('tg.cloud')}</option><option value="photos">{t('tg.photos')}</option><option value="recents">{t('common.recents')}</option></select></label>
    <label>{t('ui_copy.thumbnail_size')}<span><input aria-label={t('ui_copy.thumbnail_size')} type="range" style={{ '--range-progress': `${(settings.thumbnailScale - .5) / 1.5 * 100}%` } as React.CSSProperties} min="0.5" max="2" step="0.25" value={settings.thumbnailScale} onChange={event => updateSetting('thumbnailScale', Number(event.target.value))} /><output>{Math.round(settings.thumbnailScale * 100)}%</output></span></label>
    <label>{t('tg.downloadDirectory')}<button type="button" aria-label={t('tg.downloadDirectory')} onClick={() => void chooseDirectory()}><FolderOpen size={17} /><span>{settings.downloadDirectory || t('common.download_destination')}</span></button></label>
    {settings.downloadDirectory && <button type="button" onClick={() => updateSetting('downloadDirectory', '')}>{t('workspace.clear_selection')}</button>}
    {error && <p role="alert">{t('common.operation_failed')}</p>}
  </section>;
}

export function AccountPreferences({ ownerId, onLogout }: { ownerId: string | null; onLogout?: () => void }) {
  const { t } = useTranslation();
  const profile = useTelegramProfile(ownerId);
  const [state, setState] = useState<{ apiId?: string; hash?: boolean; failed?: boolean }>({});
  useEffect(() => {
    let cancelled = false;
    setState({});
    void Promise.all([load('config.json').then(store => store.get<string>('api_id')), invoke<boolean>('cmd_has_api_hash')]).then(([apiId, hash]) => { if (!cancelled) setState({ apiId: apiId ?? undefined, hash }); }).catch(() => { if (!cancelled) setState({ failed: true }); });
    return () => { cancelled = true; };
  }, [ownerId]);
  return <section className="cloud-account-settings"><div className="cloud-account-badge"><TelegramAvatar profile={profile} /><div><h3>{profile?.fullName || t('tg.account')}</h3><p>{profileSubtitle(profile, ownerId)}</p></div></div><dl>
    <dt>{t('tg.account')}</dt><dd>{ownerId ? ownerId : '—'}</dd>
    <dt>{t('auth.api_id')}</dt><dd>{state.apiId || '—'}</dd>
    <dt>{t('auth.api_hash')}</dt><dd>{state.hash === undefined ? t(state.failed ? 'common.operation_failed' : 'common.loading') : t(state.hash ? 'settings.protected' : 'common.disconnected_telegram')}</dd>
  </dl><button type="button" className="cloud-signout-button" onClick={onLogout} disabled={!onLogout}><LogOut size={17} />{t('common.sign_out')}</button></section>;
}
