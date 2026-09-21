import { createLink } from '@tanstack/react-router';
import classNames from 'classnames';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import * as Icon from '~/components/icon';
import { Button } from '~/components/ui';

const BackLinkAnchor = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'>>(
    ({ children, className, ...props }, ref) => (
        <Button asChild variant="ghost" size="sm" className={classNames('-ml-3', className)}>
            <a {...props} ref={ref}>
                <Icon.ArrowLeft aria-hidden="true" className="h-4 w-4" />
                {children}
            </a>
        </Button>
    ),
);
BackLinkAnchor.displayName = 'PageBackLink';

export default createLink(BackLinkAnchor);
