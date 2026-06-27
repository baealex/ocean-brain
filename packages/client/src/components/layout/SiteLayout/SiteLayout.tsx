import type { ReactNode } from 'react';

import DemoSidebarPromoSlot from '~/components/demo/DemoSidebarPromoSlot';

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
    return (
        <LayoutShell
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
