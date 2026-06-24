import { useLocation } from '@tanstack/react-router';
import classNames from 'classnames';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import * as Icon from '~/components/icon';
import { RestoreParentScroll } from '~/components/shared';

const rootClassName = 'flex h-dvh min-h-0 w-full flex-row overflow-hidden';
const menuButtonClassName = classNames(
    'fixed',
    'bottom-4',
    'left-4',
    'z-[1003]',
    'flex',
    'h-12',
    'w-12',
    'items-center',
    'justify-center',
    'rounded-[14px]',
    'border',
    'border-border-subtle',
    'bg-surface',
    'text-fg-secondary',
    'shadow-[0_12px_24px_-18px_rgba(0,0,0,0.35)]',
    'transition-all',
    'hover:bg-hover-subtle',
    'hover:text-fg-default',
    'active:translate-y-px',
    'aria-expanded:bg-hover-subtle',
    'aria-expanded:text-fg-default',
);
const sidebarClassName = classNames(
    'fixed',
    'z-[1002]',
    'h-full',
    'w-full',
    'flex-[0_0_300px]',
    'overflow-y-auto',
    'border-r-0',
    'border-border-subtle',
    'bg-[var(--page-bg)]',
    'pb-20',
    'md:static',
    'md:w-auto',
    'md:translate-x-0',
    'md:border-r',
    'md:pb-0',
    'md:pointer-events-auto',
);
const sidebarClosedClassName = 'pointer-events-none -translate-x-full';
const sidebarOpenClassName = 'pointer-events-auto translate-x-0';
const centerClassName = classNames(
    'flex',
    'h-full',
    'min-h-0',
    'min-w-0',
    'flex-1',
    'flex-col',
    'overflow-x-hidden',
    'overflow-y-auto',
    'overscroll-contain',
    '[scrollbar-gutter:stable]',
);
const topClassName = classNames(
    'sticky',
    'top-0',
    'z-[1001]',
    'border-b',
    'border-border-subtle',
    'bg-[var(--page-bg)]',
    "max-md:after:content-['']",
    'max-md:after:pointer-events-none',
    'max-md:after:absolute',
    'max-md:after:inset-y-0',
    'max-md:after:right-0',
    'max-md:after:w-12',
    'max-md:after:bg-[linear-gradient(to_right,transparent,var(--page-bg))]',
);
const topContentClassName = classNames(
    'flex',
    'items-center',
    'overflow-x-auto',
    'whitespace-nowrap',
    '[scrollbar-width:none]',
    '[&::-webkit-scrollbar]:hidden',
);
const contentClassName = classNames(
    'min-h-0',
    'min-w-0',
    'max-w-full',
    'flex-1',
    'overflow-x-clip',
    'px-4',
    'pt-4',
    "after:block",
    "after:h-4",
    "after:content-['']",
    'max-md:after:h-24',
);

interface LayoutShellProps {
    sidebar: ReactNode;
    topNavigation: ReactNode;
    children?: ReactNode;
}

const LayoutShell = ({ sidebar, topNavigation, children }: LayoutShellProps) => {
    const pathname = useLocation({ select: (location) => location.pathname });
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const sidebarId = 'site-layout-sidebar';

    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    return (
        <div className={rootClassName}>
            <div className="md:hidden">
                <button
                    type="button"
                    className={menuButtonClassName}
                    aria-label="Toggle sidebar"
                    aria-controls={sidebarId}
                    aria-expanded={isMenuOpen}
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                >
                    <Icon.Menu className="h-6 w-6" />
                </button>
            </div>
            <aside
                id={sidebarId}
                className={classNames(sidebarClassName, isMenuOpen ? sidebarOpenClassName : sidebarClosedClassName)}
            >
                {sidebar}
            </aside>
            <main className={centerClassName}>
                <div className={topClassName}>
                    <div className={topContentClassName}>{topNavigation}</div>
                </div>
                <div className={contentClassName}>{children}</div>
                <RestoreParentScroll />
            </main>
        </div>
    );
};

export default LayoutShell;
