import type { Note } from '~/models/note.model';
import type { ViewSection, ViewSortBy } from '~/models/view.model';
import ViewSectionListRenderer from './ViewSectionListRenderer';
import ViewSectionTableRenderer from './ViewSectionTableRenderer';
import ViewSectionUnsupportedRenderer from './ViewSectionUnsupportedRenderer';

interface ViewSectionRendererProps {
    section: ViewSection;
    notes: Note[];
    isPending: boolean;
    isError: boolean;
    onRetry: () => void;
    onEdit: () => void;
    onSortChange: (sortBy: ViewSortBy) => void;
    isSortPending: boolean;
}

export default function ViewSectionRenderer({
    section,
    notes,
    isPending,
    isError,
    onRetry,
    onEdit,
    onSortChange,
    isSortPending,
}: ViewSectionRendererProps) {
    if (section.displayType === 'table') {
        return (
            <ViewSectionTableRenderer
                section={section}
                notes={notes}
                isPending={isPending}
                isError={isError}
                onRetry={onRetry}
                onSortChange={onSortChange}
                isSortPending={isSortPending}
            />
        );
    }

    if (section.displayType === 'calendar') {
        return <ViewSectionUnsupportedRenderer onEdit={onEdit} />;
    }

    return <ViewSectionListRenderer notes={notes} isPending={isPending} isError={isError} onRetry={onRetry} />;
}
