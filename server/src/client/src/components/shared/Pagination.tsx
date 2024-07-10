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
    const pages = Array.from(Array(lastPage).keys()).map(i => i + 1);

    return (
        <div className="flex justify-center mt-5 mb-2">
            <div className="flex items-center gap-4">
                <div className="flex justify-center">
                    <button
                        disabled={currentPage === 1}
                        className={currentPage === 1 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'}
                        onClick={() => handlePageChange(currentPage - 1)}>
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                </div>
                <div className="flex justify-center gap-4">
                    {pages.map(page => (
                        <button
                            key={page}
                            className={`${currentPage === page ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'} p-2`}
                            onClick={() => handlePageChange(page)}>
                            {page}
                        </button>
                    ))}
                </div>
                <div className="flex justify-center">
                    <button
                        disabled={currentPage === lastPage}
                        className={currentPage === pages.length ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'}
                        onClick={() => handlePageChange(currentPage + 1)}>
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
