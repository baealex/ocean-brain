import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@baejino/ui';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';

import {
    Button,
    Callout,
    FallbackRender,
    Modal,
    Pagination
} from '~/components/shared';
import * as Icon from '~/components/icon';

import { getFixedPlaceholders, PLACEHOLDER_PREFIX, PLACEHOLDER_SUFFIX } from '~/modules/fixed-placeholder';

import { createPlaceholder, deletePlaceholder, fetchPlaceholders } from '~/apis/placeholder.api';

import type { Placeholder } from '~/models/placeholder.model';

const cardClassName = 'bg-gray-100 dark:bg-zinc-900 flex gap-2 items-center justify-between p-4 rounded-md';

const Placeholder = () => {
    const queryClient = useQueryClient();

    const [searchParams, setSearchParams] = useSearchParams();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFixedListOpen, setIsFixedListOpen] = useState(false);

    const [form, setForm] = useState({
        name: '',
        template: '',
        replacement: ''
    });

    const limit = 25;
    const page = Number(searchParams.get('page')) || 1;

    const [fixedPlaceholders] = useState(getFixedPlaceholders);
    const { data: placeholders, isLoading } = useQuery({
        queryKey: ['placeholders', page],
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
            await queryClient.invalidateQueries({ queryKey: ['placeholders', page] });
        }
    });

    const removePlaceholder = useMutation({
        mutationFn: deletePlaceholder,
        onSuccess: async () => {
            toast('Placeholder deleted successfully');
            await queryClient.invalidateQueries({ queryKey: ['placeholders', page] });
        }
    });

    return (
        <div>
            <Callout className="mb-4">
                <div className="flex gap-2 items-center justify-between">
                    <span>Placeholders will be replaced with new note data during cloning.</span>
                    <Button onClick={() => setIsModalOpen(true)}>Add Placeholder</Button>
                </div>
            </Callout>
            <div className="flex flex-col gap-3 mt-3">
                <button
                    type="button"
                    onClick={() => setIsFixedListOpen(!isFixedListOpen)}
                    className={cardClassName}>
                    <div>System Placeholders</div>
                    <div className="w-6 h-6">
                        {isFixedListOpen ? <Icon.TriangleUp /> : <Icon.TriangleDown />}
                    </div>
                </button>
                {isFixedListOpen && fixedPlaceholders.map(placeholder => (
                    <div key={placeholder.name} className={cardClassName}>
                        <div className="flex gap-2 items-center">
                            {placeholder.name} <span className="text-gray-500 text-xs">{PLACEHOLDER_PREFIX}{placeholder.template}{PLACEHOLDER_SUFFIX} will be '{placeholder.replacement}'</span>
                        </div>
                    </div>
                ))}
                {!isLoading && placeholders?.placeholders && placeholders.placeholders.map(placeholder => (
                    <div key={placeholder.id} className={cardClassName}>
                        <div className="flex gap-2 items-center">
                            {placeholder.name} <span className="text-gray-500 text-xs">{PLACEHOLDER_PREFIX}{placeholder.template}{PLACEHOLDER_SUFFIX} will be '{placeholder.replacement}'</span>
                        </div>
                        <button
                            type="button"
                            className="w-6 h-6"
                            onClick={() => removePlaceholder.mutate(placeholder.id.toString())}>
                            <Icon.Close />
                        </button>
                    </div>
                ))}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <Modal.Header title="Add Placeholder" onClose={() => setIsModalOpen(false)} />
                <Modal.Body>
                    <div className="flex flex-col gap-3">
                        <label htmlFor="name">Name:</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({
                                ...form,
                                name: e.target.value
                            })}
                            className="w-full p-2 rounded-md bg-gray-100 dark:bg-zinc-800"
                            placeholder="Description of this placeholder"
                        />
                        <label htmlFor="template">Placeholder:</label>
                        <input
                            type="text"
                            value={form.template}
                            onChange={(e) => setForm({
                                ...form,
                                template: e.target.value
                            })}
                            className="w-full p-2 rounded-md bg-gray-100 dark:bg-zinc-800"
                            placeholder="note_app"
                        />
                        <label htmlFor="replacement">Replacement:</label>
                        <input
                            type="text"
                            value={form.replacement}
                            onChange={(e) => setForm({
                                ...form,
                                replacement: e.target.value
                            })}
                            className="w-full p-2 rounded-md bg-gray-100 dark:bg-zinc-800"
                            placeholder="Ocean Brain"
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <div className="flex gap-2">
                        <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
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
                            setSearchParams(searchParams => {
                                searchParams.set('page', page.toString());
                                return searchParams;
                            });
                        }}
                    />
                )}
            </FallbackRender>
        </div>
    );
};

export default Placeholder;
