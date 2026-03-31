import * as Icon from '~/components/icon';
import { Button } from '~/components/ui';
import useNoteMutate from '~/hooks/resource/useNoteMutate';

import PinnedNotesPanel from './PinnedNotesPanel';

const SidebarPrimaryActions = () => {
    const { onCreate } = useNoteMutate();

    return (
        <div className="p-3 flex flex-col gap-4">
            <div className="surface-floating relative overflow-hidden rounded-[28px] border border-border-subtle px-4 py-4">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_58%),linear-gradient(160deg,rgba(15,23,42,0.05),transparent_60%)]" />
                <div className="relative flex items-start justify-between gap-3 pb-4">
                    <div className="space-y-1">
                        <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-fg-tertiary">
                            Capture
                        </div>
                        <p className="max-w-[18ch] text-sm leading-6 text-fg-secondary">
                            Open a fresh note and keep the draft moving.
                        </p>
                    </div>
                    <div className="flex size-11 items-center justify-center rounded-[18px] border border-white/40 bg-white/45 text-fg-default shadow-sm">
                        <Icon.Pencil className="h-5 w-5" weight="bold" />
                    </div>
                </div>
                <Button
                    variant="signature"
                    size="lg"
                    className="w-full justify-between border-transparent bg-[linear-gradient(135deg,rgba(30,41,59,0.96),rgba(51,65,85,0.88))] shadow-[0_18px_30px_-22px_rgba(15,23,42,0.8)] hover:bg-[linear-gradient(135deg,rgba(30,41,59,1),rgba(51,65,85,0.94))]"
                    onClick={() => onCreate()}>
                    <span className="flex items-center gap-2">
                        <Icon.Pencil className="h-5 w-5" weight="bold" />
                        Capture note
                    </span>
                    <Icon.ArrowRight className="h-4 w-4" weight="bold" />
                </Button>
            </div>
            <div className="px-1 pt-1">
                <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-fg-tertiary">
                            Pinned
                        </div>
                        <span className="h-px w-10 bg-border-subtle" />
                    </div>
                    <Icon.Pin className="h-4 w-4 text-fg-tertiary" weight="fill" />
                </div>
                <p className="text-sm leading-6 text-fg-secondary">
                    Deliberately kept close for repeat reference.
                </p>
            </div>
            <PinnedNotesPanel />
        </div>
    );
};

export default SidebarPrimaryActions;
