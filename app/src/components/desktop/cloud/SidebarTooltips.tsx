import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// A portal keeps rail tooltips outside the scrollable navigation's clipping area.
export function SidebarTooltips({ enabled }: { enabled: boolean }) {
  const [tip, setTip] = useState<{ text: string; left: number; top: number } | null>(null);
  useEffect(() => {
    setTip(null);
    if (!enabled) return;
    const show = (event: Event) => {
      const element = (event.target as HTMLElement).closest<HTMLElement>('[data-tooltip]');
      if (!element?.dataset.tooltip) { setTip(null); return; }
      const bounds = element.getBoundingClientRect();
      setTip({ text: element.dataset.tooltip, left: bounds.right + 12, top: Math.max(8, Math.min(window.innerHeight - 38, bounds.top + bounds.height / 2 - 16)) });
    };
    const hide = () => setTip(null);
    document.addEventListener('pointerover', show);
    document.addEventListener('focusin', show);
    document.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => { document.removeEventListener('pointerover', show); document.removeEventListener('focusin', show); document.removeEventListener('scroll', hide, true); window.removeEventListener('blur', hide); };
  }, [enabled]);
  return enabled && tip ? createPortal(<div role="tooltip" className="one-sidebar-tooltip" style={{ left: tip.left, top: tip.top }}>{tip.text}</div>, document.body) : null;
}
