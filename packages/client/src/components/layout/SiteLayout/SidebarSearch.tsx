import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import * as Icon from '~/components/icon';
import { SearchDialog } from '~/components/search';
import { Text } from '~/components/ui';
import { SEARCH_ROUTE } from '~/modules/url';

const MOBILE_SEARCH_QUERY = '(max-width: 767px)';

const triggerClassName =
    'focus-ring-soft flex min-h-11 w-full items-center gap-2.5 rounded-[14px] border border-border-subtle bg-elevated px-3 text-left outline-none transition-colors hover:border-border-focus hover:bg-hover-subtle';

const SidebarSearch = () => {
    const navigate = useNavigate();
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const handleOpenSearch = () => {
        const isMobile =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia(MOBILE_SEARCH_QUERY).matches;

        if (isMobile) {
            navigate({
                to: SEARCH_ROUTE,
                search: {
                    query: '',
                    page: 1,
                    mode: 'hybrid',
                },
            });
            return;
        }

        setIsSearchOpen(true);
    };

    return (
        <div className="p-3">
            <button
                type="button"
                aria-label="Open note search"
                aria-haspopup="dialog"
                className={triggerClassName}
                onClick={handleOpenSearch}
            >
                <Icon.Search className="h-[18px] w-[18px] shrink-0 text-fg-tertiary" weight="bold" />
                <Text as="span" variant="meta" tone="secondary" className="min-w-0 flex-1">
                    Search notes
                </Text>
                <Icon.ChevronRight className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
            </button>
            <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
        </div>
    );
};

export default SidebarSearch;
