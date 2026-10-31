import type { RefObject } from 'react';
import * as Icon from '~/components/icon';
import { Button, Dropdown } from '~/components/shared';
import { MoreButton, Text } from '~/components/ui';
import type { NoteSaveStatus } from '~/hooks/useNoteSaveController';
import NoteSaveStatusIndicator from './NoteSaveStatusIndicator';

interface NoteEditorHeaderProps {
    onMoveWorkspace?: () => void;
    readOnly?: boolean;
    isNew?: boolean;
    title: string;
    titleRef: RefObject<HTMLInputElement | null>;
    isPinned: boolean;
    createdAt: string;
    saveStatus: NoteSaveStatus;
    savedAt: string;
    savedVersion: string;
    saveConfirmationRevision: number;
    onTitleChange: (title: string) => void;
    onTitleEnter?: () => void;
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
    onMoveWorkspace,
    readOnly = false,
    isNew = false,
    titleRef,
    isPinned,
    createdAt,
    saveStatus,
    savedAt,
    savedVersion,
    saveConfirmationRevision,
    onTitleChange,
    onTitleEnter,
    onCopyMarkdown,
    onDownloadDocument,
    onTogglePinned,
    onChangeLayout,
    onCloneNote,
    onRestoreVersion,
    onDelete,
    onSave,
}: NoteEditorHeaderProps) {
    const noteActionItems = [
        { type: 'separator' as const, key: 'export-separator' },
        ...(!readOnly
            ? [
                  { name: isPinned ? 'Unpin' : 'Pin', onClick: onTogglePinned },
                  { name: 'Change layout', onClick: onChangeLayout },
              ]
            : []),
        { type: 'separator' as const },
        ...(!readOnly ? [{ name: 'Clone this note', onClick: onCloneNote }] : []),
        ...(onMoveWorkspace && !readOnly ? [{ name: 'Move to workspace', onClick: onMoveWorkspace }] : []),
        ...(!readOnly ? [{ name: 'Restore previous version', onClick: onRestoreVersion }] : []),
        { type: 'separator' as const },
        ...(!readOnly ? [{ name: 'Delete', onClick: onDelete }] : []),
    ];

    return (
        // The opaque strip prevents scrolled content from showing between the navigation and sticky card.
        <div className="z-[1000] mb-7 sm:sticky sm:top-[calc(3.5625rem+2px)] sm:-mt-4 sm:bg-[var(--page-bg)] sm:pt-4">
            <div className="surface-floating flex flex-col gap-3.5 px-4 pt-4 pb-3.5 sm:px-5">
                <div className="flex items-center justify-between gap-3 sm:gap-5">
                    <div className="min-w-0 flex-1">
                        <input
                            ref={titleRef}
                            aria-label="Note title"
                            placeholder="Title"
                            className="text-heading w-full text-ellipsis bg-transparent font-semibold tracking-[-0.02em] outline-none"
                            type="text"
                            readOnly={readOnly}
                            value={title}
                            onChange={(event) => onTitleChange(event.target.value)}
                            onKeyDown={(event) => {
                                // Enter that confirms an IME composition (e.g. Hangul) must stay in the title.
                                if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) {
                                    return;
                                }
                                event.preventDefault();
                                onTitleEnter?.();
                            }}
                        />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Dropdown
                            button={<MoreButton label="Note actions" size="lg" />}
                            items={[
                                { name: 'Copy Markdown', onClick: onCopyMarkdown },
                                { name: 'Download document', onClick: onDownloadDocument },
                                ...(isNew ? [] : noteActionItems),
                            ]}
                        />
                        <Button
                            size="sm"
                            variant="subtle"
                            isLoading={saveStatus === 'saving'}
                            disabled={readOnly || saveStatus === 'conflict'}
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
                    {isNew && saveStatus === 'saved' ? (
                        <Text as="span" variant="label" weight="medium" tone="tertiary">
                            Saved once you start writing
                        </Text>
                    ) : (
                        <NoteSaveStatusIndicator
                            status={saveStatus}
                            savedAt={savedAt}
                            savedVersion={savedVersion}
                            confirmationRevision={saveConfirmationRevision}
                        />
                    )}
                    {!isNew && (
                        <>
                            <span className="hidden h-1 w-1 rounded-full bg-border-secondary sm:block" />
                            <Text
                                as="span"
                                variant="label"
                                weight="medium"
                                tone="tertiary"
                                className="basis-full sm:basis-auto"
                            >
                                Created {createdAt}
                            </Text>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
