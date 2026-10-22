import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { fetchIntegrations, type IntegrationConnection } from '~/apis/integration.api';
import {
    fetchNavigationSettings,
    type NavigationSettings,
    saveNavigationSettings,
} from '~/apis/navigation-settings.api';
import * as Icon from '~/components/icon';
import { CORE_NAVIGATION_ITEMS } from '~/components/layout/SiteLayout/navigation-items';
import { PageLayout } from '~/components/shared';
import { Button, Switch, Text } from '~/components/ui';
import {
    integrationMenuId,
    isCoreMenuVisible,
    orderNavigationItems,
    replaceKnownMenuOrder,
} from '~/modules/navigation-preferences';
import { queryKeys } from '~/modules/query-key-factory';

interface MenuItem {
    id: string;
    name: string;
    icon: typeof Icon.Menu | typeof Icon.Graph;
    integration?: IntegrationConnection;
}

function MenuRow({
    item,
    visible,
    disabled,
    onVisibleChange,
}: {
    item: MenuItem;
    visible: boolean;
    disabled: boolean;
    onVisibleChange: (visible: boolean) => void;
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
        disabled,
    });
    const alwaysVisible = item.id === 'core:settings';
    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`surface-base flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3 ${isDragging ? 'relative z-10 opacity-70' : ''}`}
        >
            <Button
                variant="ghost"
                size="icon"
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                aria-label={`Reorder ${item.name}`}
                disabled={disabled}
                className="touch-none cursor-grab active:cursor-grabbing"
            >
                <Icon.DragHandle aria-hidden="true" className="size-4" />
            </Button>
            <item.icon aria-hidden="true" className="size-5 shrink-0 text-fg-secondary" />
            <div className="min-w-0 flex-1">
                <Text as="span" variant="body" weight="medium" className="block truncate">
                    {item.name}
                </Text>
                {item.integration && (
                    <Text as="span" variant="meta" tone="tertiary">
                        {item.integration.enabled ? 'App' : 'App · disabled'}
                    </Text>
                )}
            </div>
            <Switch
                aria-label={`Show ${item.name} in top bar`}
                title={alwaysVisible ? 'Settings is always visible' : undefined}
                checked={visible}
                disabled={disabled || alwaysVisible}
                onCheckedChange={onVisibleChange}
            />
        </li>
    );
}

function MenuEditor({
    settings,
    integrations,
    onSaved,
    onReload,
}: {
    settings: NavigationSettings;
    integrations: IntegrationConnection[];
    onSaved: (settings: NavigationSettings) => Promise<void>;
    onReload: () => Promise<void>;
}) {
    const [initial] = useState(() => {
        const items: MenuItem[] = [
            ...CORE_NAVIGATION_ITEMS,
            ...integrations
                .filter((integration) => integration.manifest.launch)
                .map((integration) => ({
                    id: integrationMenuId(integration.id),
                    name: integration.manifest.name,
                    icon: Icon.LinkIcon,
                    integration,
                })),
        ];
        return {
            settings,
            items: orderNavigationItems(items, settings.preferences?.order),
            hidden: settings.preferences?.hiddenCoreIds ?? [],
            pins: Object.fromEntries(integrations.map((integration) => [integration.id, integration.pinned])),
        };
    });
    const [items, setItems] = useState(initial.items);
    const [hidden, setHidden] = useState(initial.hidden);
    const [pins, setPins] = useState(initial.pins);
    const mutation = useMutation({ mutationFn: saveNavigationSettings, onSuccess: onSaved });
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const dirty =
        JSON.stringify(items.map((item) => item.id)) !== JSON.stringify(initial.items.map((item) => item.id)) ||
        JSON.stringify([...hidden].sort()) !== JSON.stringify([...initial.hidden].sort()) ||
        Object.keys(pins).some((id) => pins[id] !== initial.pins[id]);
    const disabled = mutation.isPending || settings.status !== 'ready';
    const isVisible = (item: MenuItem) =>
        item.integration
            ? Boolean(pins[item.integration.id])
            : isCoreMenuVisible(item.id, { schemaVersion: 1, order: [], hiddenCoreIds: hidden });
    const move = (from: number, to: number) => {
        if (from >= 0 && to >= 0 && to < items.length) setItems(arrayMove(items, from, to));
    };
    const save = () =>
        mutation.mutate({
            expectedRevision: initial.settings.revision,
            preferences: {
                ...initial.settings.preferences,
                schemaVersion: 1,
                order: replaceKnownMenuOrder(
                    initial.settings.preferences?.order ?? [],
                    items.map((item) => item.id),
                ),
                hiddenCoreIds: hidden,
            },
            pins: initial.items.flatMap((item) =>
                item.integration && pins[item.integration.id] !== item.integration.pinned
                    ? [
                          {
                              id: item.integration.id,
                              pinned: pins[item.integration.id],
                              expectedUpdatedAt: item.integration.updatedAt,
                          },
                      ]
                    : [],
            ),
        });
    const error = axios.isAxiosError<{ message?: string }>(mutation.error)
        ? (mutation.error.response?.data?.message ?? mutation.error.message)
        : mutation.error?.message;

    return (
        <div className="flex flex-col gap-5">
            {settings.status !== 'ready' && (
                <p role="alert" className="text-sm text-fg-secondary">
                    {settings.status === 'unsupported'
                        ? 'Update Ocean Brain to edit these saved menu settings.'
                        : 'Saved menu settings could not be read. Reset the layout to restore the default menus.'}
                </p>
            )}
            <section aria-label="Menu preview" className="border-b border-border-subtle pb-4">
                <Text as="h2" variant="label" tone="tertiary" className="mb-2">
                    Preview
                </Text>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-secondary">
                    {items
                        .filter((item) => isVisible(item) && (!item.integration || item.integration.enabled))
                        .map((item) => (
                            <span key={item.id} className="inline-flex items-center gap-1.5">
                                <item.icon aria-hidden="true" className="size-4" />
                                {item.name}
                            </span>
                        ))}
                </div>
            </section>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={({ active, over }) => {
                    if (over && active.id !== over.id)
                        move(
                            items.findIndex((item) => item.id === active.id),
                            items.findIndex((item) => item.id === over.id),
                        );
                }}
            >
                <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                    <ol aria-label="Top bar menus" className="flex flex-col gap-2">
                        {items.map((item) => (
                            <MenuRow
                                key={item.id}
                                item={item}
                                visible={isVisible(item)}
                                disabled={disabled}
                                onVisibleChange={(visible) =>
                                    item.integration
                                        ? setPins({ ...pins, [item.integration.id]: visible })
                                        : setHidden(
                                              visible ? hidden.filter((id) => id !== item.id) : [...hidden, item.id],
                                          )
                                }
                            />
                        ))}
                    </ol>
                </SortableContext>
            </DndContext>
            <Text as="p" variant="meta" tone="tertiary">
                Settings stays visible. Disabled apps appear after they are enabled in Integrations.
            </Text>
            {error && (
                <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
                    <span>{error}</span>
                    <Button variant="subtle" onClick={onReload}>
                        Reload saved settings
                    </Button>
                </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <Button disabled={disabled || !dirty} isLoading={mutation.isPending} onClick={save}>
                    Save changes
                </Button>
                <Button
                    variant="subtle"
                    disabled={mutation.isPending || !dirty}
                    onClick={() => {
                        setItems(initial.items);
                        setHidden(initial.hidden);
                        setPins(initial.pins);
                        mutation.reset();
                    }}
                >
                    Cancel
                </Button>
                <Button
                    variant="ghost"
                    className="sm:ml-auto"
                    disabled={mutation.isPending || settings.status === 'unsupported' || (!settings.revision && !dirty)}
                    onClick={() => mutation.mutate({ expectedRevision: initial.settings.revision, preferences: null })}
                >
                    Reset menu layout
                </Button>
            </div>
        </div>
    );
}

export default function NavigationSettingsPage() {
    const queryClient = useQueryClient();
    const settings = useQuery({ queryKey: queryKeys.navigation.settings(), queryFn: fetchNavigationSettings });
    const integrations = useQuery({ queryKey: queryKeys.integrations.list(), queryFn: fetchIntegrations });
    const [generation, setGeneration] = useState(0);
    const reload = async () => {
        await Promise.all([settings.refetch(), integrations.refetch()]);
        setGeneration((value) => value + 1);
    };
    return (
        <PageLayout title="Navigation" description="Choose which menus appear in the top bar and arrange their order.">
            <div className="w-full">
                {!settings.data ? (
                    settings.isPending ? (
                        <Text as="p">Loading menu settings…</Text>
                    ) : (
                        <div role="alert">
                            <Text as="p">Could not load menu settings.</Text>
                            <Button onClick={reload}>Retry</Button>
                        </div>
                    )
                ) : (
                    <>
                        {integrations.isError && (
                            <p role="alert" className="mb-4 text-sm">
                                Apps could not be loaded. You can still edit built-in menus.{' '}
                                <Button variant="ghost" onClick={reload}>
                                    Retry
                                </Button>
                            </p>
                        )}
                        {!integrations.isPending && (
                            <MenuEditor
                                key={generation}
                                settings={settings.data}
                                integrations={integrations.data ?? []}
                                onReload={reload}
                                onSaved={async (saved) => {
                                    queryClient.setQueryData(queryKeys.navigation.settings(), saved);
                                    await queryClient.invalidateQueries({
                                        queryKey: queryKeys.integrations.list(),
                                        exact: true,
                                    });
                                    setGeneration((value) => value + 1);
                                }}
                            />
                        )}
                    </>
                )}
            </div>
        </PageLayout>
    );
}
