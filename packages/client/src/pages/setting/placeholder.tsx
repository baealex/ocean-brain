import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';

import {
    Button,
    Callout,
    FallbackRender,
    Modal,
    ModalActionRow,
    PageLayout,
    Pagination,
    SurfaceCard
} from '~/components/shared';
import { Input, Label, Text, useToast } from '~/components/ui';
import * as Icon from '~/components/icon';

import { getFixedPlaceholders, PLACEHOLDER_PREFIX, PLACEHOLDER_SUFFIX } from '~/modules/fixed-placeholder';
import { queryKeys } from '~/modules/query-key-factory';
import { SETTINGS_PLACEHOLDER_ROUTE } from '~/modules/url';

import { createPlaceholder, deletePlaceholder, fetchPlaceholders } from '~/apis/placeholder.api';

const Route = getRouteApi(SETTINGS_PLACEHOLDER_ROUTE);

const Placeholder = () => {
    const toast = useToast();
    const queryClient = useQueryClient();

    const navigate = Route.useNavigate();
    const { page } = Route.useSearch();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFixedListOpen, setIsFixedListOpen] = useState(false);

    const [form, setForm] = useState({
        name: '',
        template: '',
        replacement: ''
    });

    const limit = 25;
    const placeholderListKey = queryKeys.placeholders.list({
        limit,
        offset: (page - 1) * limit
    });

    const [fixedPlaceholders] = useState(getFixedPlaceholders);
    const { data: placeholders, isLoading } = useQuery({
        queryKey: placeholderListKey,
        queryFn: async () => {
            const response = await fetchPlaceholders({
                offset: (page - 1) * limit,
                limit
            });
            if (response.type === 'error') {
                throw response;
            }
            return response.allPlaceholders;
        }
    });

    const addPlaceholder = useMutation({
        mutationFn: createPlaceholder,
        onSuccess: async () => {
            toast('Placeholder added successfully');
            setIsModalOpen(false);
            setForm({
                name: '',
                template: '',
                replacement: ''
            });
            await queryClient.invalidateQueries({
                queryKey: queryKeys.placeholders.listAll(),
                exact: false
            });
        }
    });

    const removePlaceholder = useMutation({
        mutationFn: deletePlaceholder,
        onSuccess: async () => {
            toast('Placeholder deleted successfully');
            await queryClient.invalidateQueries({
                queryKey: queryKeys.placeholders.listAll(),
                exact: false
            });
        }
    });

    return (
        <PageLayout title="Placeholders" variant="subtle" description="Manage template variables for note cloning">
            <Callout className="mb-4">
                <div className="flex items-center justify-between gap-2">
                    <Text as="span" variant="meta" weight="medium" tone="secondary">
                        Placeholders will be replaced with new note data during cloning.
                    </Text>
                    <Button variant="subtle" size="icon-sm" onClick={() => setIsModalOpen(true)}>
                        <Icon.Plus width={20} height={20} />
                    </Button>
                </div>
            </Callout>
            <div className="mt-3 flex flex-col gap-3">
                <button
                    type="button"
                    onClick={() => setIsFixedListOpen(!isFixedListOpen)}
                    className="focus-ring-soft surface-base flex items-center justify-between gap-2 rounded-[18px] px-4 py-3 text-left text-fg-default transition-colors hover:bg-hover-subtle">
                    <Text as="div" variant="meta" weight="semibold" className="text-current">
                        System Placeholders
                    </Text>
                    <div className="flex h-6 w-6 items-center justify-center text-fg-tertiary">
                        {isFixedListOpen ? <Icon.TriangleUp /> : <Icon.TriangleDown />}
                    </div>
                </button>
                {isFixedListOpen && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {fixedPlaceholders.map(placeholder => (
                            <SurfaceCard key={placeholder.name}>
                                <Text as="div" weight="semibold">
                                    {placeholder.name}
                                </Text>
                                <Text as="div" variant="label" weight="medium" tone="tertiary">
                                    {PLACEHOLDER_PREFIX}{placeholder.template}{PLACEHOLDER_SUFFIX} = '{placeholder.replacement}'
                                </Text>
                            </SurfaceCard>
                        ))}
                    </div>
                )}
                {!isLoading && placeholders?.placeholders && placeholders.placeholders.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {placeholders.placeholders.map(placeholder => (
                            <SurfaceCard key={placeholder.id} className="relative">
                                <div className="flex items-center justify-between">
                                    <Text as="div" weight="semibold">
                                        {placeholder.name}
                                    </Text>
                                    <button
                                        type="button"
                                        className="focus-ring-soft inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-fg-tertiary transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                        onClick={() => removePlaceholder.mutate(placeholder.id.toString())}>
                                        <Icon.Close />
                                    </button>
                                </div>
                                <Text as="div" variant="label" weight="medium" tone="tertiary">
                                    {PLACEHOLDER_PREFIX}{placeholder.template}{PLACEHOLDER_SUFFIX} = '{placeholder.replacement}'
                                </Text>
                            </SurfaceCard>
                        ))}
                    </div>
                )}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <Modal.Header title="Add Placeholder" onClose={() => setIsModalOpen(false)} />
                <Modal.Body>
                    <div className="flex flex-col gap-3">
                        <Label htmlFor="name">Name:</Label>
                        <Input
                            id="name"
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({
                                ...form,
                                name: e.target.value
                            })}
                            placeholder="Description of this placeholder"
                        />
                        <Label htmlFor="template">Placeholder:</Label>
                        <Input
                            id="template"
                            type="text"
                            value={form.template}
                            onChange={(e) => setForm({
                                ...form,
                                template: e.target.value
                            })}
                            placeholder="note_app"
                        />
                        <Label htmlFor="replacement">Replacement:</Label>
                        <Input
                            id="replacement"
                            type="text"
                            value={form.replacement}
                            onChange={(e) => setForm({
                                ...form,
                                replacement: e.target.value
                            })}
                            placeholder="Ocean Brain"
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <ModalActionRow>
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button
                            variant="primary"
                            isLoading={addPlaceholder.isPending}
                            onClick={() => {
                                if (!form.name || !form.template || !form.replacement) {
                                    toast('All fields are required');
                                    return;
                                }
                                addPlaceholder.mutate({
                                    name: form.name,
                                    template: form.template,
                                    replacement: form.replacement
                                });
                            }}>Add</Button>
                    </ModalActionRow>
                </Modal.Footer>
            </Modal>
            <FallbackRender fallback={null}>
                {placeholders?.totalCount && limit < placeholders.totalCount && (
                    <Pagination
                        page={page}
                        last={Math.ceil(placeholders.totalCount / limit)}
                        onChange={(page) => {
                            navigate({
                                search: prev => ({
                                    ...prev,
                                    page
                                })
                            });
                        }}
                    />
                )}
            </FallbackRender>
        </PageLayout>
    );
};

export default Placeholder;
