import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileUp, FolderPlus, FolderUp, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function NewMenu({ onUpload, onFolderUpload, onCreate, collapsed }: { onUpload: () => void; onFolderUpload: () => void; onCreate: () => void; collapsed: boolean }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDetailsElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 128 });
  const contains = (target: Node | null) => !!target && (ref.current?.contains(target) || menuRef.current?.contains(target));
  const close = () => { if (ref.current) ref.current.open = false; setOpen(false); };
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!contains(event.target as Node)) close(); };
    const focus = (event: FocusEvent) => { if (!contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', focus);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', focus); };
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => { const rect = ref.current?.getBoundingClientRect(); if (rect) setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 240)), top: Math.min(rect.bottom + 8, window.innerHeight - 180) }); };
    place(); window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);
  const run = (action: () => void) => { close(); ref.current?.querySelector('summary')?.focus(); action(); };
  const escape = (event: React.KeyboardEvent) => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); ref.current?.querySelector('summary')?.focus(); } };
  return <><details ref={ref} className="cloud-new-menu" onToggle={event => setOpen(event.currentTarget.open)} onKeyDown={escape}>
    <summary aria-label={t('tg.addFiles')} data-tooltip={collapsed ? t('tg.new') : undefined}><Plus size={24} aria-hidden="true" /><span>{t('tg.new')}</span></summary>
  </details>{open && createPortal(<div ref={menuRef} className="cloud-new-options" style={position} onKeyDown={escape}>
      <button type="button" onClick={() => run(onUpload)}><FileUp size={18} aria-hidden="true" />{t('common.upload_file')}</button>
      <button type="button" onClick={() => run(onFolderUpload)}><FolderUp size={18} aria-hidden="true" />{t('common.upload_folder')}</button>
      <div className="cloud-menu-divider" />
      <button type="button" onClick={() => run(onCreate)}><FolderPlus size={18} aria-hidden="true" />{t('common.create_folder')}</button>
    </div>, document.body)}</>;
}
