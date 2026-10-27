import { createContext, useContext, useState, useLayoutEffect, useCallback, type ReactNode } from 'react';
import { animateThemeChange, triggerHaptic } from '../services/feedback';
import { readThemePreference, writeBaseTheme, readStorageValue, writeStorageValue } from '../services/themePersistence';
import { applyAccent, normalizeAccent, ACCENT_STORAGE_KEY } from '../services/accentTheme';
import type { Theme, ThemePreference } from '../types/settings';

interface ThemeContextType {
    theme: Theme;
    themePreference: ThemePreference;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    setThemePreference: (theme: ThemePreference) => void;
    accentColor: string;
    setAccentColor: (color: string | null) => void;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const systemMode = (): Theme => window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
const resolve = (preference: ThemePreference): Theme => preference === 'system' ? systemMode() : preference;
function applyBase(theme: Theme, color: string | null) {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme === 'dark');
    // Old presets are retained in storage but no longer override the neutral palette.
    document.getElementById('dynamic-theme')?.remove();
    applyAccent(color, theme);
}
if (typeof window !== 'undefined') applyBase(resolve(readThemePreference()), normalizeAccent(readStorageValue(ACCENT_STORAGE_KEY)));

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [themePreference, setPreference] = useState<ThemePreference>(readThemePreference);
    const [system, setSystem] = useState<Theme>(systemMode);
    const [accent, setAccent] = useState<string | null>(() => normalizeAccent(readStorageValue(ACCENT_STORAGE_KEY)));
    const theme = themePreference === 'system' ? system : themePreference;
    const accentColor = accent ?? (theme === 'dark' ? '#8AB4F8' : '#0B57D0');
    useLayoutEffect(() => {
        const query = window.matchMedia('(prefers-color-scheme: light)');
        const changed = () => setSystem(systemMode());
        query.addEventListener('change', changed);
        return () => query.removeEventListener('change', changed);
    }, []);
    useLayoutEffect(() => { applyBase(theme, accent); writeBaseTheme(theme, themePreference); }, [theme, themePreference, accent]);
    const setThemePreference = useCallback((preference: ThemePreference) => { animateThemeChange(); setPreference(preference); }, []);
    const toggleTheme = useCallback(() => { triggerHaptic('selection'); setThemePreference(theme === 'dark' ? 'light' : 'dark'); }, [theme, setThemePreference]);
    const setAccentColor = useCallback((color: string | null) => {
        const valid = color === null ? null : normalizeAccent(color);
        if (color !== null && valid === null) return;
        writeStorageValue(ACCENT_STORAGE_KEY, valid ?? ''); setAccent(valid);
    }, []);
    return <ThemeContext.Provider value={{ theme, themePreference, toggleTheme, setTheme: setThemePreference, setThemePreference, accentColor, setAccentColor }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};
