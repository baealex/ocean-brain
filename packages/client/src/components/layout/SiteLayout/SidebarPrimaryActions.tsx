import * as Icon from '~/components/icon';
import useNoteMutate from '~/hooks/resource/useNoteMutate';

import PinnedNotesPanel from './PinnedNotesPanel';
import SidebarSectionHeader from './SidebarSectionHeader';

const SidebarPrimaryActions = () => {
    const { onCreate } = useNoteMutate();

    return (
        <div className="flex flex-col gap-5 p-3">
            <button
                type="button"
                className="focus-ring-soft group flex w-full items-center justify-between gap-3 rounded-[16px] border border-border-subtle bg-hover-subtle/50 px-3.5 py-3 text-left text-fg-default outline-none transition-colors hover:border-border hover:bg-hover-subtle"
                onClick={() => onCreate()}>
                <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-accent-soft-primary text-accent-primary">
                        <Icon.Pencil className="h-4.5 w-4.5" weight="bold" />
                    </span>
                    <span className="flex flex-col">
                        <span className="text-sm font-medium">Capture</span>
                        <span className="text-xs text-fg-secondary">
                            Start a new note right away
                        </span>
                    </span>
                </span>
                <Icon.ArrowRight className="h-4 w-4 text-fg-tertiary transition-colors group-hover:text-fg-default" weight="bold" />
            </button>
            <section className="border-t border-border-subtle/80 px-1 pt-4">
                <SidebarSectionHeader
                    title="Pinned"
                    icon={<Icon.Pin className="h-4 w-4" weight="fill" />}
                />
                <p className="mb-3 text-sm leading-5 text-fg-secondary">
                    Deliberately kept close for repeat reference.
                </p>
                <PinnedNotesPanel />
            </section>
        </div>
    );
};

export default SidebarPrimaryActions;
