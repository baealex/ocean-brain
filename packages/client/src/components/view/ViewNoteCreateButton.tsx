import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { createNoteInView, fetchViewNoteCreationContext, type ViewNoteInput } from '~/apis/view.api';
import * as Icon from '~/components/icon';
import { Button, Modal, Text } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { invalidateQueriesForNoteChange } from '~/modules/server-event-invalidation';
import { NOTE_ROUTE, VIEWS_ROUTE } from '~/modules/url';
import ViewNoteCreateForm from './ViewNoteCreateForm';

interface ViewNoteCreateButtonProps {
    viewId: string;
    groupValue?: string | null;
    label?: string;
}

const ViewNoteCreateButton = ({ viewId, groupValue, label }: ViewNoteCreateButtonProps) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const contextOptions = {
        queryKey: queryKeys.views.noteCreationContext(viewId, groupValue),
        gcTime: 0,
        async queryFn() {
            const result = await fetchViewNoteCreationContext(viewId, groupValue);
            if (result.type === 'error')
                throw new Error(result.errors[0]?.message ?? 'Failed to load view conditions.');
            return result.viewNoteCreationContext;
        },
    };
    const creation = useMutation({
        async mutationFn(input: ViewNoteInput) {
            const result = await createNoteInView(viewId, input, groupValue);
            if (result.type === 'error') throw new Error(result.errors[0]?.message ?? 'Failed to create this note.');
            return result.createNoteInView;
        },
        onSuccess(note) {
            setOpen(false);
            void invalidateQueriesForNoteChange(queryClient);
            void navigate({ to: NOTE_ROUTE, params: { id: note.id } });
        },
        onError: () => setOpen(true),
    });
    const preparation = useMutation({
        mutationFn: () => queryClient.fetchQuery({ ...contextOptions, staleTime: 0 }),
        onSuccess(data) {
            const needsChoice =
                (data.mode === 'or' && data.tagNames.length > 1) ||
                data.properties.some((property) => property.required && property.defaultValue === null);
            if (needsChoice) setOpen(true);
            else creation.mutate({ title: '', tagNames: data.defaultTagNames });
        },
        onError: () => setOpen(true),
    });
    const context = useQuery({
        ...contextOptions,
        enabled: open && preparation.isSuccess,
        staleTime: Infinity,
        refetchOnReconnect: 'always',
    });
    const pending = preparation.isPending || creation.isPending;
    const close = () => {
        if (pending) return;
        setOpen(false);
        creation.reset();
        preparation.reset();
    };
    const contextError = context.error ?? preparation.error;

    return (
        <>
            <Button
                type="button"
                size="sm"
                variant="subtle"
                aria-label={label}
                isLoading={pending}
                onClick={() => preparation.mutate()}
            >
                <Icon.Plus className="size-3.5" />
                New note
            </Button>
            {open ? (
                <Modal isOpen onClose={close} variant="form" className="sm:max-w-[520px]">
                    <Modal.Header title="New note in view" onClose={pending ? undefined : close} />
                    {context.data && preparation.isSuccess ? (
                        <ViewNoteCreateForm
                            context={context.data}
                            pending={pending}
                            error={creation.error?.message ?? contextError?.message}
                            onSubmit={creation.mutate}
                            onClose={close}
                        />
                    ) : (
                        <Modal.Body>
                            {contextError ? (
                                <div role="alert" className="space-y-3">
                                    <Text as="p" variant="meta">
                                        {contextError.message}
                                    </Text>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            type="button"
                                            variant="subtle"
                                            size="sm"
                                            onClick={() => preparation.mutate()}
                                        >
                                            Retry
                                        </Button>
                                        <Link to={VIEWS_ROUTE} className="text-sm text-accent-primary underline">
                                            Open view settings
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <Text as="p" variant="meta">
                                    Loading view conditions...
                                </Text>
                            )}
                        </Modal.Body>
                    )}
                </Modal>
            ) : null}
        </>
    );
};

export default ViewNoteCreateButton;
