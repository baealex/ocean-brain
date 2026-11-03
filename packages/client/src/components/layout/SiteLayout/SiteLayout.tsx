import { useMatches } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import DemoSidebarPromoSlot from '~/components/demo/DemoSidebarPromoSlot';
import { INTEGRATION_ROUTE } from '~/modules/url';
import { useWorkspace } from '~/store/workspace';

import LayoutShell from './LayoutShell';
import MobileCaptureButton from './MobileCaptureButton';
import SidebarHeroBanner from './SidebarHeroBanner';
import SidebarPinnedNotes from './SidebarPinnedNotes';
import SidebarPrimaryActions from './SidebarPrimaryActions';
import SidebarSearch from './SidebarSearch';
import SidebarWorkspaces from './SidebarWorkspaces';
import TopNavigation from './TopNavigation';

interface SiteLayoutProps {
    children?: ReactNode;
}

const SiteLayout = ({ children }: SiteLayoutProps) => {
    // Read the rendered matches; resolvedLocation updates after the new outlet is painted.
    const isAppRoute = useMatches({
        select: (matches) => matches.some((match) => match.routeId === INTEGRATION_ROUTE),
    });
    const { multiple } = useWorkspace();
    return (
        <LayoutShell
            contentMode={isAppRoute ? 'app' : 'page'}
            sidebar={
                <>
                    <SidebarHeroBanner />
                    {multiple ? (
                        <SidebarWorkspaces />
                    ) : (
                        <>
                            <SidebarPrimaryActions />
                            <SidebarSearch />
                            <SidebarPinnedNotes />
                        </>
                    )}
                    <DemoSidebarPromoSlot />
                </>
            }
            topNavigation={<TopNavigation />}
            mobileAction={<MobileCaptureButton />}
        >
            {children}
        </LayoutShell>
    );
};

export default SiteLayout;
