import type { TelegramFile } from '../types';
import { cloudFileType, cloudFileKey } from '../components/desktop/cloud/cloudFiles';
export function orderCloudFiles(files: TelegramFile[], field: 'name' | 'size' | 'date', direction: 'asc' | 'desc', groupTypes: boolean) {
  const priority: Record<string, number> = { image: 0, video: 1, other: 2, archive: 2, document: 3, audio: 4 };
  const time = (file: TelegramFile) => {
    const raw = file.created_at ?? (file as TelegramFile & { message?: { date?: string | number } }).message?.date;
    if (typeof raw === 'number' || /^\d+$/.test(String(raw))) return Number(raw) * (Number(raw) < 1e12 ? 1000 : 1);
    return Date.parse(String(raw).replace(/ UTC$/, 'Z').replace(' ', 'T')) || 0;
  };
  return [...files].sort((a, b) => {
    if (groupTypes) { const category = (priority[cloudFileType(a)] ?? 2) - (priority[cloudFileType(b)] ?? 2); if (category) return category; }
    const result = field === 'size' ? (Number(a.size) || 0) - (Number(b.size) || 0) : field === 'date' ? time(a) - time(b) : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    return (direction === 'desc' ? -result : result) || cloudFileKey(a).localeCompare(cloudFileKey(b));
  });
}
