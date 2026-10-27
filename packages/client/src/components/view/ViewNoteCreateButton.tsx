import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { createNoteInView, fetchViewNoteCreationContext, type ViewNoteInput } from '~/apis/view.api';
import { ModalActionRow } from '~/components/shared';
import { Button, Modal, Text } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { invalidateQueriesForNoteChange } from '~/modules/server-event-invalidation';
import { NOTE_ROUTE } from '~/modules/url';
import ViewNoteCreateForm from './ViewNoteCreateForm';

interface ViewNoteCreateButtonProps {
    viewId: string;
    groupValue?: string | null;
    label?: string;
}

const ViewNoteCreateDialog = ({ viewId, groupValue, onClose }: ViewNoteCreateButtonProps & { onClose: () => void }) => {
    const queryClient = useQueryClient();
    const context = useQuery({
        queryKey: queryKeys.views.noteCreationContext(viewId, groupValue),
        gcTime: 0,
        async queryFn() {
            const result = await fetchViewNoteCreationContext(viewId, groupValue);
            if (result.type === 'error')
                throw new Error(result.errors[0]?.message ?? 'Failed to load view conditions.');
            return result.viewNoteCreationContext;
        },
    });
    const creation = useMutation({
        async mutationFn(input: ViewNoteInput) {
            const result = await createNoteInView(viewId, input, groupValue);
            if (result.type === 'error') throw new Error(result.errors[0]?.message ?? 'Failed to create this note.');
            return result.createNoteInView;
        },
        onSuccess: () => {
            void invalidateQueriesForNoteChange(queryClient);
        },
    });
    const close = () => {
        if (!creation.isPending) onClose();
    };

    return (
        <Modal isOpen onClose={close} variant="form" className="sm:max-w-[520px]">
            <Modal.Header
                title={creation.isSuccess ? 'Note created' : 'New note in view'}
                onClose={creation.isPending ? undefined : close}
            />
            {creation.isSuccess ? (
                <>
                    <Modal.Body>
                        <Text as="p" variant="body">
                            {creation.data.title} was added to {context.data?.title}.
                        </Text>
                        <Link
                            to={NOTE_ROUTE}
                            params={{ id: creation.data.id }}
                            className="text-sm text-accent-primary underline"
                        >
                            Open note
                        </Link>
                    </Modal.Body>
                    <Modal.Footer>
                        <ModalActionRow>
                            <Button type="button" size="sm" onClick={close}>
                                Done
                            </Button>
                        </ModalActionRow>
                    </Modal.Footer>
                </>
            ) : context.data ? (
                <ViewNoteCreateForm
                    context={context.data}
                    pending={creation.isPending}
                    error={creation.error?.message}
                    onSubmit={creation.mutate}
                    onClose={close}
                />
            ) : (
                <Modal.Body>
                    {context.isError ? (
                        <div role="alert" className="space-y-2">
                            <Text as="p" variant="meta">
                                {context.error.message}
                            </Text>
                            <Button type="button" variant="ghost" size="sm" onClick={() => void context.refetch()}>
                                Retry
                            </Button>
                        </div>
                    ) : (
                        <Text as="p" variant="meta">
                            Loading view conditions...
                        </Text>
                    )}
                </Modal.Body>
            )}
        </Modal>
    );
};

const ViewNoteCreateButton = ({ viewId, groupValue, label }: ViewNoteCreateButtonProps) => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button type="button" size="sm" variant="ghost" aria-label={label} onClick={() => setOpen(true)}>
                New note
            </Button>
            {open ? (
                <ViewNoteCreateDialog viewId={viewId} groupValue={groupValue} onClose={() => setOpen(false)} />
            ) : null}
        </>
    );
};

export default ViewNoteCreateButton;
