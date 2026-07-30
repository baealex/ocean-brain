import { useNavigate } from '@tanstack/react-router';

import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import { SEARCH_ROUTE } from '~/modules/url';

const launcherClassName =
    'focus-ring-soft surface-base group flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-fg-default outline-none transition-colors hover:bg-hover-subtle';

const SidebarSearchLauncher = () => {
    const navigate = useNavigate();
    const handleOpen = () => {
        navigate({
            to: SEARCH_ROUTE,
            search: {
                query: '',
                page: 1,
                mode: 'hybrid',
            },
        });
    };

    return (
        <button
            type="button"
            className={launcherClassName}
            aria-label="Open detailed search"
            aria-keyshortcuts="Meta+K Control+K"
            onClick={handleOpen}
        >
            <span className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-muted text-fg-secondary transition-colors group-hover:text-fg-default">
                    <Icon.Search className="h-4.5 w-4.5" weight="bold" />
                </span>
                <span className="flex min-w-0 flex-col">
                    <Text as="span" variant="meta" weight="semibold" tracking="tight">
                        Search
                    </Text>
                    <Text as="span" variant="label" tone="secondary">
                        Find a memory
                    </Text>
                </span>
            </span>
            <span className="shrink-0 rounded-[8px] bg-muted px-1.5 py-1 text-label font-medium text-fg-tertiary">
                ⌘K
            </span>
        </button>
    );
};

export default SidebarSearchLauncher;
