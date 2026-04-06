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
    Skeleton,
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
    const cardTitleClassName = 'leading-[1.2]';
    const tokenPreviewClassName = 'break-all leading-[1.2]';
    const valuePreviewClassName = 'leading-[1.2]';
    const cardBodyClassName = 'flex flex-col gap-px';
    const cardMetaGroupClassName = 'space-y-px';
    const sectionToggleClassName = 'focus-ring-soft inline-flex items-center gap-2 rounded-[12px] border border-transparent px-2.5 py-1.5 text-fg-tertiary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default';
    const customCardClassName = 'relative';
    const removePlaceholderButtonClassName = 'absolute right-2 top-2';
    const addCardButtonClassName = 'focus-ring-soft surface-base group flex flex-col items-center justify-center gap-0.5 px-4 py-4 text-center text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default';
    const addCardIconClassName = 'inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border-subtle bg-surface text-current transition-colors group-hover:border-border-secondary/70';
    const heading = customPlaceholderCount > 0
        ? `Placeholders (${customPlaceholderCount})`
        : undefined;
    const description = 'Create tokens that get replaced with values when you clone a note';

    return (
        <PageLayout
            title="Placeholders"
            variant="default"
            heading={isLoading ? <Skeleton width={244} height={24} className="rounded-full" /> : heading}
            description={isLoading ? <Skeleton width={260} height={16} className="rounded-full" /> : description}>
            <div className="flex flex-col gap-5">
                <section className="space-y-3 border-b border-border-subtle/80 pb-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                            <Text as="p" variant="body" weight="medium">
                                System placeholders
                            </Text>
                            <Text as="p" variant="meta" tone="secondary">
                                Built-in tokens for date and time that are always available when cloning notes
                            </Text>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsFixedListOpen(!isFixedListOpen)}
                            className={sectionToggleClassName}>
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
                        <div className="grid-auto-cards grid gap-5">
                            {fixedPlaceholders.map(placeholder => (
                                <SurfaceCard key={placeholder.name}>
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
                                Custom tokens you define once and reuse whenever you clone a note
                            </Text>
                        </div>
                        {!isLoading && (
                            <Text as="span" variant="meta" weight="medium" tone="secondary">
                                {customPlaceholderCount === 1 ? '1 item' : `${customPlaceholderCount} items`}
                            </Text>
                        )}
                    </div>
                    {!isLoading && (
                        <div className="grid-auto-cards grid gap-5">
                            {customPlaceholders.map(placeholder => (
                                <SurfaceCard
                                    key={placeholder.id}
                                    className={customCardClassName}>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className={removePlaceholderButtonClassName}
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
                                className={addCardButtonClassName}>
                                <span className={addCardIconClassName}>
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
                        Create a token that swaps in a value when you clone a note
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
                                A readable label so you can find this placeholder later
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
                                Use it in a note as {PLACEHOLDER_PREFIX}your_placeholder{PLACEHOLDER_SUFFIX}
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
                                This value is inserted when the placeholder is replaced during cloning
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
