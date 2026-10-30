import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { fetchView, fetchViewWorkspace } from '~/apis/view.api';
import * as Icon from '~/components/icon';
import { Dropdown } from '~/components/shared';
import NoteContentSection from '~/components/shared/NoteContentSection';
import { Button, Input, MoreButton, Text } from '~/components/ui';
import type { View } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import { VIEWS_ROUTE } from '~/modules/url';
import { getViewDisplayTypeLabel } from '~/modules/view-dashboard';
import { useWorkspace } from '~/store/workspace';
import LinkedViewContent from './LinkedViewContent';

interface LinkedViewPanelProps {
    viewId: string;
    viewTitle: string;
    editable: boolean;
    onSelect: (view: View) => void;
    onRemove: () => void;
}

const LinkedViewPanel = ({ viewId, viewTitle, editable, onSelect, onRemove }: LinkedViewPanelProps) => {
    const navigate = useNavigate();
    const { workspaceId, multiple } = useWorkspace();
    const [choosing, setChoosing] = useState(!viewId);
    const [search, setSearch] = useState('');
    const { data, isPending, isError, refetch } = useQuery({
        queryKey: queryKeys.views.workspace(workspaceId),
        async queryFn() {
            const response = await fetchViewWorkspace(workspaceId);
            if (response.type === 'error') throw response;
            return response.viewWorkspace;
        },
    });
    const groups = data?.groups ?? [];
    const group = groups.find((candidate) => candidate.views.some((view) => view.id === viewId));
    const localView = group?.views.find((candidate) => candidate.id === viewId);
    const linked = useQuery({
        queryKey: queryKeys.views.view(viewId),
        enabled: Boolean(viewId && data && !localView),
        queryFn: async () => {
            const response = await fetchView(viewId);
            if (response.type === 'error') throw response;
            return response.view;
        },
    });
    const view = localView ?? linked.data;
    const openView = () =>
        void navigate({
            to: VIEWS_ROUTE,
            search: { group: view?.groupId, ...(multiple ? { workspace: view?.workspaceId ?? workspaceId } : {}) },
        });
    const changeView = () => {
        setSearch('');
        setChoosing(true);
    };
    const closeChooser = () => (viewId ? setChoosing(false) : onRemove());
    const selectView = (selected: View) => {
        onSelect(selected);
        setChoosing(false);
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
            <NoteContentSection className="space-y-3">
                <Text as="p" variant="body">
                    {isError ? 'Failed to load linked views.' : 'Loading linked view...'}
                </Text>
                {isError ? (
                    <Button type="button" variant="subtle" size="sm" onClick={() => void refetch()}>
                        Retry
                    </Button>
                ) : null}
            </NoteContentSection>
        );

    if (choosing && editable) {
        const query = search.trim().toLowerCase();
        const matches = groups.flatMap((entry) =>
            entry.views
                .filter((item) => `${entry.title} ${item.title}`.toLowerCase().includes(query))
                .map((item) => ({ view: item, groupTitle: entry.title })),
        );
        return (
            <NoteContentSection>
                <div className="w-full max-w-[520px] space-y-2">
                    <div className="flex min-h-8 items-center justify-between gap-2">
                        <Text as="h3" variant="body" weight="semibold">
                            Choose view
                        </Text>
                        <Button
                            type="button"
                            variant="subtle"
                            size="icon-sm"
                            aria-label="Cancel"
                            title="Cancel"
                            onClick={closeChooser}
                        >
                            <Icon.Close className="size-3.5" />
                        </Button>
                    </div>
                    <Input
                        aria-label="Search views"
                        placeholder="Search views or groups"
                        size="sm"
                        autoFocus
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.nativeEvent.isComposing) return;
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                event.stopPropagation();
                                closeChooser();
                            }
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                event.stopPropagation();
                                if (matches.length === 1 && matches[0]) selectView(matches[0].view);
                            }
                        }}
                    />
                    <ul aria-label="Available views" className="flex max-h-52 flex-col overflow-y-auto">
                        {matches.map(({ view: item, groupTitle }) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    className="focus-ring-soft flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-hover-subtle focus-visible:bg-hover-subtle"
                                    onClick={() => selectView(item)}
                                >
                                    <span className="min-w-0 flex-1 truncate text-fg-default">{item.title}</span>
                                    <span className="max-w-[45%] truncate text-xs text-fg-tertiary">
                                        {groupTitle} · {getViewDisplayTypeLabel(item.displayType)}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    {!matches.length ? (
                        <Text as="p" variant="meta" tone="tertiary">
                            {groups.some((entry) => entry.views.length) ? 'No matching views.' : 'No saved views yet.'}
                        </Text>
                    ) : null}
                    {!groups.some((entry) => entry.views.length) ? (
                        <Button asChild variant="subtle" size="sm">
                            <Link to={VIEWS_ROUTE} search={multiple ? { workspace: workspaceId } : {}}>
                                Open Views
                            </Link>
                        </Button>
                    ) : null}
                </div>
            </NoteContentSection>
        );
    }

    if (!view && linked.isFetching)
        return (
            <NoteContentSection>
                <Text as="p" variant="meta">
                    Loading linked view...
                </Text>
            </NoteContentSection>
        );

    if (!view)
        return (
            <NoteContentSection className="space-y-2">
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
            </NoteContentSection>
        );

    return <LinkedViewContent key={view.id} view={view} readOnly={!editable} onEdit={openView} actions={actions} />;
};

export default LinkedViewPanel;
