import { copyToClipboard } from '../../../utils/sharing';
import { toast } from 'sonner';
import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, Copy, Download, WrapText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TelegramFile } from '../../../types';
import { ImmersiveViewer } from './MediaChrome';

// Tokens remain React text nodes. HTML, SVG, scripts and markup are never executed.
function highlight(line: string) {
  if (line.length > 4000) return line;
  return line.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\/.*$|#.*$|\b(?:const|let|var|function|return|import|from|export|class|def|if|else|for|while|true|false|null|None|async|await|pub|fn|use)\b|\b\d+(?:\.\d+)?\b)/g).map((token, index) => <span key={index} className={/^["']/.test(token) ? 'code-string' : /^(\/\/|#)/.test(token) ? 'code-comment' : /^(\d|true$|false$|None$|null$)/.test(token) ? 'code-number' : /^(const|let|var|function|return|import|from|export|class|def|if|else|for|while|async|await|pub|fn|use)$/.test(token) ? 'code-keyword' : undefined}>{token}</span>);
}
export function TextViewer({ file, activeFolderId, onClose, onNext, onPrev, onDownload, actions }: { file: TelegramFile; activeFolderId: number | null; onClose: () => void; onNext?: () => void; onPrev?: () => void; onDownload?: () => void; actions?: React.ReactNode }) {
  const { t } = useTranslation();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [copied, setCopied] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => { let active = true; setText(null); setError(false); setCopied(false);
    if (file.size > 2 * 1024 * 1024) { setError(true); return; }
    void invoke<string>('cmd_read_text_preview', { messageId: file.id, folderId: activeFolderId }).then(value => { if (active) setText(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [file.id, activeFolderId, file.size]);
  const lines = useMemo(() => text?.split(/\r?\n/) ?? [], [text]);
  const virtual = useVirtualizer({ count: lines.length, getScrollElement: () => viewport.current, estimateSize: () => 23, overscan: 20 });
  useEffect(() => { virtual.measure(); }, [wrap, text, virtual]);
  const copy = async () => { try { await copyToClipboard(text ?? ''); setCopied(true); } catch { setCopied(false); toast.error(t('common.operation_failed')); } };
  return <ImmersiveViewer name={file.name} onClose={onClose} onNext={onNext} onPrev={onPrev} actions={actions ?? (onDownload && <button className="media-icon" aria-label={t('files.download')} onClick={onDownload}><Download size={20} /></button>)}>
    <div className="document-viewer">
      <div className="document-controls"><button type="button" aria-pressed={wrap} onClick={() => setWrap(value => !value)}><WrapText size={17} />{t('tg.wordWrap')}</button><button type="button" onClick={() => void copy()} disabled={text === null}>{copied ? <Check size={17} /> : <Copy size={17} />}{t(copied ? 'tg.textCopied' : 'tg.copyText')}</button></div>
      {error ? <p role="alert" className="document-message">{t('tg.textPreviewUnavailable')}</p> : text === null ? <p role="status" className="document-message">{t('common.loading')}</p> : <div ref={viewport} className={`document-code ${wrap ? 'is-wrapped' : ''}`} tabIndex={0} aria-label={file.name}>
        <div style={{ height: virtual.getTotalSize(), position: 'relative', minWidth: '100%' }}>{virtual.getVirtualItems().map(row => <div data-index={row.index} ref={virtual.measureElement} key={row.key} className="document-code-line" style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${row.start}px)` }}><span className="document-line-number" aria-hidden="true">{row.index + 1}</span><code>{highlight(lines[row.index])}{!lines[row.index] && '\u200b'}</code></div>)}</div>
      </div>}
    </div>
  </ImmersiveViewer>;
}
