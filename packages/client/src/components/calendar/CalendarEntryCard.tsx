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
            className="group block">
            <div
                className={`rounded-[6px] bg-emphasis flex h-full flex-col justify-center px-1.5 py-0.5 transition-colors group-hover:bg-hover-subtle ${toneClassName}`.trim()}>
                <div className={`flex items-center gap-1 text-label line-clamp-1 font-semibold text-fg-default ${titleClassName}`.trim()}>
                    {header ? <span className="shrink-0 text-fg-muted">{header}</span> : null}
                    {title}
                </div>
                {meta ? (
                    <div className="text-micro font-medium text-fg-secondary">
                        {meta}
                    </div>
                ) : null}
            </div>
        </Link>
    );
};
