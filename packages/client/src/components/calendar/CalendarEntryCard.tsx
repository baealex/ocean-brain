import { Link } from '@tanstack/react-router';

import { Text } from '~/components/ui';
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
                <Text
                    as="div"
                    variant="label"
                    weight="semibold"
                    className={`flex items-center gap-1 line-clamp-1 ${titleClassName}`.trim()}>
                    {header ? (
                        <Text as="span" variant="label" tone="muted" className="shrink-0">
                            {header}
                        </Text>
                    ) : null}
                    {title}
                </Text>
                {meta ? (
                    <Text as="div" variant="micro" weight="medium" tone="secondary">
                        {meta}
                    </Text>
                ) : null}
            </div>
        </Link>
    );
};
