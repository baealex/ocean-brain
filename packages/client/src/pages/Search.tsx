import { getRouteApi, Link } from '@tanstack/react-router';

import { QueryBoundary } from '~/components/app';
import { Notes } from '~/components/entities';
import { Empty, Highlight, PageLayout, Pagination, Skeleton } from '~/components/shared';
import { Text } from '~/components/ui';

import { NOTE_ROUTE, SEARCH_ROUTE } from '~/modules/url';

const Route = getRouteApi(SEARCH_ROUTE);
const MAX_SEARCH_SNIPPET_LENGTH = 180;

const normalizeSearchText = (value: string) => value.replace(/\s+/g, ' ').trim();

const buildSearchExcerpt = (text: string, query: string) => {
    const normalizedText = normalizeSearchText(text);
    const normalizedQuery = normalizeSearchText(query).toLowerCase();

    if (!normalizedQuery) {
        return normalizedText;
    }

    const matchIndex = normalizedText.toLowerCase().indexOf(normalizedQuery);

    if (matchIndex === -1) {
        return normalizedText.length > MAX_SEARCH_SNIPPET_LENGTH
            ? `${normalizedText.slice(0, MAX_SEARCH_SNIPPET_LENGTH - 1).trimEnd()}…`
            : normalizedText;
    }

    const excerptStart = Math.max(0, matchIndex - 56);
    const excerptEnd = Math.min(normalizedText.length, matchIndex + normalizedQuery.length + 84);

    let snippet = normalizedText.slice(excerptStart, excerptEnd).trim();

    if (excerptStart > 0) {
        snippet = `…${snippet}`;
    }

    if (excerptEnd < normalizedText.length) {
        snippet = `${snippet}…`;
    }

    return snippet;
};

const getInlineText = (content: unknown) => {
    if (!Array.isArray(content)) {
        return '';
    }

    return content
        .map((item) => {
            if (!item || typeof item !== 'object') {
                return '';
            }

            const text = (item as { text?: unknown }).text;
            return typeof text === 'string' ? text : '';
        })
        .join('');
};

const getBlockLabel = (type?: string, props?: Record<string, unknown>) => {
    if (type === 'heading') {
        const level = typeof props?.level === 'number' ? props.level : 1;
        return `Heading ${level}`;
    }

    if (type === 'bulletListItem') {
        return 'Bullet';
    }

    if (type === 'numberedListItem') {
        return 'Numbered';
    }

    if (type === 'checkListItem') {
        return 'Checklist';
    }

    if (type === 'quote') {
        return 'Quote';
    }

    if (type === 'codeBlock') {
        return 'Code';
    }

    return 'Content';
};

interface SearchPreviewBlock {
    label: string;
    text: string;
}

const collectPreviewBlocks = (nodes: unknown, blocks: SearchPreviewBlock[]) => {
    if (!Array.isArray(nodes)) {
        return;
    }

    nodes.forEach((node) => {
        if (!node || typeof node !== 'object') {
            return;
        }

        const type =
            typeof (node as { type?: unknown }).type === 'string' ? (node as { type: string }).type : undefined;
        const props =
            typeof (node as { props?: unknown }).props === 'object' && (node as { props?: unknown }).props
                ? (node as { props: Record<string, unknown> }).props
                : undefined;
        const text = normalizeSearchText(getInlineText((node as { content?: unknown }).content));

        if (text) {
            blocks.push({
                label: getBlockLabel(type, props),
                text,
            });
        }

        const children = (node as { children?: unknown }).children;
        if (Array.isArray(children)) {
            collectPreviewBlocks(children, blocks);
        }
    });
};

const getSearchPreviewBlocks = (content: string, query: string) => {
    try {
        const parsed = JSON.parse(content) as unknown;
        const blocks: SearchPreviewBlock[] = [];

        collectPreviewBlocks(parsed, blocks);

        if (blocks.length === 0) {
            return [];
        }

        const normalizedQuery = normalizeSearchText(query).toLowerCase();
        const matchingBlocks = normalizedQuery
            ? blocks.filter((block) => block.text.toLowerCase().includes(normalizedQuery))
            : blocks;
        const selectedBlocks = (matchingBlocks.length > 0 ? matchingBlocks : blocks).slice(0, 2);

        return selectedBlocks.map((block) => ({
            ...block,
            text: buildSearchExcerpt(block.text, query),
        }));
    } catch {
        return [];
    }
};

const formatResultCount = (count: number) => (count === 1 ? '1 result' : `${count} results`);

const getSearchFallbackPreview = () => 'Open the note to inspect matching content.';
const getSearchDescription = (query: string, totalCount: number) => `${formatResultCount(totalCount)} for "${query}"`;

const SearchResultsSkeleton = () => (
    <PageLayout
        title="Search"
        variant="default"
        description={<Skeleton width={208} height={16} className="rounded-full" />}
    >
        <main className="flex flex-col gap-3">
            {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="surface-base flex flex-col gap-3 p-4">
                    <Skeleton width="34%" height={18} className="rounded-full" />
                    <div className="rounded-[14px] bg-muted px-3 py-3">
                        <div className="flex flex-col gap-2">
                            <div>
                                <Skeleton width={84} height={12} className="rounded-full" />
                                <Skeleton width="100%" height={14} className="mt-2 rounded-full" />
                                <Skeleton width="82%" height={14} className="mt-1.5 rounded-full" />
                            </div>
                            <div className="border-t border-border-subtle pt-2">
                                <Skeleton width={72} height={12} className="rounded-full" />
                                <Skeleton width="94%" height={14} className="mt-2 rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </main>
    </PageLayout>
);

export default function Search() {
    const navigate = Route.useNavigate();
    const { page, query } = Route.useSearch();
    const normalizedQuery = query.trim();

    const limit = 10;

    if (!normalizedQuery) {
        return (
            <PageLayout
                title="Search"
                description="Search note titles and matching sections across your workspace"
                variant="default"
            >
                <main>
                    <Empty
                        title="Start searching"
                        description="Enter a keyword to look through note titles and matching content"
                    />
                </main>
            </PageLayout>
        );
    }

    return (
        <QueryBoundary
            fallback={<SearchResultsSkeleton />}
            errorTitle="Failed to load search results"
            errorDescription={`Retry loading results for "${normalizedQuery}".`}
            resetKeys={[normalizedQuery, page]}
        >
            <Notes
                searchParams={{
                    query: normalizedQuery,
                    limit,
                    offset: (page - 1) * limit,
                    fields: ['content'],
                }}
                render={({ notes, totalCount }) => (
                    <PageLayout
                        title="Search"
                        description={getSearchDescription(normalizedQuery, totalCount)}
                        variant="default"
                    >
                        <main className="flex flex-col gap-4">
                            {notes.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                    {notes.map((note) => {
                                        const previewBlocks = getSearchPreviewBlocks(note.content, normalizedQuery);

                                        return (
                                            <article key={note.id} className="surface-base flex flex-col gap-3 p-4">
                                                <Text as="h2" variant="body" weight="semibold" tracking="tight">
                                                    <Link
                                                        to={NOTE_ROUTE}
                                                        params={{ id: note.id }}
                                                        className="transition-colors hover:text-fg-default/85"
                                                    >
                                                        <Highlight match={normalizedQuery}>
                                                            {note.title || 'Untitled'}
                                                        </Highlight>
                                                    </Link>
                                                </Text>
                                                {previewBlocks.length > 0 ? (
                                                    <div className="rounded-[14px] bg-muted px-3 py-3">
                                                        <div className="flex flex-col gap-2">
                                                            {previewBlocks.map((block, index) => (
                                                                <div
                                                                    key={`${note.id}:${block.label}:${index}`}
                                                                    className={
                                                                        index > 0
                                                                            ? 'border-t border-border-subtle pt-2'
                                                                            : undefined
                                                                    }
                                                                >
                                                                    <Text
                                                                        as="div"
                                                                        variant="micro"
                                                                        weight="semibold"
                                                                        tracking="wider"
                                                                        transform="uppercase"
                                                                        tone="tertiary"
                                                                    >
                                                                        {block.label}
                                                                    </Text>
                                                                    <Text
                                                                        as="p"
                                                                        variant="meta"
                                                                        tone="secondary"
                                                                        className="mt-1 leading-[1.65]"
                                                                    >
                                                                        <Highlight match={normalizedQuery}>
                                                                            {block.text}
                                                                        </Highlight>
                                                                    </Text>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Text
                                                        as="p"
                                                        variant="meta"
                                                        tone="secondary"
                                                        className="leading-[1.65]"
                                                    >
                                                        {getSearchFallbackPreview()}
                                                    </Text>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Empty
                                    title="No results found"
                                    description="Try searching for a different word or phrase"
                                />
                            )}
                            {totalCount > limit && (
                                <Pagination
                                    page={page}
                                    last={Math.ceil(totalCount / limit)}
                                    onChange={(page) => {
                                        navigate({
                                            search: (prev) => ({
                                                ...prev,
                                                page,
                                            }),
                                        });
                                    }}
                                />
                            )}
                        </main>
                    </PageLayout>
                )}
            />
        </QueryBoundary>
    );
}
