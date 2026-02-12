import { GridFourIcon, SortAscendingIcon } from '@phosphor-icons/react';
import {
    Checkbox,
    Label,
    Select,
    SelectItem
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
        <div className="flex justify-end mb-4">
            <div className="inline-flex flex-wrap gap-3 items-center px-4 py-2.5 bg-surface border-2 border-border rounded-sketchy-lg shadow-sketchy">
                <div className="flex gap-1.5 items-center">
                    <GridFourIcon fontSize={24} className="min-w-8 text-fg-tertiary" />
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

                <div className="w-px h-5 bg-divider" />

                <div className="flex gap-1.5 items-center">
                    <SortAscendingIcon fontSize={24} className="min-w-8 text-fg-tertiary" />
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

                <div className="w-px h-5 bg-divider" />

                <Label htmlFor="pinnedFirst" size="sm" className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                        id="pinnedFirst"
                        size="sm"
                        checked={pinnedFirst}
                        onChange={(e) => onPinnedFirstChange(e.target.checked)}
                    />
                    <span className="text-fg-secondary">Pinned First</span>
                </Label>
            </div>
        </div>
    );
}
