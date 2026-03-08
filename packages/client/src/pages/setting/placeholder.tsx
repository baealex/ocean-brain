import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';

import {
    Button,
    Callout,
    FallbackRender,
    Modal,
    PageLayout,
    Pagination
} from '~/components/shared';
import { Input, Label, useToast } from '~/components/ui';
import * as Icon from '~/components/icon';

import { getFixedPlaceholders, PLACEHOLDER_PREFIX, PLACEHOLDER_SUFFIX } from '~/modules/fixed-placeholder';
import { queryKeys } from '~/modules/query-key-factory';
import { SETTINGS_PLACEHOLDER_ROUTE } from '~/modules/url';

import { createPlaceholder, deletePlaceholder, fetchPlaceholders } from '~/apis/placeholder.api';

const cardClassName = 'bg-subtle flex flex-col gap-1 p-4 rounded-[10px_3px_11px_3px/3px_8px_3px_10px] border-2 border-border-secondary font-bold';
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
                <div className="flex gap-2 items-center justify-between">
                    <span>Placeholders will be replaced with new note data during cloning.</span>
                    <Button onClick={() => setIsModalOpen(true)}>
                        <Icon.Plus width={20} height={20} />
                    </Button>
                </div>
            </Callout>
            <div className="flex flex-col gap-3 mt-3">
                <button
                    type="button"
                    onClick={() => setIsFixedListOpen(!isFixedListOpen)}
                    className="bg-subtle flex gap-2 items-center justify-between p-4 rounded-[10px_3px_11px_3px/3px_8px_3px_10px] border-2 border-border-secondary font-bold">
                    <div>System Placeholders</div>
                    <div className="w-6 h-6">
                        {isFixedListOpen ? <Icon.TriangleUp /> : <Icon.TriangleDown />}
                    </div>
                </button>
                {isFixedListOpen && (
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {fixedPlaceholders.map(placeholder => (
                            <div key={placeholder.name} className={cardClassName}>
                                <div className="text-sm">{placeholder.name}</div>
                                <div className="text-fg-tertiary text-xs font-medium">
                                    {PLACEHOLDER_PREFIX}{placeholder.template}{PLACEHOLDER_SUFFIX} → '{placeholder.replacement}'
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {!isLoading && placeholders?.placeholders && placeholders.placeholders.length > 0 && (
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {placeholders.placeholders.map(placeholder => (
                            <div key={placeholder.id} className={`${cardClassName} relative`}>
                                <div className="flex items-center justify-between">
                                    <div className="text-sm">{placeholder.name}</div>
                                    <button
                                        type="button"
                                        className="w-5 h-5 hover:text-red-500 transition-colors"
                                        onClick={() => removePlaceholder.mutate(placeholder.id.toString())}>
                                        <Icon.Close />
                                    </button>
                                </div>
                                <div className="text-fg-tertiary text-xs font-medium">
                                    {PLACEHOLDER_PREFIX}{placeholder.template}{PLACEHOLDER_SUFFIX} → '{placeholder.replacement}'
                                </div>
                            </div>
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
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button
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
                    </div>
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
