import { GridFourIcon, SortAscendingIcon } from '@phosphor-icons/react';
import {
    Checkbox,
    Label,
    Select
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
            <div className="inline-flex flex-wrap gap-3 items-center px-4 py-2.5 bg-surface dark:bg-surface-dark border-2 border-zinc-800 dark:border-zinc-700 rounded-[12px_4px_13px_3px/4px_10px_4px_12px] shadow-sketchy">
                <div className="flex gap-1.5 items-center">
                    <GridFourIcon fontSize={24} className="min-w-8 text-zinc-500 dark:text-zinc-400" />
                    <Select
                        value={isAutoLimit ? 'auto' : itemsPerPage}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'auto') return;
                            onItemsPerPageChange(Number(value));
                        }}
                        size="sm"
                        className="w-auto">
                        {isAutoLimit && <option value="auto">Auto ({itemsPerPage})</option>}
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </Select>
                </div>

                <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600" />

                <div className="flex gap-1.5 items-center">
                    <SortAscendingIcon fontSize={24} className="min-w-8 text-zinc-500 dark:text-zinc-400" />
                    <Select
                        value={sortBy}
                        onChange={(e) => onSortByChange(e.target.value as SortBy)}
                        size="sm"
                        className="w-auto">
                        <option value="updatedAt">Updated</option>
                        <option value="createdAt">Created</option>
                    </Select>
                    <Select
                        value={sortOrder}
                        onChange={(e) => onSortOrderChange(e.target.value as SortOrder)}
                        size="sm"
                        className="w-auto">
                        <option value="desc">Newest</option>
                        <option value="asc">Oldest</option>
                    </Select>
                </div>

                <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600" />

                <Label htmlFor="pinnedFirst" size="sm" className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                        id="pinnedFirst"
                        size="sm"
                        checked={pinnedFirst}
                        onChange={(e) => onPinnedFirstChange(e.target.checked)}
                    />
                    <span className="text-zinc-600 dark:text-zinc-400">Pinned First</span>
                </Label>
            </div>
        </div>
    );
}
