import { Link } from '@tanstack/react-router';
import { Button, Modal, ModalActionRow } from '~/components/shared';
import type { ButtonProps } from '~/components/ui';
import { Text } from '~/components/ui';
import type { Note } from '~/models/note.model';
import { NOTE_ROUTE } from '~/modules/url';

export interface NoteReferenceWarningModalProps {
    isOpen: boolean;
    title: string;
    description: string;
    references: Pick<Note, 'id' | 'title'>[];
    confirmLabel: string;
    onClose: () => void;
    onConfirm: () => void;
    confirmVariant?: ButtonProps['variant'];
    isConfirming?: boolean;
}

export default function NoteReferenceWarningModal({
    isOpen,
    title,
    description,
    references,
    confirmLabel,
    onClose,
    onConfirm,
    confirmVariant = 'primary',
    isConfirming = false,
}: NoteReferenceWarningModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} variant="inspect">
            <Modal.Header title={title} onClose={onClose} />
            <Modal.Body>
                <div className="flex flex-col gap-3">
                    <Modal.Description className="text-meta font-normal text-fg-secondary">
                        {description}
                    </Modal.Description>
                    <div className="overflow-hidden rounded-[16px] border border-border-subtle bg-hover-subtle/40">
                        <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
                            <Text
                                as="p"
                                variant="micro"
                                weight="semibold"
                                tracking="wider"
                                transform="uppercase"
                                tone="tertiary"
                            >
                                Referenced notes
                            </Text>
                            <Text as="p" variant="label" tone="tertiary">
                                {references.length} {references.length === 1 ? 'note' : 'notes'}
                            </Text>
                        </div>
                        <ul className="flex flex-col">
                            {references.map((reference, index) => (
                                <li
                                    key={reference.id}
                                    className={index > 0 ? 'border-t border-border-subtle' : undefined}
                                >
                                    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                        <Text
                                            as="p"
                                            variant="body"
                                            weight="medium"
                                            className="min-w-0 flex-1 break-words"
                                        >
                                            {reference.title || 'Untitled note'}
                                        </Text>
                                        <Button asChild variant="ghost" size="sm" className="self-start sm:self-auto">
                                            <Link to={NOTE_ROUTE} params={{ id: reference.id }}>
                                                Open note
                                            </Link>
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={isConfirming}>
                        Cancel
                    </Button>
                    <Button variant={confirmVariant} size="sm" onClick={onConfirm} isLoading={isConfirming}>
                        {confirmLabel}
                    </Button>
                </ModalActionRow>
            </Modal.Footer>
        </Modal>
    );
}
