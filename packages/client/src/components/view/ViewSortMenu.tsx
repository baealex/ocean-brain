import * as Icon from '~/components/icon';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '~/components/ui';
import type { ViewSortBy, ViewSortOrder } from '~/models/view.model';

const SORT_CHOICES: { by: ViewSortBy; order: ViewSortOrder; label: string }[] = [
    { by: 'updatedAt', order: 'desc', label: 'Recently updated' },
    { by: 'updatedAt', order: 'asc', label: 'Least recently updated' },
    { by: 'createdAt', order: 'desc', label: 'Newest notes first' },
    { by: 'createdAt', order: 'asc', label: 'Oldest notes first' },
    { by: 'title', order: 'asc', label: 'Title: A to Z' },
    { by: 'title', order: 'desc', label: 'Title: Z to A' },
];

const ViewSortMenu = ({
    sortBy,
    sortOrder,
    disabled,
    compact = false,
    summary,
    onChange,
}: {
    sortBy: ViewSortBy;
    sortOrder: ViewSortOrder;
    disabled?: boolean;
    compact?: boolean;
    summary?: string;
    onChange: (by: ViewSortBy, order: ViewSortOrder) => void;
}) => {
    const label = SORT_CHOICES.find((choice) => choice.by === sortBy && choice.order === sortOrder)?.label;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="subtle"
                    size={compact ? 'icon-sm' : 'sm'}
                    aria-label={`Sort: ${label}`}
                    title={label}
                    disabled={disabled}
                >
                    {compact ? (
                        <Icon.SortAscending className="size-4" />
                    ) : (
                        <>
                            {label}
                            <Icon.ChevronDown className="size-3.5" />
                        </>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={compact ? 'end' : 'start'}>
                {summary ? (
                    <>
                        <DropdownMenuLabel className="max-w-72 whitespace-normal">{summary}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                    </>
                ) : null}
                <DropdownMenuRadioGroup
                    value={`${sortBy}:${sortOrder}`}
                    onValueChange={(value) => {
                        const choice = SORT_CHOICES.find((candidate) => `${candidate.by}:${candidate.order}` === value);
                        if (choice) onChange(choice.by, choice.order);
                    }}
                >
                    {SORT_CHOICES.map((choice) => (
                        <DropdownMenuRadioItem
                            key={`${choice.by}:${choice.order}`}
                            value={`${choice.by}:${choice.order}`}
                        >
                            {choice.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default ViewSortMenu;
