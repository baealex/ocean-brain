import { Link } from '@tanstack/react-router';
import { QueryBoundary, QueryErrorView } from '~/components/app';
import { BackReferences } from '~/components/entities';
import * as Icon from '~/components/icon';
import { Skeleton } from '~/components/shared';
import NoteContentSection from '~/components/shared/NoteContentSection';
import { Button, Text } from '~/components/ui';
import { NOTE_ROUTE } from '~/modules/url';

const NoteBackReferences = ({ noteId, targetTitle }: { noteId: string; targetTitle: string }) => (
    <QueryBoundary
        fallback={<Skeleton height={100} />}
        errorTitle="Failed to load back references"
        errorDescription="Retry loading notes that link back here."
        renderError={({ error, retry }) => (
            <QueryErrorView
                title="Failed to load back references"
                description="Retry loading notes that link back here."
                error={error}
                onRetry={retry}
                showBackAction={false}
                showHomeAction={false}
            />
        )}
    >
        <BackReferences
            noteId={noteId}
            render={(references, pagination) =>
                references.length || pagination.hasMore ? (
                    <NoteContentSection label="Back References">
                        <Text as="h2" variant="label" tone="tertiary" className="mb-3 flex items-center gap-2">
                            <Icon.LinkSimple className="size-3.5" aria-hidden="true" />
                            Back References
                        </Text>
                        <ul className="flex flex-col gap-4">
                            {references.map((reference) => (
                                <li key={reference.id} className="min-w-0">
                                    <Link
                                        to={NOTE_ROUTE}
                                        params={{ id: reference.id }}
                                        search={{ block: reference.contexts[0]?.blockId ?? undefined }}
                                        className="focus-ring-soft inline-flex max-w-full items-center gap-2 rounded-md text-sm font-medium text-fg-default outline-none hover:underline"
                                    >
                                        <Icon.FileNote
                                            className="size-3.5 shrink-0 text-fg-tertiary"
                                            aria-hidden="true"
                                        />
                                        <span className="truncate">{reference.title || 'Untitled'}</span>
                                    </Link>
                                    <ul className="mt-1 flex flex-col gap-1.5 pl-5.5">
                                        {reference.contexts.map((context, index) => (
                                            <li key={context.blockId ?? index}>
                                                <Link
                                                    to={NOTE_ROUTE}
                                                    params={{ id: reference.id }}
                                                    search={{ block: context.blockId ?? undefined }}
                                                    className="focus-ring-soft line-clamp-2 rounded-md text-sm leading-relaxed text-fg-secondary outline-none hover:text-fg-default"
                                                >
                                                    {context.segments.map((segment, index) =>
                                                        segment.isTarget ? (
                                                            <strong
                                                                key={index}
                                                                className="font-semibold text-fg-default"
                                                            >
                                                                {targetTitle || segment.text}
                                                            </strong>
                                                        ) : (
                                                            <span key={index}>{segment.text}</span>
                                                        ),
                                                    )}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                    {reference.hasMoreContexts ? (
                                        <Text as="p" variant="micro" tone="tertiary" className="mt-1 pl-5.5">
                                            More mentions in this note
                                        </Text>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                        {pagination.isError ? (
                            <Text as="p" variant="meta" tone="error" role="alert" className="mt-3">
                                Could not load more references.
                            </Text>
                        ) : null}
                        {pagination.hasMore ? (
                            <Button
                                type="button"
                                variant="subtle"
                                size="sm"
                                className="mt-3"
                                isLoading={pagination.isPending}
                                onClick={pagination.loadMore}
                            >
                                {pagination.isError ? 'Retry loading references' : 'Load more references'}
                            </Button>
                        ) : null}
                    </NoteContentSection>
                ) : null
            }
        />
    </QueryBoundary>
);

export default NoteBackReferences;
