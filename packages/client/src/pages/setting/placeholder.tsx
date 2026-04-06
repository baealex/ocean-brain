import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';

import {
    Button,
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
    const [isFixedListOpen, setIsFixedListOpen] = useState(true);

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

    const fixedPlaceholderCount = fixedPlaceholders.length;
    const customPlaceholderCount = placeholders?.totalCount ?? 0;
    const customPlaceholders = placeholders?.placeholders ?? [];
    const fieldLabelClassName = 'font-medium text-fg-tertiary';
    const cardClassName = '!bg-elevated !px-3 !py-2.5';
    const cardTitleClassName = 'leading-[1.2]';
    const tokenPreviewClassName = 'break-all leading-[1.2]';
    const valuePreviewClassName = 'leading-[1.2]';
    const cardBodyClassName = 'flex flex-col gap-px';
    const cardMetaGroupClassName = 'space-y-px';
    const summaryText = isLoading
        ? `${fixedPlaceholderCount} system placeholders`
        : `${customPlaceholderCount} custom placeholders · ${fixedPlaceholderCount} system placeholders`;

    return (
        <PageLayout
            title="Placeholders"
            variant="default"
            description="Placeholders are replaced with new note data during cloning.">
            <div className="flex flex-col gap-5">
                <Text as="p" variant="meta" weight="medium" tone="secondary">
                    {summaryText}
                </Text>
                <section className="space-y-3 border-b border-border-subtle/80 pb-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                            <Text as="p" variant="body" weight="medium">
                                System placeholders
                            </Text>
                            <Text as="p" variant="meta" tone="secondary">
                                Built-in date and time variables used across note cloning.
                            </Text>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsFixedListOpen(!isFixedListOpen)}
                            className="focus-ring-soft inline-flex items-center gap-2 rounded-[12px] border border-transparent px-2.5 py-1.5 text-fg-tertiary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default">
                            <Text as="span" variant="meta" weight="medium" tone="secondary">
                                {fixedPlaceholderCount} items
                            </Text>
                            {isFixedListOpen ? (
                                <Icon.TriangleUp className="h-4 w-4" />
                            ) : (
                                <Icon.TriangleDown className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                    {isFixedListOpen && (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {fixedPlaceholders.map(placeholder => (
                                <SurfaceCard key={placeholder.name} className={cardClassName}>
                                    <div className={cardBodyClassName}>
                                        <Text as="div" variant="body" weight="medium" className={cardTitleClassName}>
                                            {placeholder.name}
                                        </Text>
                                        <div className={cardMetaGroupClassName}>
                                            <Text
                                                as="div"
                                                variant="meta"
                                                weight="medium"
                                                tone="secondary"
                                                className={tokenPreviewClassName}>
                                                {PLACEHOLDER_PREFIX}{placeholder.template}{PLACEHOLDER_SUFFIX}
                                            </Text>
                                            <Text
                                                as="div"
                                                variant="label"
                                                weight="medium"
                                                tone="tertiary"
                                                className={valuePreviewClassName}>
                                                Current value: {placeholder.replacement}
                                            </Text>
                                        </div>
                                    </div>
                                </SurfaceCard>
                            ))}
                        </div>
                    )}
                </section>

                <section className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                            <Text as="p" variant="body" weight="medium">
                                Custom placeholders
                            </Text>
                            <Text as="p" variant="meta" tone="secondary">
                                Reusable variables you define for note cloning.
                            </Text>
                        </div>
                        {!isLoading && (
                            <Text as="span" variant="meta" weight="medium" tone="secondary">
                                {customPlaceholderCount === 1 ? '1 item' : `${customPlaceholderCount} items`}
                            </Text>
                        )}
                    </div>
                    {!isLoading && (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {customPlaceholders.map(placeholder => (
                                <SurfaceCard key={placeholder.id} className={`${cardClassName} relative`}>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="absolute right-2 top-2"
                                        onClick={() => removePlaceholder.mutate(placeholder.id.toString())}>
                                        <Icon.Close className="h-4 w-4" />
                                    </Button>
                                    <div className={cardBodyClassName}>
                                        <Text
                                            as="div"
                                            variant="body"
                                            weight="medium"
                                            className={`min-w-0 pr-8 ${cardTitleClassName}`}>
                                            {placeholder.name}
                                        </Text>
                                        <div className={cardMetaGroupClassName}>
                                            <Text
                                                as="div"
                                                variant="meta"
                                                weight="medium"
                                                tone="secondary"
                                                className={tokenPreviewClassName}>
                                                {PLACEHOLDER_PREFIX}{placeholder.template}{PLACEHOLDER_SUFFIX}
                                            </Text>
                                            <Text
                                                as="div"
                                                variant="label"
                                                weight="medium"
                                                tone="tertiary"
                                                className={valuePreviewClassName}>
                                                Replaces with: {placeholder.replacement}
                                            </Text>
                                        </div>
                                    </div>
                                </SurfaceCard>
                            ))}
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="focus-ring-soft surface-base group !bg-elevated flex flex-col items-center justify-center gap-0.5 !px-3 !py-2.5 text-center text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default">
                                <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border-subtle bg-surface text-current transition-colors group-hover:border-border-secondary/70">
                                    <Icon.Plus className="h-4.5 w-4.5" />
                                </span>
                                <Text
                                    as="div"
                                    variant="meta"
                                    weight="medium"
                                    tone="secondary"
                                    className="text-current">
                                    New custom
                                </Text>
                            </button>
                        </div>
                    )}
                </section>
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <Modal.Header title="Add Placeholder" onClose={() => setIsModalOpen(false)} />
                <Modal.Body>
                    <Modal.Description className="mb-4">
                        Create a reusable variable for note cloning.
                    </Modal.Description>
                    <div className="flex flex-col gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className={fieldLabelClassName}>Name</Label>
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
                            <Text as="p" variant="meta" tone="secondary">
                                Human-readable label shown in the list.
                            </Text>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="template" className={fieldLabelClassName}>Placeholder</Label>
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
                            <Text as="p" variant="meta" tone="secondary">
                                Used as {PLACEHOLDER_PREFIX}your_placeholder{PLACEHOLDER_SUFFIX}.
                            </Text>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="replacement" className={fieldLabelClassName}>Replacement</Label>
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
                            <Text as="p" variant="meta" tone="secondary">
                                Value inserted when the placeholder is resolved.
                            </Text>
                        </div>
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
