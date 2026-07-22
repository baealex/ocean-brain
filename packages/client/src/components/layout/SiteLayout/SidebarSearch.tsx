import { useNavigate } from '@tanstack/react-router';

import * as Icon from '~/components/icon';
import { Skeleton } from '~/components/shared';
import { Text } from '~/components/ui';
import useSemanticSearchCapability from '~/hooks/useSemanticSearchCapability';
import { SEARCH_ROUTE } from '~/modules/url';

import LegacySidebarQuickSearch from './LegacySidebarQuickSearch';

const searchPageButtonClassName =
    'focus-ring-soft flex min-h-11 w-full items-center gap-2.5 rounded-[14px] border border-border-subtle bg-elevated px-3 text-left outline-none transition-colors hover:border-border-focus hover:bg-hover-subtle';

const SidebarSearch = () => {
    const navigate = useNavigate();
    const { isLoading, isSemanticSearchEnabled } = useSemanticSearchCapability();

    if (isLoading) {
        return (
            <div className="p-3" aria-label="Loading search">
                <Skeleton width="100%" height={44} className="rounded-[14px]" />
            </div>
        );
    }

    if (!isSemanticSearchEnabled) {
        return (
            <div className="p-3">
                <LegacySidebarQuickSearch />
            </div>
        );
    }

    return (
        <div className="p-3">
            <button
                type="button"
                aria-label="Go to note search"
                className={searchPageButtonClassName}
                onClick={() => {
                    navigate({
                        to: SEARCH_ROUTE,
                        search: {
                            query: '',
                            page: 1,
                            mode: 'hybrid',
                        },
                    });
                }}
            >
                <Icon.Search className="h-[18px] w-[18px] shrink-0 text-fg-tertiary" weight="bold" />
                <Text as="span" variant="meta" tone="secondary" className="min-w-0 flex-1">
                    Search notes
                </Text>
                <Icon.ChevronRight className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
            </button>
        </div>
    );
};

export default SidebarSearch;
