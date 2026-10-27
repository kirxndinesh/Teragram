import type { Theme } from '../types/settings';
export const ACCENT_STORAGE_KEY = 'tg-drive-accent-color';
export function normalizeAccent(value: string | null): string | null {
    const hex = value?.trim();
    if (!hex || !/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(hex)) return null;
    return (hex.length === 4 ? '#' + [...hex.slice(1)].map(v => v + v).join('') : hex).toUpperCase();
}
function luminance(rgb: number[]) {
    return rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
}
export function applyAccent(preference: string | null, theme: Theme) {
    const color = preference ?? (theme === 'dark' ? '#8AB4F8' : '#0B57D0');
    const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
    const l = luminance(rgb);
    const foreground = 1.05 / (l + .05) >= 4.5 ? '#FFFFFF' : '#191919';
    const hover = rgb.map(v => Math.round(theme === 'dark' ? v + (255 - v) * .12 : v * .87));
    let text = [...rgb];
    const base = theme === 'dark' ? [32, 32, 32] : [248, 249, 250];
    const background = luminance(rgb.map((v, i) => v * .18 + base[i] * .82));
    for (let i = 0; i < 60; i++) {
        const current = luminance(text);
        if ((Math.max(current, background) + .05) / (Math.min(current, background) + .05) >= 4.7) break;
        text = text.map(v => theme === 'dark' ? Math.min(255, v + 4) : Math.max(0, v - 4));
    }
    const vars: Record<string, string> = {
        '--accent-color': color, '--accent-rgb': rgb.join(', '), '--accent-hover': `rgb(${hover.join(',')})`,
        '--accent-tint': `rgba(${rgb.join(',')},.18)`, '--accent-text': `rgb(${text.join(',')})`,
        '--color-app-accent': color, '--color-app-accent-hover': `rgb(${hover.join(',')})`,
        '--color-app-accent-soft': `rgba(${rgb.join(',')},.12)`, '--color-app-selected': `rgba(${rgb.join(',')},.18)`,
        '--color-app-accent-contrast': foreground,
    };
    Object.entries(vars).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
}
