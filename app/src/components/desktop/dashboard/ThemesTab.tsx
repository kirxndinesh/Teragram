import { useEffect, useState } from 'react';
import { Check, Monitor, Moon, Palette, RotateCcw, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../context/ThemeContext';
import { normalizeAccent } from '../../../services/accentTheme';

const COLORS = ['#0B57D0', '#4F46E5', '#7C3AED', '#E11D48', '#EA580C', '#D97706', '#10B981', '#0D9488'];
export function ThemesTab() {
    const { t } = useTranslation();
    const { theme, themePreference, setThemePreference, accentColor, setAccentColor } = useTheme();
    const [draft, setDraft] = useState(accentColor);
    useEffect(() => setDraft(accentColor), [accentColor]);
    const invalid = !normalizeAccent(draft);
    return <section className="cloud-theme-settings">
        <h3>{t('common.theme')}</h3>
        <div className="cloud-mode-control" role="group" aria-label={t('common.theme')}>
            {([['system', Monitor, 'common.system'], ['light', Sun, 'common.light_mode'], ['dark', Moon, 'common.dark_mode']] as const).map(([mode, Icon, label]) => <button type="button" key={mode} aria-pressed={themePreference === mode} onClick={() => setThemePreference(mode)}><Icon size={17} aria-hidden="true" />{t(label)}</button>)}
        </div>
        <section className="cloud-accent-section">
            <h3><Palette size={18} aria-hidden="true" />{t('tg.accentColor')}</h3>
            <div className="cloud-accent-swatches" role="group" aria-label={t('tg.accentColor')}>
                {COLORS.map((value, index) => {
                    const color = index === 0 && theme === 'dark' ? '#8AB4F8' : value;
                    return <button type="button" key={value} title={color} aria-label={color} aria-pressed={accentColor === color} style={{ backgroundColor: color }} onClick={() => setAccentColor(index === 0 ? null : color)}>{accentColor === color && <Check size={18} aria-hidden="true" />}</button>;
                })}
                <label className="cloud-custom-color" title={t('tg.customColor')}><input aria-label={t('tg.customColor')} type="color" value={accentColor} onChange={event => setAccentColor(event.target.value)} /><Palette size={18} aria-hidden="true" /></label>
            </div>
            <div className="cloud-hex-row"><span className="cloud-accent-preview" aria-hidden="true" style={{ background: accentColor }} /><label htmlFor="accent-hex">{t('tg.hexColor')}</label><input id="accent-hex" type="text" maxLength={7} value={draft} spellCheck={false} autoComplete="off" aria-invalid={invalid} aria-describedby={invalid ? 'accent-error' : undefined} onChange={event => { setDraft(event.target.value); const valid = normalizeAccent(event.target.value); if (valid && event.target.value.trim().length === 7) setAccentColor(valid); }} onBlur={() => { const valid = normalizeAccent(draft); if (valid) { setAccentColor(valid); setDraft(valid); } }} /><button type="button" onClick={() => { setAccentColor(null); setDraft(theme === 'dark' ? '#8AB4F8' : '#0B57D0'); }}><RotateCcw size={15} aria-hidden="true" />{t('settings.reset_default')}</button></div>
            {invalid && <p id="accent-error" role="alert">{t('tg.invalidHex')}</p>}
        </section>
    </section>;
}
