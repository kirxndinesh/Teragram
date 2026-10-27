import { useCallback, useEffect, useRef } from 'react';
import { useSettings } from '../../../context/SettingsContext';

/** Docked navigation preserves rail state across launches. */
export function useSidebarLayout() {
  const { settings, updateSetting } = useSettings();
  const sidebarRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const toggle = useCallback(() => updateSetting('sidebarCollapsed', !settings.sidebarCollapsed), [settings.sidebarCollapsed, updateSetting]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.defaultPrevented || target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]') || document.querySelector('[aria-modal="true"]')) return;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'b') { event.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [toggle]);
  return { collapsed: settings.sidebarCollapsed, sidebarRef, triggerRef, toggle };
}
export type SidebarLayout = ReturnType<typeof useSidebarLayout>;
