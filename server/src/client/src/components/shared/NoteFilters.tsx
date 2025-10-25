import * as Icon from '~/components/icon';

export type ViewMode = 'grid' | 'table';
export type SortBy = 'updatedAt' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

interface Props {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    itemsPerPage: number;
    onItemsPerPageChange: (count: number) => void;
    sortBy: SortBy;
    onSortByChange: (sortBy: SortBy) => void;
    sortOrder: SortOrder;
    onSortOrderChange: (order: SortOrder) => void;
}

export default function NoteFilters({
    viewMode,
    onViewModeChange,
    itemsPerPage,
    onItemsPerPageChange,
    sortBy,
    onSortByChange,
    sortOrder,
    onSortOrderChange
}: Props) {
    return (
        <div className="flex flex-wrap gap-4 items-center justify-between mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex gap-2 items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</span>
                <div className="flex gap-1 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                    <button
                        onClick={() => onViewModeChange('grid')}
                        className={`px-3 py-2 text-sm transition-colors ${
                            viewMode === 'grid'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Grid view"
                    >
                        <Icon.Grid width={18} height={18} />
                    </button>
                    <button
                        onClick={() => onViewModeChange('table')}
                        className={`px-3 py-2 text-sm transition-colors ${
                            viewMode === 'table'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Table view"
                    >
                        <Icon.List width={18} height={18} />
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex gap-2 items-center">
                    <label htmlFor="itemsPerPage" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Items per page:
                    </label>
                    <select
                        id="itemsPerPage"
                        value={itemsPerPage}
                        onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>

                <div className="flex gap-2 items-center">
                    <label htmlFor="sortBy" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Sort by:
                    </label>
                    <select
                        id="sortBy"
                        value={sortBy}
                        onChange={(e) => onSortByChange(e.target.value as SortBy)}
                        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="updatedAt">Updated Date</option>
                        <option value="createdAt">Created Date</option>
                    </select>
                </div>

                <div className="flex gap-2 items-center">
                    <label htmlFor="sortOrder" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Order:
                    </label>
                    <select
                        id="sortOrder"
                        value={sortOrder}
                        onChange={(e) => onSortOrderChange(e.target.value as SortOrder)}
                        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="desc">Newest First</option>
                        <option value="asc">Oldest First</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
