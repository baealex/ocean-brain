import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

import { SEARCH_ROUTE } from '~/modules/url';

const isShortcutBlockedTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
        return false;
    }

    if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
    ) {
        return true;
    }

    return Boolean(
        target.closest('button, [role="button"], [role="dialog"], [role="menu"], [role="menuitem"], [role="listbox"]'),
    );
};

const GlobalSearchShortcut = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                event.defaultPrevented ||
                !(event.metaKey || event.ctrlKey) ||
                event.key.toLowerCase() !== 'k' ||
                isShortcutBlockedTarget(event.target)
            ) {
                return;
            }

            event.preventDefault();
            navigate({
                to: SEARCH_ROUTE,
                search: {
                    query: '',
                    page: 1,
                    mode: 'hybrid',
                },
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    return null;
};

export default GlobalSearchShortcut;
