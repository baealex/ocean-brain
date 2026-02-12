import { forwardRef } from 'react';
import * as Icon from '~/components/icon';

export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
    page: number;
    last: number;
    onChange: (page: number) => void;
}

const Pagination = forwardRef<HTMLElement, PaginationProps>(
    ({
        page: pageProp, last: lastProp, onChange, className = '', ...props
    }, ref) => {
        const page = Number(pageProp);
        const last = Number(lastProp);

        const pageRange: number[] = [];
        for (let num = 1; num < last + 1; num++) {
            if (page === num) {
                pageRange.push(num);
            } else if (page === 1 && num < page + 5) {
                pageRange.push(num);
            } else if (page === 2 && num < page + 4) {
                pageRange.push(num);
            } else if (num > page - 3 && num < page + 3) {
                pageRange.push(num);
            } else if (page === last - 1 && num > page - 4) {
                pageRange.push(num);
            } else if (page === last && num > page - 5) {
                pageRange.push(num);
            }
        }

        const isFirstPage = page === 1;
        const isLastPage = page === last;

        return (
            <nav
                ref={ref}
                className={`mt-8 flex justify-center items-center gap-1 ${className}`}
                {...props}>
                {/* First Page */}
                <PaginationItem
                    disabled={isFirstPage}
                    onClick={() => !isFirstPage && onChange(1)}
                    aria-label="First page"
                    isSkip>
                    <Icon.ChevronLeft width={16} />
                    <Icon.ChevronLeft width={16} />
                </PaginationItem>

                {/* Previous Page */}
                <PaginationItem
                    disabled={isFirstPage}
                    onClick={() => !isFirstPage && onChange(page - 1)}
                    aria-label="Previous page">
                    <Icon.ChevronLeft width={20} />
                </PaginationItem>

                {/* Page Numbers */}
                {pageRange.map((item) => (
                    <PaginationItem
                        key={item}
                        active={page === item}
                        onClick={() => onChange(item)}
                        aria-label={`Page ${item}`}
                        aria-current={page === item ? 'page' : undefined}>
                        {item}
                    </PaginationItem>
                ))}

                {/* Next Page */}
                <PaginationItem
                    disabled={isLastPage}
                    onClick={() => !isLastPage && onChange(page + 1)}
                    aria-label="Next page">
                    <Icon.ChevronRight width={20} />
                </PaginationItem>

                {/* Last Page */}
                <PaginationItem
                    disabled={isLastPage}
                    onClick={() => !isLastPage && onChange(last)}
                    aria-label="Last page"
                    isSkip>
                    <Icon.ChevronRight width={16} />
                    <Icon.ChevronRight width={16} />
                </PaginationItem>
            </nav>
        );
    }
);

Pagination.displayName = 'Pagination';

interface PaginationItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    active?: boolean;
    isSkip?: boolean;
}

const PaginationItem = forwardRef<HTMLButtonElement, PaginationItemProps>(
    ({
        active, disabled, isSkip, children, className = '', ...props
    }, ref) => {
        const baseStyles = `
            flex justify-center items-center
            leading-normal text-base font-bold
            w-9 h-9 md:w-10 md:h-10
            border-2 border-transparent
            rounded-[10px_3px_11px_3px/3px_8px_3px_10px]
            transition-all duration-200
        `;

        const stateStyles = active
            ? 'cursor-default bg-elevated border-border text-fg-default shadow-sketchy'
            : disabled
                ? 'cursor-default text-fg-disabled border-transparent'
                : 'cursor-pointer text-fg-default hover:bg-hover hover:border-border-secondary';

        const skipStyles = isSkip ? 'relative [&>svg]:absolute [&>svg:first-child]:-translate-x-[3px] [&>svg:last-child]:translate-x-[3px]' : '';

        return (
            <button
                ref={ref}
                type="button"
                disabled={disabled}
                className={`${baseStyles} ${stateStyles} ${skipStyles} ${className}`}
                {...props}>
                {children}
            </button>
        );
    }
);

PaginationItem.displayName = 'PaginationItem';

export default Pagination;
