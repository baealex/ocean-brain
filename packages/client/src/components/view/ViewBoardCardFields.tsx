import type { ReactNode } from 'react';
import type { ViewBoardNote } from '~/apis/view.api';
import { Text } from '~/components/ui';
import type { NoteProperty } from '~/models/note.model';
import type { View } from '~/models/view.model';
import { timeSince } from '~/modules/time';
import { normalizeViewTableColumns, normalizeViewTablePropertyKeys } from '~/modules/view-dashboard';
import ViewChip from './ViewChip';
import ViewPropertyChip from './ViewPropertyChip';

const AUTOMATIC_CARD_PROPERTY_LIMIT = 3;
const VISIBLE_CARD_TAG_LIMIT = 3;

const resolveBoardCardProperties = (view: View, note: ViewBoardNote): NoteProperty[] => {
    const groupPropertyKey = view.displayOptions.boardGroupByPropertyKey;
    const noteProperties = (note.properties ?? []).filter((property) => property.key !== groupPropertyKey);
    const configuredKeys = normalizeViewTablePropertyKeys(view.displayOptions.tablePropertyKeys);

    if (configuredKeys.length > 0) {
        const propertyByKey = new Map(noteProperties.map((property) => [property.key, property]));
        return configuredKeys.flatMap((key) => {
            const property = propertyByKey.get(key);
            return property ? [property] : [];
        });
    }

    const filterKeys = view.propertyFilters.map((filter) => filter.key);
    const getPriority = (key: string) => {
        const index = filterKeys.indexOf(key);
        return index === -1 ? filterKeys.length : index;
    };

    return [...noteProperties]
        .sort((left, right) => getPriority(left.key) - getPriority(right.key))
        .slice(0, AUTOMATIC_CARD_PROPERTY_LIMIT);
};

const renderTagBadges = (note: ViewBoardNote) => {
    const visibleTags = note.tags.slice(0, VISIBLE_CARD_TAG_LIMIT);
    const hiddenCount = note.tags.length - visibleTags.length;

    return [
        ...visibleTags.map((tag) => (
            <ViewChip
                key={`tag:${tag.id}`}
                size="compact"
                className="max-w-[132px] border-border-subtle bg-transparent text-fg-secondary"
            >
                {tag.name}
            </ViewChip>
        )),
        ...(hiddenCount > 0
            ? [
                  <ViewChip key="tag:hidden" size="compact" className="border-border-subtle bg-subtle text-fg-tertiary">
                      +{hiddenCount}
                  </ViewChip>,
              ]
            : []),
    ];
};

const ViewBoardCardFields = ({ view, note }: { view: View; note: ViewBoardNote }) => {
    const columns = normalizeViewTableColumns(view.displayOptions.tableColumns);
    const badges: ReactNode[] = columns.flatMap((column) => {
        if (column === 'tags') {
            return renderTagBadges(note);
        }

        if (column === 'properties') {
            return resolveBoardCardProperties(view, note).map((property) => (
                <ViewPropertyChip key={`property:${property.key}`} property={property} />
            ));
        }

        return [];
    });
    const dates = columns.flatMap((column) => {
        if (column === 'createdAt') {
            return [`Created ${timeSince(Number(note.createdAt))}`];
        }

        if (column === 'updatedAt') {
            return [`Updated ${timeSince(Number(note.updatedAt))}`];
        }

        return [];
    });

    return (
        <>
            {badges.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div> : null}
            {dates.length > 0 ? (
                <Text as="p" variant="meta" tone="tertiary" className="mt-2">
                    {dates.join(' · ')}
                </Text>
            ) : null}
        </>
    );
};

export default ViewBoardCardFields;
