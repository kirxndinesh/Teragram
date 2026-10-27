import { ImmersiveViewer } from '../cloud/MediaChrome';
import {useTranslation} from 'react-i18next';
import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Download } from 'lucide-react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
// Use the legacy build — the modern build uses Map.getOrInsertComputed()
// which isn't available in Tauri's WebKit WebView
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { TelegramFile } from '../../../types';
import { isAndroidPlatform } from '../../../utils';

// Use Vite's ?url suffix to get a properly bundled asset URL for the worker.
// The asset is copied as-is, so ship the upstream minified worker.
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import i18n from '../../../i18n';
import { toast } from 'sonner';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const PDF_CACHE_LIMIT_BYTES = 25 * 1024 * 1024;
const PAGE_PREFETCH_ROOT_MARGIN = '1000px 0px';

interface StreamInfo {
    token: string;
    base_url: string;
    operation_token?: string | null;
}

interface PdfViewerProps {
    file: TelegramFile;
    onClose: () => void;
    onDownload?: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    currentIndex?: number;
    totalItems?: number;
    activeFolderId: number | null;
    localPath?: string;
}

export function PdfViewer({ file, onClose, onDownload, onNext, onPrev, currentIndex, totalItems, activeFolderId, localPath }: PdfViewerProps) {
    useTranslation();
    const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
    const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState<number>(1.2);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [openingExternal, setOpeningExternal] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

    const handleOpenExternally = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setOpeningExternal(true);
        try {
            const path = localPath ?? await invoke<string>('cmd_get_preview', {
                messageId: file.id,
                folderId: activeFolderId
            });
            if (path) {
                await invoke('cmd_open_file_externally', { path });
            } else {
                toast.error(i18n.t('common.operation_failed'));
            }
        } catch (err) {
            console.error("Failed to open externally:", err);
            toast.error(i18n.t('common.operation_failed'));
        } finally {
            setOpeningExternal(false);
        }
    };

    useEffect(() => {
        if (isAndroidPlatform || localPath) return;
        invoke<StreamInfo>('cmd_get_stream_info').then(setStreamInfo).catch((err) => {
            console.error("Failed to get stream info:", err);
            setError(i18n.t('viewer.stream_failed'));
        });
    }, [localPath]);

    useEffect(() => {
        let cancelled = false;
        let activeLoadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
        setLoading(true);
        setError(null);
        setPdf(null);
        setNumPages(0);
        setCurrentPage(1);

        const finishPdfLoad = (pdfDoc: pdfjsLib.PDFDocumentProxy) => {
            if (cancelled) {
                void pdfDoc.loadingTask.destroy();
                return;
            }
            if (pdfRef.current) void pdfRef.current.loadingTask.destroy();
            pdfRef.current = pdfDoc;
            setPdf(pdfDoc);
            setNumPages(pdfDoc.numPages);
            setLoading(false);
        };

        const loadStream = () => {
            if (!streamInfo || cancelled) {
                if (!streamInfo) setError(i18n.t('viewer.stream_failed'));
                return;
            }
            const folderIdParam = activeFolderId !== null ? activeFolderId.toString() : 'home';
            const credential = streamInfo.operation_token
                ? `&credential=${encodeURIComponent(streamInfo.operation_token)}`
                : '';
            const streamUrl = `${streamInfo.base_url}/stream/${folderIdParam}/${file.id}?token=${encodeURIComponent(streamInfo.token)}${credential}`;
            activeLoadingTask = pdfjsLib.getDocument({ url: streamUrl });
            activeLoadingTask.promise.then(finishPdfLoad, (err) => {
                if (cancelled) return;
                console.error("Error loading PDF stream:", err);
                setError(i18n.t('viewer.pdf_document_failed'));
                setLoading(false);
            });
        };

        const loadLocalFile = (filePath: string) => {
            activeLoadingTask = pdfjsLib.getDocument({
                url: convertFileSrc(filePath),
                disableRange: true,
                disableStream: true,
                disableAutoFetch: true,
            });
            activeLoadingTask.promise.then(finishPdfLoad, (err) => {
                if (cancelled) return;
                if (localPath) {
                    setError(i18n.t('workspace.preview_failed'));
                    setLoading(false);
                    return;
                }
                if (!isAndroidPlatform) {
                    console.warn("Cached PDF could not be rendered; falling back to streaming:", err);
                    loadStream();
                    return;
                }
                console.error("Error loading PDF via cache URL, falling back to external opener:", err);
                invoke('cmd_open_file_externally', { path: filePath })
                    .then(() => {
                        if (!cancelled) onClose();
                    })
                    .catch((externalError) => {
                        if (!cancelled) {
                            setError(i18n.t('viewer.pdf_native_failed', { error: String(externalError) }));
                            setLoading(false);
                        }
                    });
            });
        };

        if (localPath) {
            loadLocalFile(localPath);
            return () => { cancelled = true; void activeLoadingTask?.destroy(); };
        }
        if (!isAndroidPlatform && !streamInfo) {
            return;
        }

        // Small PDFs are loaded from the bounded plaintext preview cache so a
        // recently viewed document remains available offline. Large desktop
        // PDFs retain range-based streaming to avoid filling the cache.
        const shouldCache = isAndroidPlatform || file.size <= PDF_CACHE_LIMIT_BYTES;
        if (shouldCache) {
            invoke<string>('cmd_get_preview', {
                messageId: file.id,
                folderId: activeFolderId,
            }).then((filePath) => {
                if (cancelled) return;
                if (filePath) loadLocalFile(filePath);
                else if (!isAndroidPlatform) loadStream();
                else {
                    setError(i18n.t('viewer.pdf_path_failed'));
                    setLoading(false);
                }
            }).catch((err) => {
                if (cancelled) return;
                if (!isAndroidPlatform) {
                    console.warn("Could not cache PDF; falling back to streaming:", err);
                    loadStream();
                } else {
                    console.error("Error invoking PDF preview command:", err);
                    setError(i18n.t('viewer.pdf_load_failed'));
                    setLoading(false);
                }
            });
        } else {
            loadStream();
        }

        return () => {
            cancelled = true;
            void activeLoadingTask?.destroy();
        };
    }, [streamInfo, activeFolderId, file.id, file.size, localPath]);

    useEffect(() => {
        return () => {
            if (pdfRef.current) {
                void pdfRef.current.loadingTask.destroy();
                pdfRef.current = null;
            }
        };
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const key = e.key.toLowerCase();

            if (e.key === 'ArrowRight' || key === 'l') {
                e.preventDefault();
                onNext?.();
                return;
            }

            if (e.key === 'ArrowLeft' || key === 'j') {
                e.preventDefault();
                onPrev?.();
                return;
            }


            if (e.key === '=' || key === '+') {
                e.preventDefault();
                setScale(s => Math.min(s + 0.2, 3));
            }

            if (e.key === '-') {
                e.preventDefault();
                setScale(s => Math.max(s - 0.2, 0.5));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onNext, onPrev]);

    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(s => Math.min(s + 0.2, 3));
    };

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(s => Math.max(s - 0.2, 0.5));
    };

    const handleFitWidth = (e: React.MouseEvent) => {
        e.stopPropagation();
        const currentPdf = pdfRef.current;
        if (!currentPdf) return;
        void currentPdf.getPage(currentPage).then(page => {
            if (pdfRef.current !== currentPdf || !containerRef.current) return;
            const width = page.getViewport({ scale: 1 }).width;
            setScale(Math.max(0.5, Math.min(3, (containerRef.current.clientWidth - 48) / width)));
        }).catch(() => {});
    };

    const goToPage = (page: number) => {
        const next = Math.max(1, Math.min(numPages, page));
        setCurrentPage(next);
        containerRef.current?.querySelector(`[data-pdf-page="${next}"]`)?.scrollIntoView({ block: 'start' });
    };
    return <ImmersiveViewer name={file.name} onClose={onClose} onNext={onNext} onPrev={onPrev} closeLabel={i18n.t('viewer.close_pdf')} badge={typeof currentIndex === 'number' && totalItems ? `${currentIndex + 1}/${totalItems}` : undefined} actions={onDownload && <button type="button" className="media-icon" aria-label={i18n.t('files.download')} onClick={onDownload}><Download size={20} /></button>}>
        <div className="document-viewer">
            <div className="document-controls">
                <button type="button" aria-label={i18n.t('syncPreview.previous')} disabled={!pdf || currentPage <= 1} onClick={() => goToPage(currentPage - 1)}><ChevronLeft size={18} /></button>
                <span>{i18n.t('syncPreview.page', { current: currentPage, total: numPages || '—' })}</span>
                <button type="button" aria-label={i18n.t('syncPreview.next')} disabled={!pdf || currentPage >= numPages} onClick={() => goToPage(currentPage + 1)}><ChevronRight size={18} /></button>
                <button type="button" aria-label={i18n.t('common.zoom_out')} onClick={handleZoomOut}><ZoomOut size={18} /></button>
                <span>{Math.round(scale * 100)}%</span>
                <button type="button" aria-label={i18n.t('common.zoom_in')} onClick={handleZoomIn}><ZoomIn size={18} /></button>
                <button type="button" aria-label={i18n.t('viewer.fit_width')} onClick={handleFitWidth}><Maximize size={18} /></button>
            </div>
            <div ref={containerRef} className="pdf-document-scroll" onScroll={() => {
                const container = containerRef.current; if (!container) return;
                const top = container.getBoundingClientRect().top;
                const pages = Array.from(container.querySelectorAll<HTMLElement>('[data-pdf-page]'));
                const visible = pages.find(page => page.getBoundingClientRect().bottom > top + 50);
                if (visible) setCurrentPage(Number(visible.dataset.pdfPage));
            }}>
                {loading && <p role="status" className="document-message">{i18n.t('viewer.loading_document')}</p>}
                {error && <div role="alert" className="document-message"><p>{i18n.t('viewer.unable_pdf')}</p><button onClick={handleOpenExternally} disabled={openingExternal}>{i18n.t('viewer.open_external')}</button></div>}
                {pdf && <div>{Array.from({ length: numPages }, (_, index) => <div data-pdf-page={index + 1} key={`${file.id}:${index + 1}`}><PdfPage pageNumber={index + 1} pdf={pdf} scale={scale} /></div>)}</div>}
            </div>
        </div>
    </ImmersiveViewer>;

}

// Individual Page Component — lazy-loaded via IntersectionObserver
function PdfPage({ pageNumber, pdf, scale }: { pageNumber: number; pdf: pdfjsLib.PDFDocumentProxy; scale: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<ReturnType<pdfjsLib.PDFPageProxy['render']> | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState<pdfjsLib.PDFPageProxy | null>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            (entries) => {
                setIsVisible(entries[0].isIntersecting);
            },
            { rootMargin: PAGE_PREFETCH_ROOT_MARGIN }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Clear/unload canvas and page structure when not visible to release memory
    useEffect(() => {
        if (!isVisible) {
            setPage(null);
            if (canvasRef.current) {
                const canvas = canvasRef.current;
                canvas.width = 0;
                canvas.height = 0;
            }
        }
    }, [isVisible]);

    // Fetch the PDF page object when visible
    useEffect(() => {
        if (!isVisible || !pdf) return;

        let cancelled = false;
        pdf.getPage(pageNumber).then(loadedPage => {
            if (!cancelled) {
                setPage(loadedPage);
            }
        }).catch(err => console.error(`Error loading page ${pageNumber}:`, err));

        return () => {
            cancelled = true;
        };
    }, [isVisible, pdf, pageNumber]);

    // Render the page to canvas — re-runs when page loads or scale changes
    useEffect(() => {
        if (!page || !canvasRef.current || !isVisible) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        // Cancel any in-flight render before starting a new one
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
            renderTaskRef.current = null;
        }

        // Size canvas and clear before render to avoid stale frame flash
        const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16_000_000 / Math.max(1, viewport.width * viewport.height)));
        canvas.height = Math.round(viewport.height * ratio);
        canvas.width = Math.round(viewport.width * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.clearRect(0, 0, viewport.width, viewport.height);

        const renderTask = page.render({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
            transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        renderTaskRef.current = renderTask;

        renderTask.promise.catch((err) => {
            // RenderingCancelledException is expected during zoom — ignore it
            if (err?.name !== 'RenderingCancelledException') {
                console.error(`Render error on page ${pageNumber}:`, err);
            }
        });

        return () => {
            renderTask.cancel();
            renderTaskRef.current = null;
        };
    }, [page, scale, isVisible, pageNumber]);

    // Estimated dimensions for the placeholder before page loads (US Letter @ 96 DPI)
    const estimatedHeight = 1056 * scale;
    const estimatedWidth = 816 * scale;

    return (
        <div
            ref={containerRef}
            className="relative my-2 flex flex-col items-center overflow-hidden rounded-control bg-white/5 shadow-[0_8px_28px_rgba(0,0,0,0.32)]"
            style={{
                minHeight: !page ? `${estimatedHeight}px` : undefined,
                minWidth: !page ? `${estimatedWidth}px` : undefined,
            }}
        >
            <canvas ref={canvasRef} className="max-w-full h-auto bg-white" />

            {!page && isVisible && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white/30">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"></div>
                </div>
            )}
        </div>
    );
}
