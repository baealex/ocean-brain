import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import useNoteMutate from '~/hooks/resource/useNoteMutate';

import PinnedNotesPanel from './PinnedNotesPanel';
import SidebarSectionHeader from './SidebarSectionHeader';

const rootClassName = 'flex flex-col gap-3.5 p-3 pt-2';
const captureButtonClassName = 'focus-ring-soft surface-base group flex w-full items-center justify-between gap-2.5 px-3 py-2.5 text-left text-fg-default outline-none transition-colors hover:bg-hover-subtle';
const captureContentClassName = 'flex items-center gap-2.5';
const captureIconWrapClassName = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-cta text-fg-on-filled';
const captureTextWrapClassName = 'flex flex-col';
const trailingIconClassName = 'h-4 w-4 text-fg-tertiary transition-colors group-hover:text-fg-default';

const SidebarPrimaryActions = () => {
    const { onCreate } = useNoteMutate();

    return (
        <div className={rootClassName}>
            <button
                type="button"
                className={captureButtonClassName}
                onClick={() => onCreate()}>
                <span className={captureContentClassName}>
                    <span className={captureIconWrapClassName}>
                        <Icon.Pencil className="h-4.5 w-4.5" weight="bold" />
                    </span>
                    <span className={captureTextWrapClassName}>
                        <Text variant="meta" weight="semibold" tracking="tight">Capture</Text>
                        <Text variant="label" tone="secondary">
                            Open a new note
                        </Text>
                    </span>
                </span>
                <Icon.ChevronRight className={trailingIconClassName} weight="bold" />
            </button>
            <section className="pt-1">
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
