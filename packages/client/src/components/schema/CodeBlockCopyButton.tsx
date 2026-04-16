import classNames from 'classnames';
import type { MouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Icon from '~/components/icon';

type CopyStatus = 'idle' | 'copied' | 'failed';

interface CodeBlockCopyButtonProps {
    getText: () => string;
    resetDelayMs?: number;
}

const copyButtonBaseClassName =
    'pointer-events-auto inline-flex h-7 cursor-pointer select-none items-center gap-1.5 rounded-[8px] border border-white/10 bg-white/10 px-2.5 text-xs font-medium text-white/60 opacity-75 shadow-[0_8px_18px_-14px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white/90 hover:opacity-100 focus-ring-soft focus:text-white/90 focus:opacity-100';

const copyButtonStatusClassName: Record<CopyStatus, string> = {
    idle: '',
    copied: 'text-accent-success hover:text-accent-success focus:text-accent-success',
    failed: 'text-fg-error hover:text-fg-error focus:text-fg-error',
};

const copyStatusLabel: Record<CopyStatus, string> = {
    idle: 'Copy',
    copied: 'Copied',
    failed: 'Copy failed',
};

export const CodeBlockCopyButton = ({ getText, resetDelayMs = 2000 }: CodeBlockCopyButtonProps) => {
    const [status, setStatus] = useState<CopyStatus>('idle');
    const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearResetTimer = useCallback(() => {
        if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
            resetTimeoutRef.current = null;
        }
    }, []);

    const scheduleReset = useCallback(() => {
        clearResetTimer();
        resetTimeoutRef.current = setTimeout(() => {
            setStatus('idle');
            resetTimeoutRef.current = null;
        }, resetDelayMs);
    }, [clearResetTimer, resetDelayMs]);

    useEffect(() => clearResetTimer, [clearResetTimer]);

    const stopEditorEvent = (event: MouseEvent) => {
        event.stopPropagation();
    };

    const preventEditorFocus = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
        stopEditorEvent(event);

        try {
            await navigator.clipboard.writeText(getText());
            setStatus('copied');
        } catch {
            setStatus('failed');
        }

        scheduleReset();
    };

    return (
        <div
            className="pointer-events-none absolute right-3 top-2 z-[1]"
            contentEditable={false}
            onMouseDown={preventEditorFocus}
        >
            <button
                type="button"
                className={classNames(copyButtonBaseClassName, copyButtonStatusClassName[status])}
                contentEditable={false}
                onClick={handleCopy}
            >
                <Icon.Copy className="h-3.5 w-3.5" />
                <span aria-live="polite">{copyStatusLabel[status]}</span>
            </button>
        </div>
    );
};
