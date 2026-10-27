import { isCreativeDocument } from '../../../services/documentFormats';
import type { TelegramFile } from '../../../types';
import { classifyFileExtension } from '../../../services/searchPolicy';

export const cloudFileKey = (file: TelegramFile) => `${file.folder_id ?? 'saved'}:${file.id}`;
export const folderKey = (id: number | null) => id === null ? 'saved' : String(id);
export function cloudFileType(file: TelegramFile) {
  if (isCreativeDocument(file.name)) return 'image';
  const mime = file.mime_type ?? '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return classifyFileExtension(file.file_ext || file.name.split('.').pop() || '');
}
export const isGalleryFile = (file: TelegramFile) => ['image', 'video'].includes(cloudFileType(file));
