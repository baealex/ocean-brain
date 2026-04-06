import * as Icon from '~/components/icon';
import {
    Checkbox,
    Label,
    Select,
    SelectItem,
    Text
} from '~/components/ui';

export type SortBy = 'updatedAt' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

interface Props {
    itemsPerPage: number;
    onItemsPerPageChange: (count: number) => void;
    isAutoLimit?: boolean;
    sortBy: SortBy;
    onSortByChange: (sortBy: SortBy) => void;
    sortOrder: SortOrder;
    onSortOrderChange: (order: SortOrder) => void;
    pinnedFirst: boolean;
    onPinnedFirstChange: (enabled: boolean) => void;
}

export default function NoteFilters({
    itemsPerPage,
    onItemsPerPageChange,
    isAutoLimit = false,
    sortBy,
    onSortByChange,
    sortOrder,
    onSortOrderChange,
    pinnedFirst,
    onPinnedFirstChange
}: Props) {
    return (
        <div className="flex justify-end">
            <div className="surface-base inline-flex flex-wrap items-center gap-3 rounded-[16px] px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                    <Icon.Grid className="h-4 w-4 shrink-0 text-fg-tertiary" />
                    <Text as="span" variant="label" weight="medium" tone="tertiary">
                        Items
                    </Text>
                    <Select
                        value={isAutoLimit ? 'auto' : String(itemsPerPage)}
                        onValueChange={(value) => {
                            if (value === 'auto') return;
                            onItemsPerPageChange(Number(value));
                        }}
                        variant="ghost"
                        size="sm">
                        {isAutoLimit && <SelectItem value="auto">Auto ({itemsPerPage})</SelectItem>}
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
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
                        onValueChange={(value) => onSortByChange(value as SortBy)}
                        variant="ghost"
                        size="sm">
                        <SelectItem value="updatedAt">Updated</SelectItem>
                        <SelectItem value="createdAt">Created</SelectItem>
                    </Select>
                    <Select
                        value={sortOrder}
                        onValueChange={(value) => onSortOrderChange(value as SortOrder)}
                        variant="ghost"
                        size="sm">
                        <SelectItem value="desc">Newest</SelectItem>
                        <SelectItem value="asc">Oldest</SelectItem>
                    </Select>
                </div>

                <div className="h-5 w-px bg-divider" />

                <Label htmlFor="pinnedFirst" size="sm" className="flex cursor-pointer items-center gap-1.5">
                    <Checkbox
                        id="pinnedFirst"
                        size="sm"
                        checked={pinnedFirst}
                        onChange={(e) => onPinnedFirstChange(e.target.checked)}
                    />
                    <Text as="span" variant="label" weight="medium" tone="secondary">
                        Pinned First
                    </Text>
                </Label>
            </div>
        </div>
    );
}
