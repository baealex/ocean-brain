import styles from './Tag.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import { createReactInlineContentSpec } from '@blocknote/react';
import { Link } from '@tanstack/react-router';

import { TAG_NOTES_ROUTE } from '~/modules/url';

export const Tag = createReactInlineContentSpec(
    {
        type: 'tag',
        propSchema: {
            id: { default: '' },
            tag: { default: '@Unknown' }
        },
        content: 'none'
    },
    {
        render: (props) => (
            <span className={cx('Tag')}>
                <Link
                    to={TAG_NOTES_ROUTE}
                    params={{ id: props.inlineContent.props.id }}
                    search={{ page: 1 }}>
                    <span className="text-fg-default">
                        {props.inlineContent.props.tag}
                    </span>
                </Link>
            </span>
        )
    }
);

export default Tag;
