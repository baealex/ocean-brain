import type { ReactNode } from 'react';

import LayoutShell from './LayoutShell';
import SidebarHeroBanner from './SidebarHeroBanner';
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
                    <SidebarSearch />
                    <SidebarPrimaryActions />
                </>
            }
            topNavigation={<TopNavigation />}
        >
            {children}
        </LayoutShell>
    );
};

export default SiteLayout;
