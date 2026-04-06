import { Link } from '@tanstack/react-router';
import classNames from 'classnames';

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
            className="focus-ring-soft group block rounded-[8px] outline-none">
            <div
                className={classNames(
                    'flex items-start gap-1.5 rounded-[8px] px-1.5 py-1 transition-colors group-hover:bg-hover-subtle',
                    toneClassName
                )}>
                {header ? (
                    <span className="mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center text-fg-tertiary">
                        {header}
                    </span>
                ) : (
                    <span
                        aria-hidden="true"
                        className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-fg-placeholder"
                    />
                )}

                <div className="min-w-0 flex-1">
                    <Text
                        as="div"
                        variant="label"
                        weight="medium"
                        tone="secondary"
                        className={classNames('line-clamp-1', titleClassName)}>
                        {title}
                    </Text>
                    {meta ? (
                        <Text
                            as="div"
                            variant="micro"
                            weight="medium"
                            tone="tertiary"
                            className="mt-0.5">
                            {meta}
                        </Text>
                    ) : null}
                </div>
            </div>
        </Link>
    );
};
