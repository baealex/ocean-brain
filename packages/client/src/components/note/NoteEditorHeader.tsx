import type { RefObject } from 'react';
import * as Icon from '~/components/icon';
import { Button, Dropdown } from '~/components/shared';
import { MoreButton, Text } from '~/components/ui';
import type { NoteSaveStatus } from '~/hooks/useNoteSaveController';
import NoteSaveStatusIndicator from './NoteSaveStatusIndicator';

interface NoteEditorHeaderProps {
    title: string;
    titleRef: RefObject<HTMLInputElement | null>;
    isPinned: boolean;
    createdAt: string;
    saveStatus: NoteSaveStatus;
    savedAt: string;
    savedVersion: string;
    saveConfirmationRevision: number;
    onTitleChange: (title: string) => void;
    onCopyMarkdown: () => void;
    onDownloadDocument: () => void;
    onTogglePinned: () => void;
    onChangeLayout: () => void;
    onCloneNote: () => void;
    onRestoreVersion: () => void;
    onDelete: () => void;
    onSave: () => void;
}

export default function NoteEditorHeader({
    title,
    titleRef,
    isPinned,
    createdAt,
    saveStatus,
    savedAt,
    savedVersion,
    saveConfirmationRevision,
    onTitleChange,
    onCopyMarkdown,
    onDownloadDocument,
    onTogglePinned,
    onChangeLayout,
    onCloneNote,
    onRestoreVersion,
    onDelete,
    onSave,
}: NoteEditorHeaderProps) {
    return (
        <div className="surface-floating sticky top-20 z-[1001] mb-7 px-5 pt-4 pb-3.5">
            <div className="flex flex-col gap-3.5">
                <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0 flex-1 pt-0.5">
                        <Text
                            as="div"
                            variant="micro"
                            weight="semibold"
                            tracking="widest"
                            transform="uppercase"
                            tone="tertiary"
                            className="mb-1.5"
                        >
                            Thought in progress
                        </Text>
                        <input
                            ref={titleRef}
                            aria-label="Note title"
                            placeholder="Title"
                            className="text-heading sm:text-display w-full bg-transparent font-semibold leading-[1.25] tracking-[-0.02em] outline-none"
                            type="text"
                            value={title}
                            onChange={(event) => onTitleChange(event.target.value)}
                        />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Dropdown
                            button={<MoreButton label="Note actions" size="lg" />}
                            items={[
                                { name: 'Copy Markdown', onClick: onCopyMarkdown },
                                { name: 'Download document', onClick: onDownloadDocument },
                                { type: 'separator', key: 'export-separator' },
                                { name: isPinned ? 'Unpin' : 'Pin', onClick: onTogglePinned },
                                { name: 'Change layout', onClick: onChangeLayout },
                                { type: 'separator' },
                                { name: 'Clone this note', onClick: onCloneNote },
                                { name: 'Restore previous version', onClick: onRestoreVersion },
                                { type: 'separator' },
                                { name: 'Delete', onClick: onDelete },
                            ]}
                        />
                        <Button
                            size="sm"
                            variant="subtle"
                            isLoading={saveStatus === 'saving'}
                            disabled={saveStatus === 'conflict'}
                            onClick={onSave}
                        >
                            Save
                        </Button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-border-subtle/80 pt-3">
                    {isPinned && (
                        <Text
                            as="span"
                            variant="label"
                            weight="medium"
                            tone="secondary"
                            className="inline-flex items-center gap-1.5"
                        >
                            <Icon.Pin className="h-3 w-3" weight="fill" />
                            Pinned
                        </Text>
                    )}
                    {isPinned && <span className="h-1 w-1 rounded-full bg-border-secondary" />}
                    <NoteSaveStatusIndicator
                        status={saveStatus}
                        savedAt={savedAt}
                        savedVersion={savedVersion}
                        confirmationRevision={saveConfirmationRevision}
                    />
                    <span className="h-1 w-1 rounded-full bg-border-secondary" />
                    <Text as="span" variant="micro" weight="medium" tone="tertiary">
                        Created {createdAt}
                    </Text>
                </div>
            </div>
        </div>
    );
}
