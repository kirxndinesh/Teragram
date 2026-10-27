import type { TelegramFile } from '../types';

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

type SourceFile = TelegramFile & {
  caption?: string; document?: { file_name?: string } | null;
  message?: { text?: string; date?: string | number }; date?: string | number;
  media?: unknown; has_media?: boolean; icon_type?: string;
};
function timestamp(value: unknown): string | undefined {
  if (value == null || value === '') return;
  const input = typeof value === 'number' || /^\d+$/.test(String(value))
    ? Number(value) * (Number(value) < 1e12 ? 1000 : 1)
    : String(value).replace(/ UTC$/, 'Z').replace(' ', 'T');
  const date = new Date(input);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}
const extensions: Record<string, string> = {
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/opus': 'opus',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  'image/gif': 'gif', 'application/pdf': 'pdf', 'application/zip': 'zip',
};
/** Presentation fallbacks never rename a Telegram message or infer a date from its ID. */
export function presentFile(input: TelegramFile): TelegramFile {
  const file = input as SourceFile;
  const created_at = timestamp(file.created_at) ?? timestamp(file.message?.date) ?? timestamp(file.date);
  const mime = text(file.mime_type);
  const ext = text(file.file_ext) || extensions[mime] || '';
  const caption = (text(file.caption) || text(file.message?.text)).split(/\r?\n/, 1)[0].trim();
  const title = [...caption];
  const kind = mime.startsWith('video/') ? 'Video' : mime.startsWith('image/') ? 'Photo' : mime.startsWith('audio/') ? 'Audio' : 'Telegram_Media';
  const generated = `${kind}${created_at ? '_' + created_at.slice(0, 10) : ''}_#${file.id}${ext ? '.' + ext : ''}`;
  return { ...file, name: text(file.name) || text(file.document?.file_name) || (title.length > 60 ? title.slice(0, 59).join('').trimEnd() + '…' : caption) || generated, created_at, file_ext: ext };
}
export function isUsableFile(input: TelegramFile): boolean {
  const file = input as SourceFile;
  if (file.type === 'folder' || file.icon_type === 'folder') return true;
  if (!Number.isSafeInteger(file.id) || file.id <= 0 || !Number.isFinite(file.size) || file.size < 0) return false;
  if (file.size === 0 && (!text(file.name) || file.name === 'Unknown') && !file.mime_type && !file.document) return false;
  if (file.has_media === false || file.media === null || file.icon_type === 'service') return false;
  return !!(file.size > 0 || file.document || text(file.name) || text(file.caption) || text(file.message?.text));
}
