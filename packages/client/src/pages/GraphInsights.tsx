import { useState } from 'react';
import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import { GraphUnlinkedNotesPanel } from './GraphUnlinkedNotesPanel';
import type { GraphVisualNode } from './graph-data';

interface GraphInsightsProps {
    isolatedNodes: GraphVisualNode[];
}

export function GraphInsights({ isolatedNodes }: GraphInsightsProps) {
    const [isReviewOpen, setIsReviewOpen] = useState(false);

    return (
        <section
            aria-labelledby="graph-insights-heading"
            className="surface-base mt-4 overflow-hidden rounded-[16px] border border-border-subtle/80"
        >
            <div className="flex flex-col gap-1 border-b border-border-subtle/80 px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 items-start gap-2.5">
                    <Icon.Info className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
                    <div className="min-w-0">
                        <Text id="graph-insights-heading" as="h2" variant="subheading" weight="semibold">
                            Next steps
                        </Text>
                        <Text as="p" variant="label" tone="tertiary" className="mt-1">
                            Keep your graph healthy by reviewing notes that are not connected yet.
                        </Text>
                    </div>
                </div>
            </div>

            {isolatedNodes.length > 0 ? (
                <>
                    <div className="p-3 sm:p-4">
                        <article className="flex min-w-0 flex-col rounded-[14px] border border-border-subtle bg-surface px-3.5 py-3">
                            <div className="flex items-start gap-2.5">
                                <Icon.LinkSimple
                                    className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary"
                                    aria-hidden="true"
                                />
                                <div className="min-w-0">
                                    <Text as="h3" variant="label" weight="semibold">
                                        Notes without connections
                                    </Text>
                                    <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                                        {isolatedNodes.length} {isolatedNodes.length === 1 ? 'note has' : 'notes have'}{' '}
                                        no links yet.
                                    </Text>
                                </div>
                            </div>
                            <button
                                type="button"
                                aria-expanded={isReviewOpen}
                                onClick={() => setIsReviewOpen((open) => !open)}
                                className="focus-ring-soft mt-3 inline-flex h-9 items-center justify-center gap-2 self-start rounded-[10px] border border-border-subtle bg-elevated px-3 text-sm font-semibold text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                            >
                                {isReviewOpen ? 'Hide review' : 'Review notes'}
                                <Icon.ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </article>
                    </div>
                    {isReviewOpen && <GraphUnlinkedNotesPanel nodes={isolatedNodes} />}
                </>
            ) : (
                <Text as="p" variant="meta" tone="tertiary" className="px-4 py-6 text-center sm:px-5">
                    No follow-up items right now.
                </Text>
            )}
        </section>
    );
}
