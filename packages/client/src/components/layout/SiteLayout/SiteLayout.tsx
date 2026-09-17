import { useMatches } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import DemoSidebarPromoSlot from '~/components/demo/DemoSidebarPromoSlot';
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
    return (
        <LayoutShell
            contentMode={isAppRoute ? 'app' : 'page'}
            sidebar={
                <>
                    <SidebarHeroBanner />
                    <SidebarPrimaryActions />
                    <SidebarSearch />
                    <SidebarPinnedNotes />
                    <DemoSidebarPromoSlot />
                </>
            }
            topNavigation={<TopNavigation />}
        >
            {children}
        </LayoutShell>
    );
};

export default SiteLayout;
