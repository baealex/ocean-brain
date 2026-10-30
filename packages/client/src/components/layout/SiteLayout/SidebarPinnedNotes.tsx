import * as Icon from '~/components/icon';

import PinnedNotesPanel from './PinnedNotesPanel';
import SidebarSectionHeader from './SidebarSectionHeader';

const SidebarPinnedNotes = () => (
    <section className="p-3 pt-0" aria-label="Pinned notes">
        <SidebarSectionHeader title="Pinned" icon={<Icon.Pin className="h-3.5 w-3.5" weight="fill" />} />
        <PinnedNotesPanel />
    </section>
);

export default SidebarPinnedNotes;
