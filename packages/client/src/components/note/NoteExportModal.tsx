import { useState } from 'react';

import * as Icon from '~/components/icon';
import { Button, Modal, ModalActionRow } from '~/components/shared';
import { Checkbox, Text, Tooltip, useToast } from '~/components/ui';
import { downloadBlobFile, type NoteExportMetadata } from '~/modules/note-export';
import {
    createNoteExportBlob,
    getNoteExportOutputExtension,
    type NoteExportContentSource,
    type NoteExportFormat,
} from '~/modules/note-export-download';

interface NoteExportModalProps extends NoteExportContentSource {
    isOpen: boolean;
    metadata: NoteExportMetadata;
    onClose: () => void;
}

const getNotReadyMessage = (format: NoteExportFormat) =>
    format === 'markdown' ? 'Markdown is not ready yet.' : 'HTML is not ready yet.';

interface ExportOptionCheckboxProps {
    checked: boolean;
    description: string;
    id: string;
    label: string;
    onChange: (checked: boolean) => void;
}

const ExportOptionCheckbox = ({ checked, description, id, label, onChange }: ExportOptionCheckboxProps) => {
    const labelId = `${id}-label`;

    return (
        <div className="flex min-h-6 items-center gap-2">
            <Checkbox
                id={id}
                size="sm"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                aria-labelledby={labelId}
            />
            <label id={labelId} htmlFor={id} className="min-w-0 cursor-pointer">
                <Text as="span" variant="label" weight="medium" tone="secondary" className="block">
                    {label}
                </Text>
            </label>
            <Tooltip content={<span className="block max-w-[240px] leading-4">{description}</span>} side="top">
                <button
                    type="button"
                    className="focus-ring-soft inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-fg-tertiary transition-colors hover:bg-hover-subtle hover:text-fg-secondary"
                    aria-label={`${label} help`}
                >
                    <Icon.Info className="h-3.5 w-3.5" />
                </button>
            </Tooltip>
        </div>
    );
};

export default function NoteExportModal({ isOpen, metadata, getHtml, getMarkdown, onClose }: NoteExportModalProps) {
    const toast = useToast();
    const [format, setFormat] = useState<NoteExportFormat>('html');
    const [includeAssets, setIncludeAssets] = useState(true);
    const [includeMetadata, setIncludeMetadata] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const outputExtension = getNoteExportOutputExtension(format, includeAssets);

    const handleDownload = async () => {
        setIsExporting(true);

        try {
            const result = await createNoteExportBlob({
                format,
                includeAssets,
                includeMetadata,
                metadata,
                source: {
                    getHtml,
                    getMarkdown,
                },
            });

            if (result.type === 'not-ready') {
                toast(getNotReadyMessage(result.format));
                return;
            }

            downloadBlobFile(result.blob, result.filename);
            onClose();
            toast('Downloaded note.');
        } catch {
            toast('Failed to download note.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} variant="compact">
            <Modal.Header title="Download document" onClose={onClose} />
            <Modal.Body>
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-3" role="radiogroup" aria-label="Format">
                        <Text as="span" variant="meta" weight="bold" tone="muted">
                            Format
                        </Text>
                        <div className="flex flex-wrap gap-4">
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="radio"
                                    name="note-export-format"
                                    value="html"
                                    checked={format === 'html'}
                                    onChange={() => setFormat('html')}
                                    className="h-4 w-4 accent-cta"
                                />
                                <Text as="span" variant="label" weight="medium" tone="secondary">
                                    .html
                                </Text>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="radio"
                                    name="note-export-format"
                                    value="markdown"
                                    checked={format === 'markdown'}
                                    onChange={() => setFormat('markdown')}
                                    className="h-4 w-4 accent-cta"
                                />
                                <Text as="span" variant="label" weight="medium" tone="secondary">
                                    .md
                                </Text>
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3" role="group" aria-label="Options">
                        <Text as="span" variant="meta" weight="bold" tone="muted">
                            Options
                        </Text>
                        <div className="flex flex-col gap-2">
                            <ExportOptionCheckbox
                                id="note-export-include-assets"
                                label="Include local image assets"
                                checked={includeAssets}
                                onChange={setIncludeAssets}
                                description="Bundle uploaded Ocean Brain images with the document. Without assets, local images are omitted."
                            />

                            <ExportOptionCheckbox
                                id="note-export-include-metadata"
                                label="Include metadata"
                                checked={includeMetadata}
                                onChange={setIncludeMetadata}
                                description="Add the note title, note id, timestamps, and Ocean Brain source information."
                            />
                        </div>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleDownload} disabled={isExporting}>
                        {isExporting ? 'Downloading...' : `Download .${outputExtension}`}
                    </Button>
                </ModalActionRow>
            </Modal.Footer>
        </Modal>
    );
}
