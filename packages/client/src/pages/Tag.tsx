import { getRouteApi, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { QueryBoundary } from '~/components/app';
import { Tags } from '~/components/entities';
import * as Icon from '~/components/icon';
import { Empty, FallbackRender, PageLayout, Pagination, Skeleton } from '~/components/shared';
import { Select, SelectItem, Text } from '~/components/ui';
import useDebounce from '~/hooks/useDebounce';
import type { TagRouteSearch } from '~/modules/route-search';
import { isTagLimit, TAG_DEFAULT_LIMIT, TAG_LIMIT_OPTIONS } from '~/modules/tag-pagination';
import { TAG_NOTES_ROUTE, TAG_ROUTE } from '~/modules/url';

const Route = getRouteApi(TAG_ROUTE);

export default function Tag() {
    const navigate = Route.useNavigate();
    const { page, query, limit, sortBy, sortOrder } = Route.useSearch();
    const [draftQuery, setDraftQuery] = useState(query);
    const [, setSearchEvent] = useDebounce(350);
    const normalizedQuery = query.trim();

    useEffect(() => {
        setDraftQuery(query);
    }, [query]);

    useEffect(() => {
        const nextQuery = draftQuery.trim();

        if (nextQuery === normalizedQuery) {
            return;
        }

        setSearchEvent(() => {
            navigate({
                search: (prev) => ({
                    ...prev,
                    page: 1,
                    query: nextQuery,
                }),
            });
        });
    }, [draftQuery, navigate, normalizedQuery, setSearchEvent]);

    const updateSearchParams = (updates: Partial<TagRouteSearch>) => {
        navigate({
            search: (prev) => ({
                ...prev,
                ...updates,
            }),
        });
    };

    const handleClearSearch = () => {
        setDraftQuery('');
        updateSearchParams({
            page: 1,
            query: '',
        });
    };

    return (
        <PageLayout title="Tags" description="Find tags you added with @ across your notes">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="surface-base flex min-w-0 items-center gap-2 rounded-[16px] px-3.5 py-2.5 lg:w-72">
                    <Icon.Search className="h-4 w-4 shrink-0 text-fg-tertiary" />
                    <Text as="span" variant="label" weight="medium" tone="tertiary">
                        Search
                    </Text>
                    <div className="h-5 w-px bg-divider" />
                    <input
                        aria-label="Search tags"
                        placeholder="Search tags"
                        value={draftQuery}
                        onChange={(event) => setDraftQuery(event.target.value)}
                        className="h-8 min-w-0 flex-1 bg-transparent text-sm font-medium text-fg-default outline-none placeholder:text-xs placeholder:font-medium placeholder:text-fg-placeholder"
                    />
                    {(draftQuery || normalizedQuery) && (
                        <button
                            type="button"
                            aria-label="Clear tag search"
                            className="focus-ring-soft flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-fg-tertiary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                            onClick={handleClearSearch}
                        >
                            <Icon.Close className="h-3.5 w-3.5" weight="bold" />
                        </button>
                    )}
                </div>

                <div className="surface-base inline-flex flex-wrap items-center gap-3 rounded-[16px] px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                        <Icon.Grid className="h-4 w-4 shrink-0 text-fg-tertiary" />
                        <Text as="span" variant="label" weight="medium" tone="tertiary">
                            Items
                        </Text>
                        <Select
                            value={String(limit)}
                            onValueChange={(value) => {
                                const nextLimit = Number(value);

                                if (isTagLimit(nextLimit)) {
                                    updateSearchParams({
                                        limit: nextLimit,
                                        page: 1,
                                    });
                                }
                            }}
                            variant="ghost"
                            size="sm"
                        >
                            {TAG_LIMIT_OPTIONS.map((option) => (
                                <SelectItem key={option} value={String(option)}>
                                    {option === TAG_DEFAULT_LIMIT ? `Default (${option})` : option}
                                </SelectItem>
                            ))}
                        </Select>
                    </div>

                    <div className="h-5 w-px bg-divider" />

                    <div className="flex items-center gap-2">
                        <Icon.SortAscending className="h-4 w-4 shrink-0 text-fg-tertiary" />
                        <Text as="span" variant="label" weight="medium" tone="tertiary">
                            Sort
                        </Text>
                        <Select
                            value={sortBy}
                            onValueChange={(value) =>
                                updateSearchParams({
                                    sortBy: value as TagRouteSearch['sortBy'],
                                    page: 1,
                                })
                            }
                            variant="ghost"
                            size="sm"
                        >
                            <SelectItem value="referenceCount">Usage</SelectItem>
                            <SelectItem value="name">Name</SelectItem>
                        </Select>
                        <Select
                            value={sortOrder}
                            onValueChange={(value) =>
                                updateSearchParams({
                                    sortOrder: value as TagRouteSearch['sortOrder'],
                                    page: 1,
                                })
                            }
                            variant="ghost"
                            size="sm"
                        >
                            <SelectItem value="desc">{sortBy === 'name' ? 'Z to A' : 'Most used'}</SelectItem>
                            <SelectItem value="asc">{sortBy === 'name' ? 'A to Z' : 'Least used'}</SelectItem>
                        </Select>
                    </div>
                </div>
            </div>

            <QueryBoundary
                fallback={
                    <div className="flex flex-wrap gap-2.5">
                        <Skeleton width="90px" height="36px" />
                        <Skeleton width="120px" height="36px" />
                        <Skeleton width="80px" height="36px" />
                        <Skeleton width="100px" height="36px" />
                        <Skeleton width="110px" height="36px" />
                        <Skeleton width="70px" height="36px" />
                    </div>
                }
                errorTitle="Failed to load tags"
                errorDescription="Retry loading the tag catalog"
                resetKeys={[page, limit, normalizedQuery, sortBy, sortOrder]}
            >
                <Tags
                    searchParams={{
                        query: normalizedQuery,
                        offset: (page - 1) * limit,
                        limit,
                        sortBy,
                        sortOrder,
                    }}
                    render={({ tags, totalCount }) => (
                        <FallbackRender
                            fallback={
                                <Empty
                                    title={normalizedQuery ? 'No matching tags' : 'No tags yet'}
                                    description={
                                        normalizedQuery
                                            ? 'Try another tag name'
                                            : 'Add @tags inside notes and they will appear here'
                                    }
                                />
                            }
                        >
                            {tags.length > 0 && (
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-wrap gap-2.5">
                                        {tags.map((tag) => (
                                            <Link
                                                key={tag.id}
                                                to={TAG_NOTES_ROUTE}
                                                params={{ id: tag.id }}
                                                search={{ page: 1 }}
                                                className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-hover-subtle px-3 py-1.5 text-fg-secondary transition-colors hover:border-border-secondary hover:bg-hover hover:text-fg-default"
                                            >
                                                <Text as="span" variant="meta" weight="medium" className="text-current">
                                                    {tag.name}
                                                </Text>
                                                <Text
                                                    as="span"
                                                    variant="label"
                                                    weight="medium"
                                                    tone="tertiary"
                                                    className="text-current/70"
                                                >
                                                    {tag.referenceCount}
                                                </Text>
                                            </Link>
                                        ))}
                                    </div>
                                    <FallbackRender fallback={null}>
                                        {totalCount && limit < totalCount && (
                                            <Pagination
                                                page={page}
                                                last={Math.ceil(totalCount / limit)}
                                                onChange={(page) => {
                                                    navigate({
                                                        search: (prev) => ({
                                                            ...prev,
                                                            page,
                                                            query: normalizedQuery,
                                                            limit,
                                                            sortBy,
                                                            sortOrder,
                                                        }),
                                                    });
                                                }}
                                            />
                                        )}
                                    </FallbackRender>
                                </div>
                            )}
                        </FallbackRender>
                    )}
                />
            </QueryBoundary>
        </PageLayout>
    );
}
