import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from '../icon';

interface Props {
    currentPage: number;
    limit: number;
    totalEntries?: number;
}

export default function Pagination({
    currentPage,
    limit,
    totalEntries
}: Props) {
    const [searchParams, setSearchParams] = useSearchParams();

    const handlePageChange = (page: number) => {
        searchParams.set('page', page.toString());
        setSearchParams(searchParams);
    };

    const lastPage = Math.ceil((totalEntries || 0) / limit);

    return (
        <div className="flex justify-center mt-10 mb-2">
            <div className="flex items-center gap-6">
                <div className="flex justify-center">
                    <button
                        disabled={currentPage === 1}
                        className={currentPage === 1 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'}
                        onClick={() => handlePageChange(currentPage - 1)}>
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                </div>
                <div className="flex justify-center items-center gap-2">
                    {currentPage} <span className="text-gray-400 dark:text-gray-600 text-xs">/</span> {lastPage}
                </div>
                <div className="flex justify-center">
                    <button
                        disabled={currentPage === lastPage}
                        className={currentPage === lastPage ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'}
                        onClick={() => handlePageChange(currentPage + 1)}>
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
