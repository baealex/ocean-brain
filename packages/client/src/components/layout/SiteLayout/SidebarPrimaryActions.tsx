import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import useNoteMutate from '~/hooks/resource/useNoteMutate';

import PinnedNotesPanel from './PinnedNotesPanel';
import SidebarSectionHeader from './SidebarSectionHeader';

const SidebarPrimaryActions = () => {
    const { onCreate } = useNoteMutate();

    return (
        <div className="flex flex-col gap-5 p-3">
            <button
                type="button"
                className="focus-ring-soft group flex w-full items-center justify-between gap-3 rounded-[16px] border border-border-subtle bg-surface px-3.5 py-3 text-left text-fg-default outline-none transition-colors hover:border-border hover:bg-hover-subtle"
                onClick={() => onCreate()}>
                <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-cta text-fg-on-filled">
                        <Icon.Pencil className="h-4.5 w-4.5" weight="bold" />
                    </span>
                    <span className="flex flex-col">
                        <Text variant="body" weight="medium">Capture</Text>
                        <Text variant="label" tone="secondary">
                            Start a new note right away
                        </Text>
                    </span>
                </span>
                <Icon.ArrowRight className="h-4 w-4 text-fg-tertiary transition-colors group-hover:text-fg-default" weight="bold" />
            </button>
            <section className="px-1 pt-4">
                <SidebarSectionHeader
                    title="Pinned"
                    icon={<Icon.Pin className="h-4 w-4" weight="fill" />}
                />
                <PinnedNotesPanel />
            </section>
        </div>
    );
};

export default SidebarPrimaryActions;
