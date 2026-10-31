import { useMatches, useNavigate } from '@tanstack/react-router';
import classNames from 'classnames';

import * as Icon from '~/components/icon';
import { getNoteURL, HOME_ROUTE, NEW_NOTE_ID, NOTE_ROUTE } from '~/modules/url';
import { useWorkspace } from '~/store/workspace';

const buttonClassName = classNames(
    'fixed',
    'right-4',
    'bottom-[calc(1rem+env(safe-area-inset-bottom))]',
    'z-[1001]',
    'flex',
    'h-12',
    'w-12',
    'items-center',
    'justify-center',
    'rounded-[14px]',
    'bg-cta',
    'text-fg-on-filled',
    'shadow-[0_12px_24px_-18px_rgba(0,0,0,0.35)]',
    'outline-none',
    'focus-ring-soft',
    'transition-colors',
    'hover:bg-cta-hover',
    'active:translate-y-px',
    'editing:hidden',
);

const MobileCaptureButton = () => {
    const navigate = useNavigate();
    const { multiple, activeWorkspace } = useWorkspace();
    const isCaptureScreen = useMatches({
        select: (matches) =>
            matches.some(
                (match) =>
                    match.routeId === HOME_ROUTE ||
                    (match.routeId === NOTE_ROUTE && match.pathname !== getNoteURL(NEW_NOTE_ID)),
            ),
    });

    if (!isCaptureScreen || activeWorkspace?.archivedAt) {
        return null;
    }

    return (
        <button
            type="button"
            className={buttonClassName}
            aria-label={
                multiple ? `Capture a new note in ${activeWorkspace?.name ?? 'this workspace'}` : 'Capture a new note'
            }
            onClick={() => void navigate({ to: NOTE_ROUTE, params: { id: NEW_NOTE_ID } })}
        >
            <Icon.Pencil className="h-5 w-5" weight="bold" />
        </button>
    );
};

export default MobileCaptureButton;
