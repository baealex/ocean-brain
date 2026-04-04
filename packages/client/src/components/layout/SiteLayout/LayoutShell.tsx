import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import classNames from 'classnames/bind';

import * as Icon from '~/components/icon';
import { RestoreParentScroll } from '~/components/shared';

import styles from './SiteLayout.module.scss';

const cx = classNames.bind(styles);

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
        <div className={cx('SiteLayout')}>
            <div className="md:hidden">
                <button
                    type="button"
                    className={cx('menu')}
                    aria-label="Toggle sidebar"
                    aria-controls={sidebarId}
                    aria-expanded={isMenuOpen}
                    onClick={() => setIsMenuOpen((prev) => !prev)}>
                    <Icon.Menu className="h-6 w-6" />
                </button>
            </div>
            <aside id={sidebarId} className={cx('side', { open: isMenuOpen })}>
                {sidebar}
            </aside>
            <main className={cx('center')}>
                <div className={cx('top')}>
                    <div className={cx('top-content')}>
                        {topNavigation}
                    </div>
                </div>
                <div className={cx('content')}>
                    {children}
                </div>
                <RestoreParentScroll />
            </main>
        </div>
    );
};

export default LayoutShell;
