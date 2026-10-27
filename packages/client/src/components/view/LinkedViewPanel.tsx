import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { fetchAllNotePropertyKeys } from '~/apis/note.api';
import { fetchViewWorkspace } from '~/apis/view.api';
import { Dropdown, SurfaceCard } from '~/components/shared';
import { Button, Input, MoreButton, Text } from '~/components/ui';
import type { View } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import { VIEWS_ROUTE } from '~/modules/url';
import { getViewDisplayTypeLabel } from '~/modules/view-dashboard';
import type { ViewNavigationState } from '~/modules/view-route-state';
import ViewCard from './ViewCard';

interface LinkedViewPanelProps {
    viewId: string;
    viewTitle: string;
    editable: boolean;
    onSelect: (view: View) => void;
    onRemove: () => void;
}

const LinkedViewPanel = ({ viewId, viewTitle, editable, onSelect, onRemove }: LinkedViewPanelProps) => {
    const navigate = useNavigate();
    const [choosing, setChoosing] = useState(!viewId);
    const [search, setSearch] = useState('');
    const { data, isPending, isError, refetch } = useQuery({
        queryKey: queryKeys.views.workspace(),
        async queryFn() {
            const response = await fetchViewWorkspace();
            if (response.type === 'error') throw response;
            return response.viewWorkspace;
        },
    });
    const groups = data?.groups ?? [];
    const group = groups.find((candidate) => candidate.views.some((view) => view.id === viewId));
    const view = group?.views.find((candidate) => candidate.id === viewId);
    const openView = () => void navigate({ to: VIEWS_ROUTE, search: { group: view?.groupId } });
    const changeView = () => {
        setSearch('');
        setChoosing(true);
    };
    const actions = (
        <Dropdown
            button={<MoreButton label="Linked view actions" />}
            items={[
                { name: 'Open view in Views', onClick: openView },
                ...(editable
                    ? [
                          { name: 'Change linked view', onClick: changeView },
                          { name: 'Remove linked view', onClick: onRemove },
                      ]
                    : []),
            ]}
        />
    );

    if (isPending || isError)
        return (
            <SurfaceCard className="p-4">
                <Text as="p" variant="body">
                    {isError ? 'Failed to load linked views.' : 'Loading linked view...'}
                </Text>
                {isError ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => void refetch()}>
                        Retry
                    </Button>
                ) : null}
            </SurfaceCard>
        );

    if (choosing && editable) {
        const query = search.trim().toLowerCase();
        const matches = groups.flatMap((entry) =>
            entry.views
                .filter((item) => `${entry.title} ${item.title}`.toLowerCase().includes(query))
                .map((item) => ({ view: item, groupTitle: entry.title })),
        );
        return (
            <SurfaceCard className="space-y-3 p-4">
                <Text as="h3" variant="subheading" weight="semibold">
                    Link an existing view
                </Text>
                <Text as="p" variant="meta" tone="tertiary">
                    Show this view's current results here. Its filters stay shared with the original view.
                </Text>
                <Input
                    aria-label="Search views"
                    placeholder="Search by view or group name"
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
                <ul aria-label="Available views" className="max-h-64 space-y-1 overflow-y-auto">
                    {matches.map(({ view: item, groupTitle }) => (
                        <li key={item.id}>
                            <Button
                                type="button"
                                variant="ghost"
                                className="h-auto w-full justify-start text-left"
                                onClick={() => {
                                    onSelect(item);
                                    setChoosing(false);
                                }}
                            >
                                <span className="flex min-w-0 flex-col">
                                    <span className="truncate">{item.title}</span>
                                    <Text as="span" variant="meta" tone="tertiary">
                                        {groupTitle} · {getViewDisplayTypeLabel(item.displayType)}
                                    </Text>
                                </span>
                            </Button>
                        </li>
                    ))}
                </ul>
                {!matches.length ? (
                    <Text as="p" variant="meta" tone="tertiary">
                        {groups.some((entry) => entry.views.length)
                            ? 'No views match your search.'
                            : 'Create a saved view in Views, then link it here.'}
                    </Text>
                ) : null}
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => (viewId ? setChoosing(false) : onRemove())}
                    >
                        Cancel
                    </Button>
                    <Link to={VIEWS_ROUTE} className="text-sm text-accent-primary underline">
                        Open Views
                    </Link>
                </div>
            </SurfaceCard>
        );
    }

    if (!view)
        return (
            <SurfaceCard className="space-y-2 p-4">
                <Text as="h3" variant="subheading" weight="semibold">
                    Linked view is unavailable
                </Text>
                <Text as="p" variant="meta" tone="tertiary">
                    {viewTitle || 'The linked view'} may have been deleted. The rest of this note is still available.
                </Text>
                {editable ? (
                    <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={changeView}>
                            Choose another view
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                            Remove linked view
                        </Button>
                    </div>
                ) : null}
            </SurfaceCard>
        );

    return (
        <div className="space-y-2">
            <Text as="p" variant="meta" tone="tertiary">
                Linked view · {group?.title}
            </Text>
            <LinkedViewPreview key={view.id} view={view} readOnly={!editable} onEdit={openView} actions={actions} />
        </div>
    );
};

const LinkedViewPreview = ({
    view,
    onEdit,
    actions,
    readOnly,
}: {
    view: View;
    onEdit: () => void;
    actions: React.ReactNode;
    readOnly: boolean;
}) => {
    const [navigationState, setNavigationState] = useState<ViewNavigationState>({});
    const properties = useQuery({
        queryKey: queryKeys.notes.propertyKeysCatalog(),
        async queryFn() {
            const response = await fetchAllNotePropertyKeys();
            if (response.type === 'error') throw response;
            return response.notePropertyKeys;
        },
    });
    return (
        <ViewCard
            readOnly={readOnly}
            view={view}
            onEdit={onEdit}
            headerActions={actions}
            availableProperties={properties.data?.keys ?? []}
            isPropertiesLoading={properties.isPending}
            isPropertiesError={properties.isError}
            onRetryProperties={() => void properties.refetch()}
            navigationState={navigationState}
            onNavigationStateChange={(update) =>
                setNavigationState((current) => (typeof update === 'function' ? update(current) : update))
            }
        />
    );
};

export default LinkedViewPanel;
