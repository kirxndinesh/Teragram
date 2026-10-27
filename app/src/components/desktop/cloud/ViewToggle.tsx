import { LayoutGrid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ViewToggle({ mode, onChange }: { mode: 'grid' | 'list'; onChange: (mode: 'grid' | 'list') => void }) {
  const { t } = useTranslation();
  return <div className="cloud-view-toggle" role="group" aria-label={t('tg.fileView')}>
    {(['list', 'grid'] as const).map(value => <button key={value} type="button" aria-label={t(value === 'list' ? 'tg.listView' : 'tg.gridView')} title={t(value === 'list' ? 'tg.listView' : 'tg.gridView')} aria-pressed={mode === value} onClick={() => onChange(value)}>{value === 'list' ? <List size={18} aria-hidden="true" /> : <LayoutGrid size={18} aria-hidden="true" />}</button>)}
  </div>;
}
