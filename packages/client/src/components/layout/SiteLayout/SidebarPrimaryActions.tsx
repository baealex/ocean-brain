import * as Icon from '~/components/icon';
import { Button } from '~/components/ui';
import useNoteMutate from '~/hooks/resource/useNoteMutate';

import PinnedNotesPanel from './PinnedNotesPanel';

const SidebarPrimaryActions = () => {
    const { onCreate } = useNoteMutate();

    return (
        <div className="p-3 flex flex-col gap-2">
            <Button
                variant="primary"
                size="lg"
                className="w-full shadow-sketchy"
                onClick={() => onCreate()}>
                <Icon.Pencil className="w-5 h-5" weight="bold" /> Capture
            </Button>
            <div className="font-bold flex items-center gap-2 p-2 pt-6 mt-5 border-t-2 border-dashed border-border-subtle">
                <Icon.Pin className="w-5 h-5" weight="fill" />
                Pinned
            </div>
            <PinnedNotesPanel />
        </div>
    );
};

export default SidebarPrimaryActions;
