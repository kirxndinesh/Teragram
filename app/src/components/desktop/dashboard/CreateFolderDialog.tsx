import {useTranslation} from 'react-i18next';
import { FormEvent, useCallback, useRef, useState } from 'react';
import { FolderPlus, Info, X } from 'lucide-react';
import { useModalFocus } from '../../../hooks/useModalFocus';
import i18n from '../../../i18n';

interface CreateFolderDialogProps {
    onClose: () => void;
    onCreate: (name: string) => Promise<void>;
}

export function CreateFolderDialog({ onClose, onCreate }: CreateFolderDialogProps) {
    useTranslation();
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const panelRef = useRef<HTMLFormElement>(null);
    const close = useCallback(onClose, [onClose]);
    useModalFocus(panelRef, close);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const cleanName = name.trim();
        if (!cleanName || saving) return;
        setSaving(true);
        try {
            await onCreate(cleanName);
            onClose();
        } catch {
            // The caller reports the backend error and the dialog stays open for correction/retry.
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-app-overlay p-4 backdrop-blur-sm" onMouseDown={onClose}>
            <form ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="create-folder-title" tabIndex={-1} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="quiet-raised folder-modal create-folder-dialog">
                <header>
                    <h2 id="create-folder-title"><FolderPlus size={18} aria-hidden="true" />{i18n.t('common.create_folder')}</h2>
                    <button type="button" onClick={onClose} className="folder-close" aria-label={i18n.t("common.close")}><X size={20} aria-hidden="true" /></button>
                </header>
                <div className="folder-form-body">
                    <label className="folder-field">
                        <span>{i18n.t("files.folder_name")}</span>
                        <input autoFocus data-modal-autofocus aria-describedby="create-folder-note" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="e.g. Project files" />
                    </label>
                    <div className="folder-info">
                        <Info size={16} aria-hidden="true" />
                        <span id="create-folder-note">This creates a private Telegram channel that Teragram presents as a folder. Its files remain in your Telegram account.</span>
                    </div>
                </div>
                <footer>
                    <button type="button" onClick={onClose} className="folder-secondary">{i18n.t("common.cancel")}</button>
                    <button type="submit" disabled={!name.trim() || saving} className="folder-primary">{saving ? i18n.t('ui_copy.creating') : i18n.t('ui_copy.create_private_folder')}</button>
                </footer>
            </form>
        </div>
    );
}
