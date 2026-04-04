import { Link } from '@tanstack/react-router';

import { NOTE_ROUTE } from '~/modules/url';

interface CalendarEntryCardProps {
    params: { id: string };
    toneClassName?: string;
    header?: React.ReactNode;
    title: React.ReactNode;
    meta?: React.ReactNode;
    titleClassName?: string;
}

export const CalendarEntryCard = ({
    params,
    toneClassName = '',
    header,
    title,
    meta,
    titleClassName = ''
}: CalendarEntryCardProps) => {
    return (
        <Link
            to={NOTE_ROUTE}
            params={params}
            className="group block min-h-[44px]">
            <div
                className={`surface-base flex h-full flex-col justify-center rounded-[12px] border border-border-subtle px-2 py-1.5 transition-colors group-hover:bg-hover-subtle ${toneClassName}`.trim()}>
                {header ? (
                    <div className="mb-0.5 flex items-center gap-1 text-fg-muted">
                        {header}
                    </div>
                ) : null}
                <div className={`line-clamp-1 text-xs font-semibold text-fg-default ${titleClassName}`.trim()}>
                    {title}
                </div>
                {meta ? (
                    <div className="text-[10px] font-medium text-fg-secondary">
                        {meta}
                    </div>
                ) : null}
            </div>
        </Link>
    );
};
