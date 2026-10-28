import classNames from 'classnames';
import type { ReactNode } from 'react';

const NoteContentSection = ({
    children,
    label,
    className,
}: {
    children: ReactNode;
    label?: string;
    className?: string;
}) => (
    <section
        aria-label={label}
        className={classNames('my-4 min-w-0 w-full border-y border-border-subtle py-3', className)}
    >
        {children}
    </section>
);

export default NoteContentSection;
