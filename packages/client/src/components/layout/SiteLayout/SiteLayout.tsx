import { useMatches } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import DemoSidebarPromoSlot from '~/components/demo/DemoSidebarPromoSlot';
import { WorkspaceScopeControl } from '~/components/workspace/WorkspaceScopeControl';
import { WorkspaceSwitcher } from '~/components/workspace/WorkspaceSwitcher';
import { INTEGRATION_ROUTE } from '~/modules/url';

import LayoutShell from './LayoutShell';
import SidebarHeroBanner from './SidebarHeroBanner';
import SidebarPinnedNotes from './SidebarPinnedNotes';
import SidebarPrimaryActions from './SidebarPrimaryActions';
import SidebarSearch from './SidebarSearch';
import TopNavigation from './TopNavigation';

interface SiteLayoutProps {
    children?: ReactNode;
}

const SiteLayout = ({ children }: SiteLayoutProps) => {
    // Read the rendered matches; resolvedLocation updates after the new outlet is painted.
    const isAppRoute = useMatches({
        select: (matches) => matches.some((match) => match.routeId === INTEGRATION_ROUTE),
    });
    const pathname = useMatches({ select: (matches) => matches.at(-1)?.pathname ?? '/' });
    const showScope =
        ['/', '/search', '/tag', '/graph', '/calendar', '/reminders', '/setting/trash'].includes(pathname) ||
        pathname.startsWith('/tag/');
    const currentByDefault = ['/', '/calendar', '/reminders', '/setting/trash'].includes(pathname);
    return (
        <LayoutShell
            contentMode={isAppRoute ? 'app' : 'page'}
            sidebar={
                <>
                    <SidebarHeroBanner />
                    <WorkspaceSwitcher />
                    <SidebarPrimaryActions />
                    <SidebarSearch />
                    <SidebarPinnedNotes />
                    <DemoSidebarPromoSlot />
                </>
            }
            topNavigation={
                <div>
                    <TopNavigation />
                    {showScope && <WorkspaceScopeControl currentByDefault={currentByDefault} />}
                </div>
            }
        >
            {children}
        </LayoutShell>
    );
};

export default SiteLayout;
