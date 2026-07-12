import classNames from 'classnames';
import { useEffect, useState } from 'react';
import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import type { NoteSaveStatus } from '~/hooks/useNoteSaveController';
import { toNoteVersionTime } from '~/modules/note-version';
import { getRecentTimeSinceRefreshDelay, recentTimeSince } from '~/modules/time';

const SAVE_CONFIRMATION_DURATION_MS = 2200;

interface NoteSaveStatusIndicatorProps {
    status: NoteSaveStatus;
    savedAt: string;
    savedVersion: string;
    confirmationRevision: number;
}

export default function NoteSaveStatusIndicator({
    status,
    savedAt,
    savedVersion,
    confirmationRevision,
}: NoteSaveStatusIndicatorProps) {
    const [relativeNow, setRelativeNow] = useState(() => Date.now());
    const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);

    useEffect(() => {
        if (status !== 'saved') {
            return;
        }

        const timer = window.setTimeout(
            () => setRelativeNow(Date.now()),
            getRecentTimeSinceRefreshDelay(toNoteVersionTime(savedVersion), relativeNow),
        );

        return () => window.clearTimeout(timer);
    }, [relativeNow, savedVersion, status]);

    useEffect(() => {
        if (confirmationRevision === 0) {
            return;
        }

        setShowSavedConfirmation(true);
        const timer = window.setTimeout(() => setShowSavedConfirmation(false), SAVE_CONFIRMATION_DURATION_MS);

        return () => window.clearTimeout(timer);
    }, [confirmationRevision]);

    const isRecentSaveVisible = status === 'saved' && showSavedConfirmation;
    const statusText =
        status === 'pending'
            ? 'Saving...'
            : status === 'saving'
              ? 'Saving now...'
              : status === 'error'
                ? 'Save failed. Try again.'
                : status === 'conflict'
                  ? 'Save paused: changed elsewhere'
                  : `Saved ${recentTimeSince(toNoteVersionTime(savedVersion), relativeNow)}`;
    const indicatorClassName = classNames(
        'inline-flex items-center gap-2 transition-colors',
        status === 'saved' && !isRecentSaveVisible && 'text-fg-secondary',
        isRecentSaveVisible && 'text-accent-success',
        (status === 'pending' || status === 'saving') && 'text-fg-default',
        (status === 'error' || status === 'conflict') && 'text-fg-error',
    );
    const progressRingClassName = classNames(
        'save-progress-ring flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
        (status === 'pending' || status === 'saving') && 'save-progress-ring-active',
        status === 'saved' && isRecentSaveVisible && 'save-progress-ring-complete',
        (status === 'error' || status === 'conflict') && 'save-progress-ring-error',
    );
    const icon =
        status === 'error' || status === 'conflict' ? (
            <Icon.WarningCircle className="h-3.5 w-3.5" weight="fill" />
        ) : (
            <span className={progressRingClassName} aria-hidden>
                <span className="h-2 w-2 rounded-full bg-elevated" />
            </span>
        );

    return (
        <Text
            as="span"
            variant="label"
            weight="medium"
            className={indicatorClassName}
            role="status"
            aria-live="polite"
            title={savedAt}
        >
            {icon}
            {statusText}
        </Text>
    );
}
